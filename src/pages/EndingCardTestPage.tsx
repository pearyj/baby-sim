import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  ButtonGroup,
  Paper,
  CircularProgress,
} from '@mui/material';
import { ShareableEndingCard } from '../components/ShareableEndingCard';
import { mockGameStates } from '../data/mockData';
import { useTranslation } from 'react-i18next';
import { generateEnding } from '../services/gptServiceUnified';

export const EndingCardTestPage: React.FC = () => {
  const { i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<'english' | 'chinese'>('english');

  const handleLanguageChange = (language: 'english' | 'chinese') => {
    setSelectedLanguage(language);
    // Also change the i18n language to match
    i18n.changeLanguage(language === 'english' ? 'en' : 'zh');
  };

  const selectedGameState = mockGameStates[selectedLanguage];

  const [endingSummary, setEndingSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Generate ending summary whenever language changes
  useEffect(() => {
    let isMounted = true;
    const runGeneration = async () => {
      setIsGenerating(true);
      try {
        // Call LLM to generate ending summary
        const summary = await generateEnding({ ...selectedGameState, endingSummaryText: null } as any);
        if (isMounted) {
          setEndingSummary(summary);
        }
      } catch (err) {
        console.error('Error generating ending summary:', err);
        if (isMounted) {
          setEndingSummary('Error generating ending summary.');
        }
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    };
    runGeneration();
    return () => {
      isMounted = false;
    };
  }, [selectedLanguage]);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Ending Card Test Page
        </Typography>
        
        <Typography variant="body1" gutterBottom>
          Use this page to test the ShareableEndingCard component with different language data.
          The style comment should be hidden from the display but available as placeholder text in the image generator.
        </Typography>

        <Box sx={{ mt: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select Test Data:
          </Typography>
          <ButtonGroup variant="outlined" sx={{ mb: 2 }}>
            <Button 
              variant={selectedLanguage === 'english' ? 'contained' : 'outlined'}
              onClick={() => handleLanguageChange('english')}
            >
              English (Emily)
            </Button>
            <Button 
              variant={selectedLanguage === 'chinese' ? 'contained' : 'outlined'}
              onClick={() => handleLanguageChange('chinese')}
            >
              Chinese (小明)
            </Button>
          </ButtonGroup>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Current Test Data:</strong><br />
            Language: {selectedLanguage === 'english' ? 'English' : 'Chinese'}<br />
            Child: {selectedGameState.child.name}<br />
            Style Comment: {selectedGameState.endingSummaryText?.match(/<!--\s*story_style:\s*([^>]+?)\s*-->/i)?.[1] || 'None'}<br />
            Style Should Be Hidden: ✓ (hidden from card display, shown as placeholder in image generator)
          </Typography>
        </Box>
      </Paper>

      {isGenerating ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Generating dynamic ending summary...
          </Typography>
        </Box>
      ) : (
        <ShareableEndingCard
          childName={selectedGameState.child.name}
          endingSummaryText={endingSummary}
          playerDescription={selectedGameState.playerDescription}
          childDescription={selectedGameState.childDescription}
          gameState={selectedGameState}
        />
      )}
    </Container>
  );
}; 