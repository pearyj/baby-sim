# Model Switching Feature

This codebase now supports switching between OpenAI, DeepSeek, and Volcengine models. Here's how to use this feature:

## Configuration

1. In your `.env` file, add the following variables:
   ```
   VITE_OPENAI_API_KEY=your_openai_api_key
   VITE_DEEPSEEK_API_KEY=your_deepseek_api_key
   VITE_VOLCENGINE_API_KEY=your_volcengine_api_key
   ```

2. The configuration in `src/config/api.ts` includes:
   - API endpoints for all three providers
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

// Switch between models (cycles through openai -> deepseek -> volcengine -> openai...)
switchProvider();

// Get current model info
const modelName = getCurrentModel();

// Get detailed provider info
const provider = getActiveProvider();
```

## How It Works

The system uses a common interface for all three API providers but directs requests to the appropriate endpoint based on the active provider setting. All your existing code continues to work without changes - the routing to the appropriate API happens automatically.

## Models

- **OpenAI**: Currently using `gpt-4.1-mini`
- **DeepSeek**: Currently using `deepseek-chat` (DeepSeek V3 via direct API)
- **Volcengine**: Currently using `deepseek-v3` (DeepSeek V3 via Volcengine's platform)

You can change the model names in `src/config/api.ts`.

## Provider Details

### Volcengine (火山引擎) with DeepSeek V3
Volcengine is ByteDance's cloud platform that provides access to various AI models including DeepSeek V3. The API is compatible with OpenAI's interface format, making integration seamless.

- **API Endpoint**: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- **Documentation**: [Volcengine API Docs](https://www.volcengine.com/docs/82379/1544106)
- **Model**: DeepSeek V3 - A powerful open-source MoE model with 671B parameters and 37B activated parameters
- **Key Features**: 
  - High performance comparable to GPT-4o and Claude-3.5-Sonnet
  - Cost-effective inference
  - Strong reasoning and coding capabilities
  - Multi-language support

### DeepSeek Direct API
Access to DeepSeek models through their official API endpoint.

- **API Endpoint**: `https://api.deepseek.com/v1/chat/completions`
- **Documentation**: [DeepSeek API Docs](https://api-docs.deepseek.com/)
- **Model**: `deepseek-chat` (maps to DeepSeek V3)
- **Advantages**: Direct access, often lower latency in some regions

### OpenAI
The original ChatGPT API for comparison and fallback.

- **API Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Documentation**: [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- **Model**: `gpt-4.1-mini`

## Performance Notes

DeepSeek V3 offers:
- Performance comparable to GPT-4o and Claude-3.5-Sonnet
- Significantly lower API costs compared to OpenAI
- Strong performance in:
  - Mathematical reasoning
  - Code generation and debugging
  - Long-context understanding
  - Multilingual tasks
  - Complex reasoning chains 