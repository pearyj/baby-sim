import React, { useEffect, useState } from 'react';
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  getCurrentModel,
  getEffectiveProviderKey,
  getProviderOverride,
  setProviderOverride,
  isPremiumStyleActive,
} from '../../services/gptServiceUnified';
import useGameStore from '../../stores/useGameStore';

type ProviderChoice = 'deepseek' | 'gpt5';

export const ProviderToggle: React.FC = () => {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<ProviderChoice>('deepseek');
  const [locked, setLocked] = useState<boolean>(false);
  const [, setLabel] = useState<string>('');
  const gamePhase = useGameStore(state => state.gamePhase);

  // Defensive: only render during gameplay phases
  const isInGame = (
    gamePhase === 'playing' ||
    gamePhase === 'loading_question' ||
    gamePhase === 'feedback' ||
    gamePhase === 'generating_outcome' ||
    gamePhase === 'ending_game' ||
    gamePhase === 'summary' ||
    gamePhase === 'ended'
  );

  useEffect(() => {
    const update = () => {
      const eff = getEffectiveProviderKey();
      const override = getProviderOverride();
      const isLocked = isPremiumStyleActive();
      setLocked(isLocked);
      const nextChoice: ProviderChoice = override ? override : (eff === 'gpt5' ? 'gpt5' : 'deepseek');
      setChoice(nextChoice);
      setLabel(getCurrentModel());
    };
    update();
    window.addEventListener('model-provider-changed', update as EventListener);
    window.addEventListener('game-style-changed', update as EventListener);
    return () => {
      window.removeEventListener('model-provider-changed', update as EventListener);
      window.removeEventListener('game-style-changed', update as EventListener);
    };
  }, []);

  const handleChange = (_: any, value: ProviderChoice | null) => {
    if (!value) return;
    setChoice(value);
    setProviderOverride(value);
  };

  const gpt5Note = t('gameStyle.ultraExplanation') || 'Premium feature – GPT‑5 for an ultra-realistic experience';

  // Hide when not in game or when style is locked to GPT-5 (ultra)
  if (!isInGame || locked) return null;

  return (
    <Tooltip title={choice === 'gpt5' ? gpt5Note : t('header.modelToggle') || 'Model'}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={choice}
        onChange={handleChange}
        aria-label="Model Provider"
        sx={{
          '& .MuiToggleButton-root': {
            color: 'white',
            borderColor: 'rgba(255,255,255,0.4)',
            textTransform: 'none',
            fontWeight: 700,
            px: 1.5,
            backgroundColor: 'transparent',
            '&.Mui-selected': {
              // Reuse existing orange from floating button (#ff8c00 / hover #e67e00)
              bgcolor: '#ff8c00 !important',
              color: '#fff !important',
              borderColor: '#e67e00 !important',
              '&:hover': {
                bgcolor: '#e67e00 !important',
              },
            },
          },
        }}
      >
        <ToggleButton value="deepseek" aria-label="DeepSeek">
          DeepSeek
        </ToggleButton>
        <ToggleButton value="gpt5" aria-label="GPT-5">
          GPT-5
        </ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
};

export default ProviderToggle;


