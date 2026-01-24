import React from 'react';
import { Container, Typography, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InfiniteGallery } from '../components/InfiniteGallery';
import { useSEO } from '../hooks/useSEO';

const FloatingButton = styled(Button)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(4),
  right: '50%',
  transform: 'translateX(50%)',
  borderRadius: theme.spacing(3),
  padding: theme.spacing(1.5, 4),
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  zIndex: 1100,
  boxShadow: theme.shadows[6],
}));

export const GalleryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // SEO for gallery page
  useSEO({
    title: 'Gallery - Baby Simulator | See Kids Raised by Other Players',
    description: 'Browse the gallery of AI-generated images showing children raised by other Baby Simulator players. Get inspired for your own parenting journey!',
    path: '/gallery',
  });

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, textAlign: 'center' }}>
        {t('gallery.otherKids')}
      </Typography>

      <InfiniteGallery />

      <FloatingButton
        variant="contained"
        color="primary"
        onClick={() => navigate('/')}
      >
        {t('gallery.raiseBaby')}
      </FloatingButton>
    </Container>
  );
}; 