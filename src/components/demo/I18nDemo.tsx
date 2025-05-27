import React from 'react';
import { Box, Typography, Card, CardContent, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGameTranslations } from '../../hooks/useGameTranslations';
import { StreamingTextDisplayI18n } from '../ui';

export const I18nDemo: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { getGenderText, getWealthText, formatAge } = useGameTranslations();

  const demoGameData = {
    player: { gender: 'male', age: 30 },
    child: { name: 'Alex', gender: 'female' },
    playerDescription: 'A software engineer who loves coding and coffee.',
    childDescription: 'A curious and energetic child who loves to explore.',
    wealthTier: 'middle'
  };

  const demoContent = JSON.stringify({
    ...demoGameData,
    question: 'Your child wants to learn a new skill. What do you choose?',
    options: [
      { id: 'A', text: 'Music lessons', cost: 100 },
      { id: 'B', text: 'Sports training', cost: 80 },
      { id: 'C', text: 'Art classes', cost: 60 }
    ]
  });

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        {t('ui.languageToggle')} Demo
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 3 }}>
        Current language: <strong>{i18n.language === 'en' ? 'English' : '中文'}</strong>
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Translation Functions Demo
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 1 }}>
            Gender (Parent): {getGenderText(demoGameData.player.gender as 'male' | 'female', true)}
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 1 }}>
            Gender (Child): {getGenderText(demoGameData.child.gender as 'male' | 'female')}
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 1 }}>
            Age: {formatAge(demoGameData.player.age)}
          </Typography>
          
          <Typography variant="body2" sx={{ mb: 1 }}>
            Wealth: {getWealthText(demoGameData.wealthTier as 'poor' | 'middle' | 'wealthy')}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Internationalized Streaming Text Display
          </Typography>
          
          <StreamingTextDisplayI18n
            content={demoContent}
            isStreaming={false}
            isComplete={true}
            showTypewriter={false}
          />
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      <Typography variant="body2" color="text.secondary">
        Use the language toggle in the header to switch between English and Chinese!
      </Typography>
    </Box>
  );
}; 