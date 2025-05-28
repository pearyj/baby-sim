import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Chip, 
  Stack,
  Button,
  Alert,
  Divider
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { 
  detectSystemLanguage, 
  getPreferredLanguage, 
  getLanguageDisplayName, 
  getLanguageFlag,
  type SupportedLanguage 
} from '../../utils/languageDetection';

export const LanguageDetectionDemo: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [detectionInfo, setDetectionInfo] = useState({
    systemLanguage: '',
    detectedLanguage: '' as SupportedLanguage,
    preferredLanguage: '' as SupportedLanguage,
    currentLanguage: '' as SupportedLanguage,
    savedLanguage: ''
  });

  useEffect(() => {
    // Get all language detection information
    const systemLang = navigator.language || navigator.languages?.[0] || 'unknown';
    const detected = detectSystemLanguage();
    const preferred = getPreferredLanguage();
    const current = i18n.language as SupportedLanguage;
    const saved = localStorage.getItem('i18nextLng') || 'none';

    setDetectionInfo({
      systemLanguage: systemLang,
      detectedLanguage: detected,
      preferredLanguage: preferred,
      currentLanguage: current,
      savedLanguage: saved
    });
  }, [i18n.language]);

  const handleClearSavedLanguage = () => {
    localStorage.removeItem('i18nextLng');
    window.location.reload(); // Reload to see the effect
  };

  const handleSetLanguage = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
  };

  const getLanguageChip = (lang: string, label: string) => {
    const isSupported = lang === 'zh' || lang === 'en';
    return (
      <Chip
        label={`${label}: ${lang}`}
        color={isSupported ? 'primary' : 'default'}
        variant={isSupported ? 'filled' : 'outlined'}
        size="small"
      />
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        🌐 Language Detection Demo
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        This demo shows how the app detects and handles different system languages.
        <br />
        <strong>Rule:</strong> Chinese/English system → Use that language. Other languages → Default to English.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Detection Status
          </Typography>
          
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                System Language (from browser):
              </Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                {detectionInfo.systemLanguage}
              </Typography>
            </Box>

            <Divider />

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {getLanguageChip(detectionInfo.detectedLanguage, 'Detected')}
              {getLanguageChip(detectionInfo.preferredLanguage, 'Preferred')}
              {getLanguageChip(detectionInfo.currentLanguage, 'Current')}
              {getLanguageChip(detectionInfo.savedLanguage, 'Saved')}
            </Stack>

            <Box>
              <Typography variant="body2" color="text.secondary">
                <strong>Detection Logic:</strong>
                <br />
                1. Check saved preference → 2. Detect system language → 3. Apply fallback rules
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Language Information
          </Typography>
          
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2">
                Current Language: {getLanguageFlag(detectionInfo.currentLanguage)} {getLanguageDisplayName(detectionInfo.currentLanguage)}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2">
                Interface Text: {t('welcome.title')}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2">
                Game Text: {t('game.setup')}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Test Controls
          </Typography>
          
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Button 
              variant="outlined" 
              onClick={() => handleSetLanguage('zh')}
              disabled={detectionInfo.currentLanguage === 'zh'}
            >
              🇨🇳 Switch to Chinese
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => handleSetLanguage('en')}
              disabled={detectionInfo.currentLanguage === 'en'}
            >
              🇺🇸 Switch to English
            </Button>
          </Stack>
          
          <Button 
            variant="outlined" 
            color="warning"
            onClick={handleClearSavedLanguage}
            disabled={detectionInfo.savedLanguage === 'none'}
          >
            Clear Saved Language & Reload
          </Button>
          
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Clearing saved language will reload the page and re-detect system language
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Fallback Examples
          </Typography>
          
          <Typography variant="body2" component="div">
            <strong>Supported Languages:</strong>
            <ul>
              <li>🇨🇳 Chinese (zh, zh-CN, zh-TW, etc.) → Chinese interface</li>
              <li>🇺🇸 English (en, en-US, en-GB, etc.) → English interface</li>
            </ul>
            
            <strong>Unsupported Languages (Default to English):</strong>
            <ul>
              <li>🇫🇷 French (fr, fr-FR) → English interface</li>
              <li>🇪🇸 Spanish (es, es-ES) → English interface</li>
              <li>🇩🇪 German (de, de-DE) → English interface</li>
              <li>🇯🇵 Japanese (ja, ja-JP) → English interface</li>
              <li>And any other language...</li>
            </ul>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}; 