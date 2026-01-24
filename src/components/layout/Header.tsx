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

const StyledAppBar = styled(AppBar)(() => ({
  background: `linear-gradient(135deg, rgba(255, 107, 53, 0.9) 0%, rgba(229, 90, 43, 0.9) 100%)`,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.24)',
  boxShadow: '0 14px 30px rgba(30,30,30,0.12)'
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
    <StyledAppBar position="fixed" elevation={2} component="header" role="banner">
      <Toolbar sx={{ maxWidth: '3xl', mx: 'auto', width: '100%', px: 2 }} component="nav" aria-label="Main navigation">
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          <StyledTitle
            variant="h4"
            component="h1"
            sx={{
              fontSize: { xs: '1.5rem', sm: '2rem' },
              textAlign: 'center'
            }}
            onClick={() => navigate('/')}
            role="link"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && navigate('/')}
            aria-label="Baby Simulator - Go to home page"
          >
            {t('header.title')}
          </StyledTitle>
        </Box>
        
        <Box sx={{ position: 'absolute', right: 16, display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Language Toggle */}
          <LanguageToggle />

          {/* Provider Toggle (DeepSeek ↔ Gemini Flash) - only during gameplay and not in ultra style */}
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
