import React from 'react';
import { Box, Container, Link, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const GUIDE_PATHS: Record<string, { howToPlay: string; tips: string; faq: string; about: string }> = {
  en: {
    howToPlay: '/guide/how-to-play.html',
    tips: '/guide/tips.html',
    faq: '/guide/faq.html',
    about: '/guide/about.html',
  },
  zh: {
    howToPlay: '/guide/how-to-play-zh.html',
    tips: '/guide/tips-zh.html',
    faq: '/guide/faq-zh.html',
    about: '/guide/about-zh.html',
  },
  ja: {
    howToPlay: '/guide/how-to-play-ja.html',
    tips: '/guide/tips-ja.html',
    faq: '/guide/faq-ja.html',
    about: '/guide/about-ja.html',
  },
  es: {
    howToPlay: '/guide/how-to-play-es.html',
    tips: '/guide/tips-es.html',
    faq: '/guide/faq-es.html',
    about: '/guide/about-es.html',
  },
};

const LABELS: Record<string, { howToPlay: string; tips: string; faq: string; about: string; heading: string }> = {
  en: { howToPlay: 'How to play', tips: 'Tips & strategies', faq: 'FAQ', about: 'About the game', heading: 'Guides' },
  zh: { howToPlay: '玩法说明', tips: '攻略与技巧', faq: '常见问题', about: '关于游戏', heading: '游戏指南' },
  ja: { howToPlay: '遊び方', tips: '攻略のヒント', faq: 'よくある質問', about: 'ゲームについて', heading: 'ガイド' },
  es: { howToPlay: 'Cómo jugar', tips: 'Consejos y estrategias', faq: 'Preguntas frecuentes', about: 'Sobre el juego', heading: 'Guías' },
};

export const SiteFooter: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').split('-')[0];
  const paths = GUIDE_PATHS[lang] ?? GUIDE_PATHS.en;
  const labels = LABELS[lang] ?? LABELS.en;
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      role="contentinfo"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: { xs: 1.5, sm: 3 },
            justifyContent: 'center',
            alignItems: 'center',
            mb: 1,
          }}
        >
          <Typography component="span" variant="body2" sx={{ color: '#5D4037', fontWeight: 600, mr: 0.5 }}>
            {labels.heading}:
          </Typography>
          <Link href={paths.howToPlay} underline="hover" sx={{ color: '#5D4037', fontSize: '0.9rem' }}>
            {labels.howToPlay}
          </Link>
          <Link href={paths.tips} underline="hover" sx={{ color: '#5D4037', fontSize: '0.9rem' }}>
            {labels.tips}
          </Link>
          <Link href={paths.faq} underline="hover" sx={{ color: '#5D4037', fontSize: '0.9rem' }}>
            {labels.faq}
          </Link>
          <Link href={paths.about} underline="hover" sx={{ color: '#5D4037', fontSize: '0.9rem' }}>
            {labels.about}
          </Link>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'rgba(93,64,55,0.7)' }}>
          © {year} BabySim
        </Typography>
      </Container>
    </Box>
  );
};
