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

type ProviderChoice = 'volcengine' | 'gemini-flash';

export const ProviderToggle: React.FC = () => {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<ProviderChoice>('volcengine');
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
      const rawOverride = getProviderOverride();
      const override = rawOverride ?? null;
      const isLocked = isPremiumStyleActive();
      setLocked(isLocked);
      const nextChoice: ProviderChoice = override ? override : (eff === 'gemini-flash' ? 'gemini-flash' : 'volcengine');
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

  // Hide when not in game or when style is locked to premium (ultra)
  if (!isInGame || locked) return null;

  return (
    <Tooltip title={t('header.modelToggle') || 'Model'}>
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
        <ToggleButton value="volcengine" aria-label="Volcengine">
          Deepseek
        </ToggleButton>
        <ToggleButton value="gemini-flash" aria-label="Gemini">
          Gemini
        </ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
};

export default ProviderToggle;
