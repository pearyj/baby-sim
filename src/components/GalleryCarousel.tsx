import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, IconButton, Link, Stack, Typography } from '@mui/material';
import { ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getGalleryItems } from '../services/galleryService';
import type { GalleryItem } from '../services/galleryService';

/**
 * Carousel showcasing community shared ending images.
 * Fetches 8 random items with hearts >= 1. Auto-scrolls every few seconds,
 * while still allowing manual horizontal scroll via arrows or swipe.
 */
const AUTO_INTERVAL_MS = 2000; // 2 seconds per photo

function shuffleArray<T>(array: T[]): T[] {
  return array
    .map((item) => ({ sort: Math.random(), value: item }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

const GalleryCarousel: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  // Fetch gallery items once on mount
  useEffect(() => {
    (async () => {
      try {
        // Fetch a larger pool then sample client-side for randomness
        const rows = await getGalleryItems(40, 0);
        const eligible = rows.filter((r) => (r.hearts ?? 0) >= 1);
        setItems(shuffleArray(eligible).slice(0, 12));
      } catch (err) {
        console.error('[GalleryCarousel] Failed to load items:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Scroll one photo every 2 seconds (wrap to start)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) return;

    let index = 0;
    const id = window.setInterval(() => {
      index = (index + 1) % items.length;
      const child = container.children[index] as HTMLElement | undefined;
      if (child) {
        container.scrollTo({ left: child.offsetLeft, behavior: 'smooth' });
      }
    }, AUTO_INTERVAL_MS);

    return () => clearInterval(id);
  }, [items]);

  const scrollBy = (direction: number) => {
    const container = containerRef.current;
    if (!container) return;
    const amount = container.clientWidth * 0.8 * direction;
    container.scrollBy({ left: amount, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ mt: 2 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  if (items.length === 0) return null;

  return (
    <Stack sx={{ mt: -0.5 }}>
      {/* Title row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main', textAlign: 'left' }}>
          {t('gallery.proudKids')}
        </Typography>
        <Link
          component="button"
          underline="hover"
          color="text.secondary"
          onClick={() => navigate('/gallery')}
          sx={{ fontWeight: 400, fontSize: '0.875rem' }}
        >
          {t('gallery.seeMore')}
        </Link>
      </Box>

      {/* Carousel with arrows */}
      <Box sx={{ position: 'relative' }}>
        {/* Left arrow */}
        <IconButton
          size="small"
          onClick={() => scrollBy(-1)}
          sx={{ position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 1, bgcolor: 'background.paper', boxShadow: 1 }}
          aria-label="Previous"
        >
          <ArrowBackIos fontSize="small" />
        </IconButton>

        {/* Scroll container */}
        <Box
          ref={containerRef}
          sx={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
          }}
        >
          {items.map((item) => (
            <Box
              key={item.id}
              sx={{
                flex: { xs: '0 0 calc(100% - 16px)', sm: '0 0 calc(33.333% - 16px)' },
                mr: 1,
                scrollSnapAlign: 'center',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Box
                component="img"
                src={item.imageUrl}
                alt={item.childStatusAt18}
                loading="lazy"
                sx={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </Box>
          ))}
        </Box>

        {/* Right arrow */}
        <IconButton
          size="small"
          onClick={() => scrollBy(1)}
          sx={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 1, bgcolor: 'background.paper', boxShadow: 1 }}
          aria-label="Next"
        >
          <ArrowForwardIos fontSize="small" />
        </IconButton>
      </Box>
    </Stack>
  );
};

export default GalleryCarousel; 