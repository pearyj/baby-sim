# Prompt Internationalization System

This document describes the internationalized prompt system implemented for the Baby Simulator game.

## Overview

The prompt system separates all LLM prompts from the code and organizes them into locale-specific files, allowing the game to generate prompts in different languages based on the user's language preference.

## Architecture

### File Structure

```
src/
├── i18n/
│   ├── prompts/
│   │   ├── zh.json          # Chinese prompts
│   │   └── en.json          # English prompts
│   ├── locales/
│   │   ├── zh.json          # Chinese UI translations
│   │   └── en.json          # English UI translations
│   └── index.ts             # i18n configuration
├── services/
│   └── promptService.ts     # Prompt loading and interpolation service
└── utils/
    └── promptChecker.ts     # Prompt validation utilities
```

### Key Components

1. **Prompt Files** (`src/i18n/prompts/`)
   - Organized by language (zh.json, en.json)
   - Structured by prompt type (system, question, outcome, etc.)
   - Support variable interpolation with `{{variable}}` syntax

2. **Prompt Service** (`src/services/promptService.ts`)
   - Loads locale-specific prompts
   - Handles variable interpolation
   - Provides fallback mechanisms
   - Exports functions for each prompt type

3. **GPT Service Integration** (`src/services/gptServiceUnified.ts`)
   - Updated to use the prompt service
   - Maintains the same API interface
   - Automatically switches language based on user preference

## Prompt Types

### System Prompts
- `system.main`: Core system prompt defining the AI's role and behavior

### Question Prompts
- `question.base`: Base template for generating parenting questions
- `question.detailedRequirements`: Additional requirements for detailed mode
- `question.formatDetailed`: JSON format specification for detailed responses
- `question.formatSimple`: JSON format specification for simple responses

### Outcome Prompts
- `outcome.base`: Base template for generating choice outcomes
- `outcome.withNextQuestion`: Template when next question is needed
- `outcome.withoutNextQuestion`: Template for final outcomes
- `outcome.bankruptcy`: Special template for bankruptcy scenarios

### Initial State Prompts
- `initialState.base`: Template for generating initial game state
- `initialState.withRequirements`: Additional template for special requirements
- `initialState.format`: JSON format specification

### Ending Prompts
- `ending.base`: Template for generating game endings
- `ending.formatPrefix`: Template for formatting ending results

## Variable Interpolation

The system supports dynamic variable replacement using double curly braces:

```json
{
  "question": {
    "base": "Player: {{playerGender}} ({{playerAge}} years old)\nChild: {{childName}} ({{childGender}}, {{childAge}} years old)"
  }
}
```

Variables are replaced at runtime with actual game state values.

## Language Detection and Fallback

1. **Primary Language**: Uses the current i18n language setting
2. **English Fallback**: If a prompt is missing in the current language, falls back to English
3. **Chinese Fallback**: If still missing, falls back to Chinese
4. **Error Handling**: Returns a placeholder if prompt is missing in all languages

## Usage Examples

### Basic Prompt Generation

```typescript
import { generateSystemPrompt, generateQuestionPrompt } from '../services/promptService';

// Generate system prompt in current language
const systemPrompt = generateSystemPrompt();

// Generate question prompt with game state
const questionPrompt = generateQuestionPrompt(gameState, true);
```

### Checking for Missing Prompts

```typescript
import { checkAllPrompts } from '../utils/promptChecker';

// Check for missing prompts in development
if (process.env.NODE_ENV === 'development') {
  checkAllPrompts();
}
```

## Adding New Prompts

1. **Add to Chinese file** (`src/i18n/prompts/zh.json`):
   ```json
   {
     "newSection": {
       "newPrompt": "新的中文提示模板 {{variable}}"
     }
   }
   ```

2. **Add to English file** (`src/i18n/prompts/en.json`):
   ```json
   {
     "newSection": {
       "newPrompt": "New English prompt template {{variable}}"
     }
   }
   ```

3. **Update prompt service** if needed to add new generation functions

4. **Test the new prompts** using the prompt checker utility

## Best Practices

### Prompt Organization
- Group related prompts under logical sections
- Use descriptive key names (e.g., `question.base`, not `q1`)
- Keep the structure consistent between languages

### Variable Naming
- Use camelCase for variable names
- Choose descriptive names (e.g., `{{playerAge}}`, not `{{age}}`)
- Document expected variable types in comments

### Translation Guidelines
- Maintain the same meaning and tone across languages
- Preserve all variable placeholders
- Consider cultural context and appropriateness
- Test prompts with actual game scenarios

### Fallback Strategy
- Always provide Chinese and English versions
- Chinese serves as the ultimate fallback
- Log warnings when fallbacks are used
- Monitor logs for missing prompts

## Validation and Testing

### Automated Checks
- `checkAllPrompts()`: Validates prompt completeness across languages
- `testPromptGeneration()`: Tests prompt generation with sample data
- Development mode automatically runs validation

### Manual Testing
1. Switch language in the game
2. Start a new game session
3. Verify prompts are generated in the correct language
4. Check console for any fallback warnings

## Troubleshooting

### Common Issues

1. **Missing Prompt Error**
   - Check if the prompt key exists in all language files
   - Verify the key path is correct (e.g., `system.main`)
   - Run `checkAllPrompts()` to identify missing keys

2. **Variable Not Replaced**
   - Ensure variable name matches exactly (case-sensitive)
   - Check that the variable is passed to the interpolation function
   - Verify double curly brace syntax: `{{variableName}}`

3. **Wrong Language Prompts**
   - Check i18n language setting
   - Verify prompt files are properly imported
   - Ensure the language code matches the file names

### Debug Tools

```typescript
// Check current language
import promptService from '../services/promptService';
console.log('Current language:', promptService.getCurrentLanguage());

// Check for missing prompts
const missing = promptService.checkMissingPrompts('en');
console.log('Missing English prompts:', missing);
```

## Performance Considerations

- Prompt files are loaded at build time (static imports)
- Variable interpolation is performed at runtime
- Fallback lookups are cached within the same request
- No network requests for prompt loading

## Future Enhancements

1. **Additional Languages**: Easy to add new language files
2. **Dynamic Prompts**: Support for context-aware prompt variations
3. **Prompt Analytics**: Track which prompts are used most frequently
4. **A/B Testing**: Support for testing different prompt variations
5. **Prompt Versioning**: Track changes and rollback capabilities 