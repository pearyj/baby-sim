# Baby Raising Simulator

A React-based simulation game where you make decisions to raise a virtual baby. The game uses AI models to generate scenarios, outcomes, and story progression.

## Features

- **Multi-Provider AI Support**: Switch between OpenAI, DeepSeek, and Volcengine (火山引擎) models
- **Dynamic Story Generation**: AI-generated scenarios and outcomes based on your choices
- **Real-time Model Switching**: Compare different AI models' responses during gameplay
- **Token Usage Tracking**: Monitor API usage and costs

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd baby-raising-simulator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Keys**
   Create a `.env` file in the project root with your API keys:
   ```env
   # OpenAI API Configuration
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   
   # DeepSeek API Configuration  
   VITE_DEEPSEEK_API_KEY=your_deepseek_api_key_here
   
   # Volcengine API Configuration
   VITE_VOLCENGINE_API_KEY=your_volcengine_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

## API Provider Configuration

### Volcengine (火山引擎) with DeepSeek V3
Volcengine is ByteDance's cloud platform providing access to DeepSeek V3 and other AI models:
- **Documentation**: [Volcengine API Reference](https://www.volcengine.com/docs/82379/1544106)
- **Endpoint**: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- **Model**: `deepseek-v3-250324` - A powerful MoE model with 671B parameters, 37B activated
- **Key Benefits**: Cost-effective access to DeepSeek V3 with enterprise-grade infrastructure

### DeepSeek Direct API
Direct access to DeepSeek's own API platform:
- **Documentation**: [DeepSeek API Docs](https://api-docs.deepseek.com/)
- **Endpoint**: `https://api.deepseek.com/v1/chat/completions`
- **Model**: `deepseek-chat` (maps to DeepSeek V3)
- **Advantages**: Often lower latency, direct from source

### OpenAI
- **Documentation**: [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Models**: `gpt-4`, `gpt-3.5-turbo`, etc.

## Model Switching

The application supports switching between AI providers:
- In development mode, use the model switcher component in the UI
- Models automatically cycle: OpenAI → DeepSeek → Volcengine → OpenAI
- Current provider is configurable in `src/config/api.ts`

## Development

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **AI Integration**: OpenAI-compatible APIs
- **State Management**: React hooks

### Project Structure
```
src/
├── components/          # React components
├── config/             # API configuration
├── services/           # AI service integration
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── main.tsx           # Application entry point
```

For more details about model switching, see [MODEL_SWITCHING.md](./MODEL_SWITCHING.md).

---

## Original Vite Template Information

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
