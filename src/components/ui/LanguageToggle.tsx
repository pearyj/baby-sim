import React from 'react';
import { IconButton, Tooltip, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

export const LanguageToggle: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageToggle = () => {
    const newLanguage = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(newLanguage);
  };

  const getCurrentFlag = () => {
    return i18n.language === 'en' ? '🇺🇸' : '🇨🇳';
  };

  const getTooltipText = () => {
    return i18n.language === 'en' ? 'Switch to 中文' : 'Switch to English';
  };

  return (
    <Tooltip title={getTooltipText()}>
      <IconButton
        onClick={handleLanguageToggle}
        sx={{
          color: 'white',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
          fontSize: '1.2rem',
        }}
      >
        <Box
          sx={{
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {getCurrentFlag()}
        </Box>
      </IconButton>
    </Tooltip>
  );
}; 