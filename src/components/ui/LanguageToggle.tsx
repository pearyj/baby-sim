import React from 'react';
import { IconButton, Tooltip, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getLanguageFlag, getLanguageDisplayName, type SupportedLanguage } from '../../utils/languageDetection';

export const LanguageToggle: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageToggle = () => {
    const newLanguage = i18n.language === 'en' ? 'zh' : 'en';
    i18n.changeLanguage(newLanguage);
  };

  const getCurrentFlag = () => {
    return getLanguageFlag(i18n.language as SupportedLanguage);
  };

  const getTooltipText = () => {
    const currentLang = i18n.language as SupportedLanguage;
    const targetLang = currentLang === 'en' ? 'zh' : 'en';
    const targetLangName = getLanguageDisplayName(targetLang);
    
    return `Switch to ${targetLangName}`;
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