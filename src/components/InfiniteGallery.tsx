import React, { useCallback, useEffect, useState } from 'react';
import {
  ImageList,
  ImageListItem,
  CircularProgress,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTranslation } from 'react-i18next';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';

import {
  getGalleryItems,
  incrementHeart,
  decrementHeart,
  getSharedCardsCount,
} from '../services/galleryService';
import type { GalleryItem } from '../services/galleryService';
import { filterGalleryItemsByAspect } from '../utils/galleryFilters';

const Caption = styled('p')(({ theme }) => ({
  marginTop: theme.spacing(0.5),
  fontSize: '0.8rem',
  color: theme.palette.text.secondary,
  textAlign: 'center',
}));

const BATCH_SIZE = 24;
const FETCH_MULTIPLIER = 2;
const GALLERY_ASPECT_RANGE = {
  minAspectRatio: 0.9,
  maxAspectRatio: 1.3,
};

export const InfiniteGallery: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const cols = mdUp ? 3 : 2;

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [offset, setOffset] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('likedGalleryIds');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // persist like ids
  useEffect(() => {
    localStorage.setItem('likedGalleryIds', JSON.stringify(Array.from(likedIds)));
  }, [likedIds]);

  // fetch a batch starting from batchOffset
  const fetchBatch = useCallback(
    async (batchOffset: number) => {
      console.debug('[InfiniteGallery] fetchBatch offset', batchOffset);
      setLoading(true);
      try {
        const fetchLimit = BATCH_SIZE * FETCH_MULTIPLIER;
        const rawItems = await getGalleryItems(fetchLimit, batchOffset);
        let filteredItems = await filterGalleryItemsByAspect(rawItems, GALLERY_ASPECT_RANGE);

        if (filteredItems.length === 0 && rawItems.length > 0) {
          console.warn('[InfiniteGallery] Aspect filter removed all candidates, falling back to raw batch.');
          filteredItems = rawItems;
        }

        const limitedItems = filteredItems.slice(0, BATCH_SIZE);
        if (limitedItems.length === 0) {
          console.debug('[InfiniteGallery] No additional items to append; stopping inf-scroll.');
          setHasMore(false);
          return;
        }

        let nextLength = 0;
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const deduped = limitedItems.filter((i) => !existingIds.has(i.id));
          deduped.sort((a, b) => b.hearts - a.hearts);
          nextLength = prev.length + deduped.length;
          return [...prev, ...deduped];
        });

        setOffset(batchOffset + fetchLimit);
        if (total !== null && nextLength >= total) {
          console.debug('[InfiniteGallery] All items loaded based on Supabase count.');
          setHasMore(false);
        }
      } catch (err) {
        console.error('[InfiniteGallery] Failed to load items', err);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [total]
  );

  // initial load
  const initLoad = useCallback(async () => {
    setLoading(true);
    try {
      const count = await getSharedCardsCount();
      setTotal(count);
      if (count === 0) {
        setHasMore(false);
        return;
      }
      const fetchLimit = BATCH_SIZE * FETCH_MULTIPLIER;
      const maxStart = Math.max(0, count - fetchLimit);
      const start = Math.floor(Math.random() * (maxStart + 1));
      await fetchBatch(start);
    } catch (err) {
      console.error('[InfiniteGallery] init error', err);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchBatch]);

  useEffect(() => {
    initLoad();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // load more helper
  const loadMore = useCallback(() => {
    console.debug('[InfiniteGallery] loadMore called', { loading, hasMore, offset, total });
    if (loading || !hasMore || offset === null) return;
    fetchBatch(offset);
  }, [loading, hasMore, offset, fetchBatch]);

  // scroll listener
  useEffect(() => {
    if (!hasMore) return;
    const onScroll = () => {
      const { innerHeight, scrollY } = window;
      const docHeight = document.documentElement.offsetHeight;
      if (docHeight - (innerHeight + scrollY) < 300) {
        console.debug('[InfiniteGallery] Near bottom, attempting loadMore');
        loadMore();
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasMore, loadMore]);

  if (!loading && items.length === 0) {
    return (
      <Box sx={{ mt: 6, textAlign: 'center' }}>{t('gallery.noImages')}</Box>
    );
  }

  // like/unlike handler
  const handleHeartClick = async (item: GalleryItem) => {
    if (pendingIds.has(item.id)) return;
    const alreadyLiked = likedIds.has(item.id);

    // optimistic update
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? { ...it, hearts: Math.max(it.hearts + (alreadyLiked ? -1 : 1), 0) }
          : it
      )
    );
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (alreadyLiked) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    setPendingIds((prev) => new Set(prev).add(item.id));

    try {
      const newCount = alreadyLiked
        ? await decrementHeart(item.id)
        : await incrementHeart(item.id);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, hearts: newCount } : it))
      );
    } catch (err) {
      console.error('Failed to update heart', err);
      // rollback
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== item.id) return it;
          const correction = alreadyLiked ? 1 : -1;
          return { ...it, hearts: Math.max(it.hearts + correction, 0) };
        })
      );
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <>
      <ImageList variant="masonry" cols={cols} gap={8}>
        {items.map((item) => (
          <ImageListItem key={item.id} sx={{ position: 'relative' }}>
            <img
              src={item.imageUrl}
              alt={item.childStatusAt18}
              loading="lazy"
              style={{ borderRadius: 8, width: '100%', height: 'auto' }}
              onError={(e) => console.error('[InfiniteGallery] Image failed', e)}
            />
            <Caption>{item.childStatusAt18}</Caption>
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <IconButton
                size="small"
                sx={{
                  color: likedIds.has(item.id) ? '#e91e63' : 'rgba(255,255,255,0.85)',
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    color: '#e91e63',
                  },
                  transition: 'all 0.2s ease',
                }}
                onClick={() => handleHeartClick(item)}
              >
                {likedIds.has(item.id) ? (
                  <FavoriteIcon fontSize="small" />
                ) : (
                  <FavoriteBorderIcon fontSize="small" />
                )}
              </IconButton>
              {item.hearts > 0 && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'common.white',
                    fontWeight: 600,
                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {item.hearts}
                </Typography>
              )}
            </Box>
          </ImageListItem>
        ))}
      </ImageList>
      {loading && items.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </>
  );
};

export default InfiniteGallery;
