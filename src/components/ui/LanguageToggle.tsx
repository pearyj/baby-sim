import React, { useState } from 'react';
import { IconButton, Tooltip, Box, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getLanguageFlag, getLanguageDisplayName, type SupportedLanguage } from '../../utils/languageDetection';

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'zh', 'ja', 'es'];

export const LanguageToggle: React.FC = () => {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageSelect = (language: SupportedLanguage) => {
    i18n.changeLanguage(language);
    handleClose();
  };

  const getCurrentFlag = () => {
    return getLanguageFlag(i18n.language as SupportedLanguage);
  };

  return (
    <>
      <Tooltip title={t('ui.languageToggle')}>
        <IconButton
          onClick={handleClick}
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
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <MenuItem
            key={language}
            onClick={() => handleLanguageSelect(language)}
            selected={i18n.language === language}
            sx={{
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
              '&.Mui-selected': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                },
              },
            }}
          >
            <ListItemIcon sx={{ color: 'white', minWidth: 32 }}>
              {getLanguageFlag(language)}
            </ListItemIcon>
            <ListItemText primary={getLanguageDisplayName(language)} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}; 