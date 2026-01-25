import React from 'react';
import { Backdrop, Box, Divider, Fade, Paper, Stack, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface AnnouncementOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const AnnouncementOverlay: React.FC<AnnouncementOverlayProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!open) return null;

  const paragraphs = [
    t('announcement.body1'),
    t('announcement.body2'),
    t('announcement.body3'),
    t('announcement.body4'),
  ].filter(text => text && text.trim() !== ''); // Filter out empty paragraphs

  return (
    <Backdrop
      open={open}
      onClick={onClose}
      sx={{
        color: '#fff',
        zIndex: theme.zIndex.modal + 2,
        background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 25%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.06), transparent 25%), rgba(17, 10, 31, 0.75)',
        backdropFilter: 'blur(3px)',
        p: { xs: 2, sm: 3 },
      }}
    >
      <Fade in={open} timeout={200}>
        <Paper
          elevation={8}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          sx={{
            maxWidth: 760,
            width: 'min(740px, 100%)',
            p: { xs: 3, sm: 4 },
            borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(247,242,255,0.94) 100%)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            cursor: 'pointer',
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Stack spacing={2.5}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="overline"
                sx={{ letterSpacing: 1.1, color: theme.palette.primary.main, fontWeight: 700 }}
              >
                {t('header.title')}
              </Typography>
              <Typography
                variant="h5"
                component="h2"
                sx={{ mt: 0.5, fontWeight: 700, color: theme.palette.text.primary }}
              >
                {t('announcement.title')}
              </Typography>
            </Box>

            <Divider />

            <Stack spacing={1.5}>
              {paragraphs.map((text, idx) => (
                <Typography
                  key={idx}
                  variant="body1"
                  sx={{ lineHeight: 1.7, color: theme.palette.text.secondary, textAlign: 'left' }}
                >
                  {text}
                </Typography>
              ))}
            </Stack>

            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                textAlign: 'center',
              }}
            >
              {t('announcement.dismissHint')}
            </Typography>
          </Stack>
        </Paper>
      </Fade>
    </Backdrop>
  );
};
