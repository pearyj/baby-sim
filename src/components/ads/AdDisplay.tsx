import React, { useEffect, useRef } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface AdDisplayProps {
  currentAge: number;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const AdDisplay: React.FC<AdDisplayProps> = ({ currentAge }) => {
  const { t } = useTranslation();
  const adRef = useRef<HTMLDivElement>(null);
  const isDevelopment = import.meta.env.DEV;

  // Only show ads when age is over 7 and in development mode
  if (currentAge <= 7 || !isDevelopment) {
    return null;
  }

  useEffect(() => {
    // Load the AdSense script if it hasn't been loaded yet
    if (!document.querySelector('script[src*="pagead2.googlesyndication.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4835815551152079';
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    // Initialize the ad
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('Error loading AdSense:', err);
    }
  }, []);

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 2, 
        mb: 2, 
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          {t('ui.sponsored')}
        </Typography>
        <Box
          ref={adRef}
          sx={{
            minHeight: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'action.hover',
            borderRadius: 1,
          }}
        >
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client="ca-pub-4835815551152079"
            data-ad-slot="2078786233"
            data-ad-format="autorelaxed"
          />
        </Box>
      </Box>
    </Paper>
  );
}; 