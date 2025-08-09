import React from 'react';
import { AppBar, Toolbar, Typography, Box, Switch, FormControlLabel, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { DevModelSwitcher } from '../dev';
import { LanguageToggle } from '../ui';
import ProviderToggle from '../ui/ProviderToggle';
import { isPremiumStyleActive } from '../../services/gptServiceUnified';
import { useTranslation } from 'react-i18next';
import useGameStore from '../../stores/useGameStore';
import { useNavigate } from 'react-router-dom';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)',
}));

const StyledTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.primary.contrastText,
  cursor: 'pointer',
  '&:hover': {
    opacity: 0.9,
  },
}));

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enableStreaming, toggleStreaming, isStreaming, gamePhase } = useGameStore(state => ({
    enableStreaming: state.enableStreaming,
    toggleStreaming: state.toggleStreaming,
    isStreaming: state.isStreaming,
    gamePhase: state.gamePhase,
  }));
  const isInGame = (
    gamePhase === 'playing' ||
    gamePhase === 'loading_question' ||
    gamePhase === 'feedback' ||
    gamePhase === 'generating_outcome' ||
    gamePhase === 'ending_game' ||
    gamePhase === 'summary' ||
    gamePhase === 'ended'
  );

  return (
    <StyledAppBar position="fixed" elevation={2}>
      <Toolbar sx={{ maxWidth: '3xl', mx: 'auto', width: '100%', px: 2 }}>
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          <StyledTitle 
            variant="h4" 
            sx={{ 
              fontSize: { xs: '1.5rem', sm: '2rem' },
              textAlign: 'center'
            }}
            onClick={() => navigate('/')}
          >
            {t('header.title')}
          </StyledTitle>
        </Box>
        
        <Box sx={{ position: 'absolute', right: 16, display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Language Toggle */}
          <LanguageToggle />

          {/* Provider Toggle (DeepSeek ↔ GPT-5) - only during gameplay and not in ultra style */}
          {isInGame && !isPremiumStyleActive() && <ProviderToggle />}
          
          {/* Only show streaming toggle in development mode */}
          {import.meta.env.DEV && (
            <Tooltip title={enableStreaming ? t('header.disableStreaming') : t('header.enableStreaming')}>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableStreaming}
                    onChange={toggleStreaming}
                    disabled={isStreaming}
                    color="default"
                  />
                }
                label={t('header.streaming')}
                sx={{ color: 'white' }}
              />
            </Tooltip>
          )}
          
          {/* Dev Model Switcher - hidden in ultra style */}
          {import.meta.env.DEV && !isPremiumStyleActive() && <DevModelSwitcher />}
        </Box>
      </Toolbar>
    </StyledAppBar>
  );
}; 