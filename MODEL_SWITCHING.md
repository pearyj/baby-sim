# Model Switching Feature

This codebase now supports switching between OpenAI and DeepSeek models. Here's how to use this feature:

## Configuration

1. In your `.env` file, add the following variables:
   ```
   VITE_OPENAI_API_KEY=your_openai_api_key
   VITE_DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

2. The configuration in `src/config/api.ts` includes:
   - API endpoints for both providers
   - Model names
   - Active provider selection

## Switching Models

### In the UI
Use the `ModelSwitcher` component anywhere in your UI to display the current model and allow switching:

```jsx
import ModelSwitcher from './components/ModelSwitcher';

// In your component:
<ModelSwitcher />
```

### Programmatically
You can also switch models programmatically using functions from `gptService.ts`:

```typescript
import { switchProvider, getCurrentModel, getActiveProvider } from '../services/gptService';

// Switch between models
switchProvider();

// Get current model info
const modelName = getCurrentModel();

// Get detailed provider info
const provider = getActiveProvider();
```

## How It Works

The system uses a common interface for both API providers but directs requests to the appropriate endpoint based on the active provider setting. All your existing code continues to work without changes - the routing to the appropriate API happens automatically.

## Models

- OpenAI: Currently using `gpt-4.1-mini`
- DeepSeek: Currently using `deepseek-v3`

You can change the model names in `src/config/api.ts`. 