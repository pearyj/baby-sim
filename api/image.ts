import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, rateLimit } from './_utils';
import { Service } from '@volcengine/openapi';

// Define response type for comic API
interface ComicResponse {
  ImageUrls?: string[];
  Images?: string[];
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Volcano Engine configuration interface
interface VolcEngineImageConfig {
  apiKey: string;
  secretKey: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);
  if (!rateLimit(req, res, 'image', 30)) return;

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, size = '768x768', quality = 'standard' } = req.body;

    // Validate required parameters
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get provider configuration
    const volcengineConfig: VolcEngineImageConfig = {
      apiKey: process.env.VOLCENGINE_VISUAL_API_KEY || '',
      secretKey: process.env.VOLCENGINE_VISUAL_SECRET_KEY || '',
    };

    if (!volcengineConfig.apiKey || !volcengineConfig.secretKey) {
      console.error('Volcano Engine credentials not configured');
      return res.status(500).json({ error: 'Image generation service not configured' });
    }

    // Parse size dimensions
    const [width, height] = size.split('x').map(Number);
    const scale = quality === 'hd' ? 7.5 : 5.0;

    // Initialize Volcano Engine client
    const client = new Service({ 
      region: 'cn-north-1',
      serviceName: 'cv',
      host: 'visual.volcengineapi.com'
    });
    
    // Set credentials
    client.setAccessKeyId(volcengineConfig.apiKey);
    client.setSecretKey(volcengineConfig.secretKey);

    // Log basic info (production safe)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎨 Making image generation request to Volcano Engine Text-to-Image API`);
      console.log(`📝 Prompt (truncated): ${prompt.substring(0, 100)}...`);
      console.log(`📏 Size: ${width}x${height}, Quality: ${quality}`);
      
      // Debug: Log full prompt for debugging purposes (development only)
      console.group('🖼️ IMAGE GENERATION API DEBUG - Full Prompt');
      console.log('📝 Full Image Prompt:');
      console.log(prompt);
      console.log('📏 Prompt Length:', prompt.length, 'characters');
      console.log('⚙️ Generation Parameters:', {
        width,
        height,
        scale,
        size,
        quality
      });
      console.groupEnd();
    }

    // Make request using fetchOpenAPI for proper URL handling
    const response = await client.fetchOpenAPI({
      Action: 'CVProcess',
      Version: '2022-08-31',
      method: 'POST',
      data: {
        req_key: 'high_aes_general_v30l_zt2i',
        Prompt: prompt,
        Width: width,
        Height: height,
        Scale: scale,
        Steps: 25,
        Seed: -1,
        ReturnUrl: true,
        ModelVersion: "general_v3.0"
      }
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Received image generation response');
    }

    // Extract image data from response
    let imageBase64: string | undefined;

    if (response && (response as any).data && (response as any).data.binary_data_base64 && (response as any).data.binary_data_base64.length > 0) {
      imageBase64 = (response as any).data.binary_data_base64[0];
    }

    if (!imageBase64) {
      console.error('❌ No image data in response:', response);
      return res.status(500).json({ error: 'No image data received from Volcano Engine' });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      imageBase64,
      provider: 'volcengine',
      model: 'comic_v1.0',
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      size,
      quality,
    });

  } catch (error: any) {
    console.error('❌ Image generation error:', error);
    
    return res.status(500).json({
      error: 'Failed to generate image',
      details: error.message || 'Unknown error',
    });
  }
} 