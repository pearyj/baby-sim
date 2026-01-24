import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SEOConfig {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
}

const BASE_URL = 'https://babysim.fun';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

const defaultDescriptions: Record<string, string> = {
  en: 'Experience the journey of parenthood in this AI-powered text-based simulation game. Make parenting decisions from birth to age 18.',
  zh: 'AI驱动的文字养育模拟游戏，体验从出生到18岁的育儿旅程。每个决定都会影响孩子的未来。',
  ja: 'AIパワードのテキストベース育児シミュレーションゲーム。出生から18歳までの育児の旅を体験しましょう。',
  es: 'Experimenta el viaje de la paternidad en este juego de simulacion basado en texto con IA. Toma decisiones de crianza desde el nacimiento hasta los 18 anos.',
};

const defaultTitles: Record<string, string> = {
  en: 'Baby Simulator - AI Parenting Game | Raise Your Virtual Child',
  zh: '养娃模拟器 - AI育儿游戏 | 养育你的虚拟孩子',
  ja: 'ベビーシミュレーター - AI子育てゲーム | バーチャル育児体験',
  es: 'Simulador de Bebe - Juego de Crianza con IA | Cria a tu Hijo Virtual',
};

/**
 * Custom hook for managing SEO meta tags dynamically
 * Updates document title and meta tags based on current page/state
 */
export function useSEO(config?: SEOConfig) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';

  useEffect(() => {
    const title = config?.title || defaultTitles[lang] || defaultTitles.en;
    const description = config?.description || defaultDescriptions[lang] || defaultDescriptions.en;
    const canonicalUrl = `${BASE_URL}${config?.path || ''}`;
    const image = config?.image || DEFAULT_IMAGE;

    // Update document title
    document.title = title;

    // Update meta tags
    updateMetaTag('name', 'description', description);
    updateMetaTag('name', 'title', title);

    // Update Open Graph tags
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:url', canonicalUrl);
    updateMetaTag('property', 'og:image', image);
    updateMetaTag('property', 'og:locale', getLocale(lang));

    // Update Twitter tags
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', image);
    updateMetaTag('name', 'twitter:url', canonicalUrl);

    // Update canonical link
    updateCanonicalLink(canonicalUrl);

    // Update html lang attribute
    document.documentElement.lang = lang;

  }, [config?.title, config?.description, config?.path, config?.image, lang]);
}

function updateMetaTag(attr: 'name' | 'property', key: string, value: string) {
  let element = document.querySelector(`meta[${attr}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

function updateCanonicalLink(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

function getLocale(lang: string): string {
  const locales: Record<string, string> = {
    en: 'en_US',
    zh: 'zh_CN',
    ja: 'ja_JP',
    es: 'es_ES',
  };
  return locales[lang] || 'en_US';
}

/**
 * Hook for game-specific SEO when a child name is known
 */
export function useGameSEO(childName?: string, age?: number) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';

  const config: SEOConfig = childName
    ? {
        title: `Raising ${childName}${age ? ` (Age ${age})` : ''} | Baby Simulator`,
        description: `Follow the journey of raising ${childName} in Baby Simulator. Make meaningful parenting decisions and see how your choices shape their future.`,
        path: '/',
      }
    : undefined;

  useSEO(config);
}

export default useSEO;
