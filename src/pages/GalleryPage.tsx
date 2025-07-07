import React, { useEffect, useState } from 'react';
import { Container, ImageList, ImageListItem, Typography, CircularProgress, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { getGalleryItems } from '../services/galleryService';
import type { GalleryItem } from '../services/galleryService';

const Caption = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
  fontSize: '0.8rem',
  color: theme.palette.text.secondary,
  textAlign: 'center',
}));

export const GalleryPage: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getGalleryItems(Infinity, 0);
        setItems(data);
      } catch (e) {
        console.error(e);
        setError(t('messages.error'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="h6" color="error" sx={{ mt: 6, textAlign: 'center' }}>
        {error}
      </Typography>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <Typography variant="h6" sx={{ mt: 6, textAlign: 'center' }}>
        {t('gallery.noImages')}
      </Typography>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, textAlign: 'center' }}>
        {t('gallery.otherKids')}
      </Typography>

      <ImageList variant="masonry" cols={3} gap={8}>
        {items.map((item) => (
          <ImageListItem key={item.id}>
            <img
              src={item.imageUrl}
              alt={item.childStatusAt18}
              loading="lazy"
              style={{ borderRadius: 8, width: '100%', height: 'auto' }}
              onError={(e) => {
                console.error('[GalleryPage] Image failed to load:', item.imageUrl);
                console.error('[GalleryPage] Error details:', e);
              }}
              onLoad={() => {
                if (import.meta.env.DEV) {
                  console.debug('[GalleryPage] Image loaded successfully:', item.imageUrl);
                }
              }}
            />
            <Caption>{item.childStatusAt18}</Caption>
          </ImageListItem>
        ))}
      </ImageList>
    </Container>
  );
}; 