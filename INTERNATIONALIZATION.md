# Internationalization (i18n) Implementation

This document describes the internationalization setup for the Baby Raising Simulator app, supporting both English and Chinese languages.

## Overview

The app uses `react-i18next` for internationalization, providing:
- Language toggle between English (en) and Chinese (zh)
- Persistent language preference in localStorage
- Automatic browser language detection
- Fallback to Chinese as the default language

## Setup

### Dependencies
- `react-i18next` - React integration for i18next
- `i18next` - Core internationalization framework
- `i18next-browser-languagedetector` - Browser language detection

### Configuration
The i18n configuration is located in `src/i18n/index.ts` and is automatically initialized when the app starts.

## Translation Files

Translation files are located in `src/i18n/locales/`:
- `zh.json` - Chinese translations (default)
- `en.json` - English translations

### Structure
```json
{
  "game": {
    "setup": "Game Setup:",
    "player": "Player:",
    "child": "Child:",
    // ... more game-related translations
  },
  "ui": {
    "languageToggle": "Language",
    "options": "Options",
    "question": "Question",
    // ... more UI translations
  },
  "header": {
    "title": "Baby Raising Simulator",
    "infoCenter": "Info Center",
    // ... more header translations
  }
}
```

## Components

### LanguageToggle
A dropdown component in the header that allows users to switch between languages.

**Location**: `src/components/ui/LanguageToggle.tsx`

**Usage**: Automatically included in the header, no additional setup required.

### StreamingTextDisplayI18n
An internationalized version of the StreamingTextDisplay component that automatically translates game content.

**Location**: `src/components/ui/StreamingTextDisplayI18n.tsx`

**Usage**:
```tsx
import { StreamingTextDisplayI18n } from '../components/ui';

<StreamingTextDisplayI18n
  content={gameContent}
  isStreaming={isStreaming}
  isComplete={isComplete}
  showTypewriter={true}
/>
```

## Hooks

### useGameTranslations
A custom hook that provides game-specific translation functions.

**Location**: `src/hooks/useGameTranslations.ts`

**Usage**:
```tsx
import { useGameTranslations } from '../hooks/useGameTranslations';

const { t, getGenderText, getWealthText, formatAge, getGameLabels } = useGameTranslations();

// Basic translation
const title = t('game.setup');

// Gender translation
const parentGender = getGenderText('male', true); // "Father" or "父亲"
const childGender = getGenderText('female', false); // "Girl" or "女孩"

// Wealth translation
const wealth = getWealthText('middle'); // "Middle Class" or "中产"

// Age formatting
const age = formatAge(25); // "25 years old" or "25岁"

// Game labels
const labels = getGameLabels(); // Object with all formatted labels
```

## Adding New Translations

1. **Add the key to both language files**:
   ```json
   // zh.json
   {
     "newSection": {
       "newKey": "中文翻译"
     }
   }
   
   // en.json
   {
     "newSection": {
       "newKey": "English translation"
     }
   }
   ```

2. **Use in components**:
   ```tsx
   import { useTranslation } from 'react-i18next';
   
   const { t } = useTranslation();
   const text = t('newSection.newKey');
   ```

## Best Practices

1. **Use descriptive keys**: `game.player` instead of `player`
2. **Group related translations**: Use nested objects for organization
3. **Provide fallbacks**: Always include fallback text for missing keys
4. **Test both languages**: Ensure UI layout works with both short and long text
5. **Use interpolation**: For dynamic content, use placeholders like `{username}`

## Language Detection

The app detects language in this order:
1. Previously saved language in localStorage
2. Browser language preference
3. Fallback to Chinese (zh)

## Switching Languages

Users can switch languages using the language toggle in the header. The preference is automatically saved and will persist across browser sessions.

## Migration Guide

To migrate existing components to use internationalization:

1. **Replace hardcoded strings**:
   ```tsx
   // Before
   <Typography>游戏设定</Typography>
   
   // After
   const { t } = useTranslation();
   <Typography>{t('game.setup')}</Typography>
   ```

2. **Use the game translations hook for game-specific content**:
   ```tsx
   // Before
   const genderText = gender === 'male' ? '父亲' : '母亲';
   
   // After
   const { getGenderText } = useGameTranslations();
   const genderText = getGenderText(gender, true);
   ```

3. **Update StreamingTextDisplay usage**:
   ```tsx
   // Before
   <StreamingTextDisplay content={content} />
   
   // After
   <StreamingTextDisplayI18n content={content} />
   ```

## Demo

A demo component is available at `src/components/demo/I18nDemo.tsx` that showcases all the internationalization features. 