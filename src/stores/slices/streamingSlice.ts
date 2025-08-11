import logger from '../../utils/logger';
import i18n from '../../i18n';
import * as gptService from '../../services/gptServiceUnified';
import { usePaymentStore } from '../usePaymentStore';
import type { GameState as ApiGameState, HistoryEntry } from '../../types/game';

// Streaming-related actions extracted from the main game store.
// These are wired back into the store to keep the public API identical.

export interface StreamingActionsSlice {
  toggleStreaming: () => void;
  loadQuestionStreaming: () => Promise<void>;
  selectOptionStreaming: (optionId: string) => Promise<void>;
}

export const createStreamingActions = (
  set: any,
  get: any,
  saveGameStateFn: (state: any) => void
): StreamingActionsSlice => ({
  toggleStreaming: () => {
    const { enableStreaming } = get();
    logger.debug(`🔄 Toggling streaming mode from ${enableStreaming} to ${!enableStreaming}`);
    set((prevState: any) => ({
      ...prevState,
      enableStreaming: !enableStreaming,
    }));
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`🔄 Streaming mode is now: ${!enableStreaming ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    }
  },

  loadQuestionStreaming: async () => {
    const {
      child,
      player,
      playerDescription,
      childDescription,
      history,
      endingSummaryText: est_store,
      currentQuestion: cQ_store,
      feedbackText: ft_store,
      isSingleParent,
      enableStreaming,
    } = get();

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('🚀 loadQuestionStreaming called! enableStreaming:', enableStreaming);
    }
    logger.debug(`🚀 loadQuestionStreaming called with enableStreaming: ${enableStreaming}`);

    if (!enableStreaming) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('⚠️ Streaming disabled, falling back to regular loadQuestion');
      }
      return get().loadQuestion();
    }

    if (!child || !player) {
      set((prevState: any) => ({
        ...prevState,
        error: 'Cannot load question: Player or child data is missing.',
        gamePhase: 'initialization_failed',
        isLoading: false,
      }));
      return;
    }

    set((prevState: any) => ({
      ...prevState,
      gamePhase: 'loading_question',
      isLoading: true,
      isStreaming: true,
      streamingContent: '',
      streamingType: 'question',
      error: null,
      currentQuestion: null,
    }));

    try {
      logger.debug('Preparing game state for streaming API call');
      const fullGameStateForApi: ApiGameState = {
        player: player!,
        child: child!,
        playerDescription: playerDescription!,
        childDescription: childDescription!,
        history: history,
        endingSummaryText: est_store,
        currentQuestion: cQ_store,
        feedbackText: ft_store,
        isSingleParent: isSingleParent,
        finance: get().finance,
        marital: get().marital,
      };

      logger.debug('Making streaming API call to fetch question for age:', child.age);

      const question = await gptService.generateQuestion(fullGameStateForApi, {
        streaming: true,
        onProgress: (partialContent: string) => {
          set((prevState: any) => ({
            ...prevState,
            streamingContent: partialContent,
          }));
        },
      });

      logger.debug('Successfully received streaming question from API:', question);

      const newState = {
        currentQuestion: question,
        nextQuestion: null,
        isLoading: false,
        isStreaming: false,
        streamingContent: '',
        streamingType: null,
        showFeedback: false,
        feedbackText: null,
        gamePhase: 'playing' as const,
        error: null,
      };
      set((prevState: any) => ({ ...prevState, ...newState }));
      saveGameStateFn(get());
    } catch (err) {
      logger.error('Error in loadQuestionStreaming function:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load question.';

      set((prevState: any) => ({
        ...prevState,
        gamePhase: 'playing',
        error: errorMessage,
        isLoading: false,
        isStreaming: false,
        streamingContent: '',
        streamingType: null,
        currentQuestion: {
          id: `error-${Date.now()}`,
          question: i18n.t('messages.loadQuestionErrorGeneric') as string,
          options: [
            { id: 'retry', text: i18n.t('messages.retry') as string, cost: 0 },
            { id: 'reload', text: i18n.t('messages.refreshPage') as string, cost: 0 },
          ],
          isExtremeEvent: false,
        },
      }));
    }
  },

  selectOptionStreaming: async (optionId: string) => {
    const {
      currentQuestion,
      player,
      child,
      playerDescription,
      childDescription,
      history,
      endingSummaryText: est_store,
      currentQuestion: cQ_store,
      feedbackText: ft_store,
      isSingleParent,
      enableStreaming,
    } = get();

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('🚀 selectOptionStreaming called! optionId:', optionId, 'enableStreaming:', enableStreaming);
    }
    logger.debug(`🚀 selectOptionStreaming called with optionId: ${optionId}, enableStreaming: ${enableStreaming}`);

    if (!enableStreaming) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('⚠️ Streaming disabled, falling back to regular selectOption');
      }
      return get().selectOption(optionId);
    }

    if (!currentQuestion || !player || !child) {
      set((prevState: any) => ({
        ...prevState,
        error: 'Cannot select option: Missing data.',
        gamePhase: 'playing',
        isLoading: false,
      }));
      return;
    }

    if (optionId === 'retry') {
      logger.debug('User selected to retry the last pending choice');
      set((prevState: any) => ({ ...prevState, error: null, isLoading: false }));
      get().loadQuestionStreaming();
      return;
    } else if (optionId === 'reload') {
      logger.debug('User selected to reload the game');
      window.location.reload();
      return;
    }

    let selectedOption = currentQuestion.options.find((opt: any) => opt.id === optionId);
    if (!selectedOption && optionId.startsWith('custom_')) {
      const customOption = (window as any).lastCustomOption;
      if (customOption && customOption.id === optionId) {
        selectedOption = customOption;
        logger.debug('Using custom option:', selectedOption);
        delete (window as any).lastCustomOption;
      }
    }
    if (!selectedOption) {
      set((prevState: any) => ({ ...prevState, error: 'Invalid option selected.', gamePhase: 'playing', isLoading: false }));
      return;
    }

    let financeDelta = selectedOption.financeDelta || selectedOption.cost || 0;
    if (child.age <= 5 && financeDelta < 0) {
      logger.debug(`Skipping finance deduction of ${financeDelta} because child age (${child.age}) ≤ 5`);
      financeDelta = 0;
    }
    const maritalDelta = selectedOption.maritalDelta || 0;

    const newFinance = Math.max(0, Math.min(10, get().finance + financeDelta));
    const newMarital = Math.max(0, Math.min(10, get().marital + maritalDelta));

    const wasBankrupt = get().finance === 0;
    const isNowBankrupt = newFinance === 0;

    logger.info(`💰 Finance: ${get().finance} + ${financeDelta} = ${newFinance}`);
    logger.info(`💕 Marital: ${get().marital} + ${maritalDelta} = ${newMarital}`);

    if (wasBankrupt && (selectedOption as any).isRecovery) {
      const recoveredFinance = Math.max(3, newFinance + 2);
      logger.info(`🎉 Player recovered from bankruptcy! Finance improved from ${newFinance} to ${recoveredFinance}`);
      set((prevState: any) => ({
        ...prevState,
        finance: recoveredFinance,
        marital: newMarital,
        gamePhase: 'generating_outcome',
        isLoading: true,
        isStreaming: true,
        streamingContent: '',
        streamingType: 'outcome',
        error: null,
      }));
      logger.debug(`Bankruptcy recovery: Finance set to ${recoveredFinance}, Marital set to ${newMarital}`);
    } else {
      if (newFinance === 0 && !wasBankrupt) {
        logger.warn(`Bankruptcy reached! Finance dropped to 0`);
      }
      set((prevState: any) => ({
        ...prevState,
        finance: newFinance,
        marital: newMarital,
        gamePhase: 'generating_outcome',
        isLoading: true,
        isStreaming: true,
        streamingContent: '',
        streamingType: 'outcome',
        error: null,
      }));
      logger.debug(
        `Finance updated: ${get().finance} + ${financeDelta} = ${newFinance}. Marital updated: ${get().marital} + ${maritalDelta} = ${newMarital}. Is Bankrupt: ${isNowBankrupt}`,
      );
    }

    const intermediateState = {
      ...get(),
      pendingChoice: {
        questionId: currentQuestion.id,
        optionId: selectedOption.id,
        questionText: currentQuestion.question,
        optionText: selectedOption.text,
      },
    };
    saveGameStateFn(intermediateState);

    try {
      const eventAge = child.age;
      const fullGameStateForApi: ApiGameState = {
        player: player!,
        child: child!,
        playerDescription: playerDescription!,
        childDescription: childDescription!,
        history: history,
        endingSummaryText: est_store,
        currentQuestion: cQ_store,
        feedbackText: ft_store,
        isSingleParent: isSingleParent,
        finance: get().finance,
        marital: get().marital,
      };

      const result = await gptService.generateOutcomeAndNextQuestion(
        fullGameStateForApi,
        currentQuestion.question,
        selectedOption.text,
        {
          streaming: true,
          onProgress: (partialContent: string) => {
            set((prevState: any) => ({
              ...prevState,
              streamingContent: partialContent,
            }));
          },
        },
      );

      const newHistoryEntry: HistoryEntry = {
        age: eventAge,
        question: currentQuestion.question,
        choice: selectedOption.text,
        outcome: result.outcome,
      };

      const updatedHistory = history
        .filter((entry: any) => entry.age !== eventAge)
        .concat(newHistoryEntry)
        .sort((a: any, b: any) => a.age - b.age);

      logger.debug(`Updated history: Removed entry for age ${eventAge} if it existed, added new entry`);

      const newState = {
        feedbackText: result.outcome,
        nextQuestion: result.nextQuestion || null,
        isEnding: result.isEnding || false,
        history: updatedHistory,
        currentQuestion: null,
        showFeedback: true,
        gamePhase: 'feedback' as const,
        isLoading: false,
        isStreaming: false,
        streamingContent: '',
        streamingType: null,
        pendingChoice: null,
      };
      set((prevState: any) => ({ ...prevState, ...newState }));
      saveGameStateFn(get());

      const { anonId: anonId2, kidId: kidId2 } = usePaymentStore.getState();
      if (anonId2 && kidId2) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        (async () => {
          const { logEvent } = await import('../../services/eventLogger');
          logEvent(anonId2, kidId2, 'choice', {
            age: eventAge,
            optionId: selectedOption.id,
            question: currentQuestion.question,
            choiceText: selectedOption.text,
            customInstruction: selectedOption.text,
          });
        })();
      }
    } catch (err) {
      logger.error('Error generating outcome in streaming store:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process selection.';
      set((prevState: any) => ({
        ...prevState,
        gamePhase: 'feedback',
        error: errorMessage,
        isLoading: false,
        isStreaming: false,
        streamingContent: '',
        streamingType: null,
        showFeedback: true,
        feedbackText: i18n.t('messages.processChoiceError', { errorMessage }) as string,
      }));
    }
  },
});


