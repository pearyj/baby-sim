import { useTranslation } from 'react-i18next';

export const useGameTranslations = () => {
  const { t, i18n } = useTranslation();

  const getGenderText = (gender: 'male' | 'female', isParent: boolean = false) => {
    if (isParent) {
      return gender === 'male' ? t('game.father') : t('game.mother');
    }
    return gender === 'male' ? t('game.boy') : t('game.girl');
  };

  const getWealthText = (wealthTier: 'poor' | 'middle' | 'wealthy') => {
    return t(`wealth.${wealthTier}`);
  };

  const formatAge = (age: number) => {
    return `${age}${t('game.yearsOld')}`;
  };

  const getGameLabels = () => ({
    setup: `**${t('game.setup')}**`,
    player: `**${t('game.player')}**`,
    child: `**${t('game.child')}**`,
    background: `**${t('game.background')}**`,
    childDescription: `**${t('game.childDescription')}**`,
    familyWealth: `**${t('game.familyWealth')}**`,
    options: `**${t('ui.options', '选项')}:**`, // Fallback for missing key
    question: `**${t('ui.question', '问题')}:**`, // Fallback for missing key
    generating: t('game.generating'),
    cost: t('ui.cost', '费用'), // Fallback for missing key
    importantEvent: t('ui.importantEvent', '⚠️ 这是一个重要事件'), // Fallback for missing key
  });

  return {
    t,
    i18n,
    getGenderText,
    getWealthText,
    formatAge,
    getGameLabels,
  };
}; 