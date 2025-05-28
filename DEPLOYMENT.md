# Secure Deployment Guide for Vercel

This guide shows how to deploy your baby-raising-simulator securely using Vercel serverless functions to protect your API keys.

## 🔒 Security Overview

Your app now uses **serverless functions** to keep API keys secure:
- ✅ API keys are stored as environment variables on Vercel (server-side only)
- ✅ Client-side code never exposes API keys
- ✅ All AI API calls go through your secure serverless function
- ✅ CORS protection and error handling included

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **API Keys**: Get your API keys from:
   - OpenAI: [platform.openai.com](https://platform.openai.com)
   - DeepSeek: [platform.deepseek.com](https://platform.deepseek.com)
   - Volcengine: [console.volcengine.com](https://console.volcengine.com)

## 🚀 Deployment Steps

### 1. Install Vercel CLI (Optional)
```bash
npm install -g vercel
```

### 2. Deploy to Vercel

**Option A: GitHub Integration (Recommended)**
1. Push your code to GitHub
2. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will auto-detect it's a Vite project

**Option B: CLI Deployment**
```bash
vercel --prod
```

### 3. Configure Environment Variables

In your Vercel dashboard:
1. Go to your project → Settings → Environment Variables
2. Add these **Production** environment variables:

```
OPENAI_API_KEY=your_actual_openai_key
DEEPSEEK_API_KEY=your_actual_deepseek_key  
VOLCENGINE_API_KEY=your_actual_volcengine_key
```

⚠️ **Important**: These are server-side only and will never be exposed to clients.

### 4. Redeploy
After adding environment variables, trigger a new deployment:
- **GitHub**: Push a new commit
- **CLI**: Run `vercel --prod` again

## 🔧 Configuration Options

### Active Provider
Edit `src/config/api.ts` to change the default AI provider:
```typescript
ACTIVE_PROVIDER: 'volcengine', // Options: 'openai', 'deepseek', 'volcengine'
```

### Development Mode
For local development with direct API calls:
1. Create `.env.local`:
```bash
VITE_DIRECT_API_MODE=true
VITE_VOLCENGINE_API_KEY=your_key_here
```
2. Run `npm run dev`

## 🛡️ Security Features

### API Key Protection
- ✅ Server-side environment variables only
- ✅ No client-side API key exposure
- ✅ Secure serverless function proxy

### CORS Protection
- ✅ Proper CORS headers configured
- ✅ Method validation (POST only)
- ✅ Request body validation

### Error Handling
- ✅ Sanitized error messages
- ✅ No sensitive data in client errors
- ✅ Comprehensive logging

## 📊 Monitoring

### Check Deployment Status
```bash
vercel ls
vercel logs your-project-name
```

### Test API Endpoint
Your serverless function will be available at:
```
https://your-app.vercel.app/api/chat
```

### Performance Monitoring
- Monitor function execution time in Vercel dashboard
- Check error rates and logs
- Set up alerts for failures

## 🔍 Troubleshooting

### Common Issues

**1. "API key not configured" Error**
- Check environment variables are set in Vercel dashboard
- Ensure variable names match exactly
- Redeploy after adding variables

**2. CORS Errors**
- Serverless function includes CORS headers
- Check browser console for specific errors

**3. Function Timeout**
- Vercel free tier: 10s timeout
- Pro tier: 60s timeout
- Optimize prompts if hitting limits

**4. Rate Limiting**
- Implement client-side rate limiting
- Consider caching responses
- Monitor API usage

### Debug Mode
Enable detailed logging by checking browser console and Vercel function logs.

## 💰 Cost Optimization

### Vercel Costs
- **Free tier**: 100GB bandwidth, 100 function executions/day
- **Pro tier**: $20/month for higher limits

### AI API Costs
- Monitor token usage in your AI provider dashboards
- Optimize prompts for efficiency
- Consider implementing response caching

## 🔄 Updates and Maintenance

### Regular Updates
```bash
npm audit
npm update
```

### Security Monitoring
- Regularly rotate API keys
- Monitor for unusual API usage
- Keep dependencies updated

### Backup Strategy
- Environment variables are backed up in Vercel
- Source code in Git repository
- Consider exporting game data periodically

## 📞 Support

If you encounter issues:
1. Check Vercel function logs
2. Verify environment variables
3. Test API endpoints directly
4. Check AI provider status pages

---

**🎉 Your app is now securely deployed with protected API keys!** 