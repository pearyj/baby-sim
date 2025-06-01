import React from 'react';
import { Box, Typography } from '@mui/material';
import { Timeline } from '../features/timeline/Timeline';
import { AdDisplay } from '../components/ads/AdDisplay';

export const AdTestPage: React.FC = () => {
  // Mock data for testing
  const mockHistory = [
    {
      age: 7,
      question: "Test question for age 7",
      choice: "Test choice for age 7",
      outcome: "Test outcome for age 7",
      timestamp: new Date().toISOString()
    },
    {
      age: 8,
      question: "Test question for age 8",
      choice: "Test choice for age 8",
      outcome: "Test outcome for age 8",
      timestamp: new Date().toISOString()
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Ad Test Page
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 2 }}>
        This page is for testing ads in development mode. It shows the timeline with ages 7 and 8 to test ad display.
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Direct Ad Component Test
        </Typography>
        <AdDisplay currentAge={7} />
        <AdDisplay currentAge={8} />
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Timeline Integration Test
        </Typography>
        <Timeline 
          history={mockHistory}
          currentAge={7}
          childGender="male"
        />
      </Box>
    </Box>
  );
}; 