# Baby Raising Simulator

An open-source, AI-powered text game with meta systems, ending, optional image generation, and optional payments. This React-based simulation game allows you to make decisions to raise a virtual baby, using AI models to generate scenarios, outcomes, and story progression. 

The game is currently accessible at https://www.babysim.fun/. Please feel free to play the game as it is. There are many other possible AI-powered text and image based games that could this code base as a starting point, and I hope to see as many such games as possible.

## Features

- **Multi-Provider AI Support**: Switch between OpenAI and DeepSeek (provided by Volcengine) models
- **Meta Systems**: Enhanced gameplay mechanics
- **Multiple Endings**: Diverse story outcomes
- **Optional Image Generation**: Visual representation of key moments
- **Payment Integration**: Support for premium features
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

### OpenAI
- **Documentation**: [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Models**: `gpt-4`, `gpt-3.5-turbo`, etc.

## Model Switching in development

The application supports switching between AI providers:
- In development mode, use the model switcher component in the UI
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- OpenAI for GPT models
- Volcano Engine for Deepseek LLM and image generation
- Stripe for payment processing
- Supabase for database and authentication
- Vercel for deployment

## About Vibe Coding

This project was created using the "vibe coding" approach. Vibe coding is a development methodology that emphasizes intuition, creativity, and rapid iteration. It involves:

1. Quickly prototyping ideas
2. Embracing imperfection in early stages
3. Iterating based on feel and user feedback
4. Balancing structure with flexibility

By using vibe coding, we were able to rapidly develop this AI-powered game, incorporating various features and technologies in an organic, evolving manner.

## Expanding the ESLint configuration

[The rest of the ESLint configuration section remains unchanged]
