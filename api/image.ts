import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, rateLimit } from './_utils';

// Define response type for Doubao image generation API
interface DoubaoImageResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Doubao API configuration interface
interface DoubaoImageConfig {
  apiKey: string;
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
    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;

    // Validate required parameters
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Get Doubao API configuration (uses same key as LLM)
    const doubaoConfig: DoubaoImageConfig = {
      apiKey: process.env.VOLCENGINE_LLM_API_KEY || process.env.ARK_API_KEY || '',
    };

    if (!doubaoConfig.apiKey) {
      console.error('Doubao API key not configured');
      return res.status(500).json({ error: 'Image generation service not configured' });
    }

    // Map size parameter (Doubao requires at least 921600 pixels)
    // Only 1024x1024 (1048576 pixels) meets the minimum requirement
    const validSizes = ['1024x1024', '1920x640'];
    const finalSize = validSizes.includes(size) ? size : '1024x1024';
    
    // Log basic info (production safe)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎨 Making image generation request to Doubao API`);
      console.log(`📝 Prompt (truncated): ${prompt.substring(0, 100)}...`);
      console.log(`📏 Size: ${finalSize}, Quality: ${quality}`);
      
      // Debug: Log full prompt for debugging purposes (development only)
      console.group('🖼️ IMAGE GENERATION API DEBUG - Full Prompt');
      console.log('📝 Full Image Prompt:');
      console.log(prompt);
      console.log('📏 Prompt Length:', prompt.length, 'characters');
      console.log('⚙️ Generation Parameters:', {
        size: finalSize,
        quality
      });
      console.groupEnd();
    }

    // Make request to new Doubao API
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doubaoConfig.apiKey}`
      },
      body: JSON.stringify({
        model: 'doubao-seedream-4-0-250828',
        prompt: prompt,
        response_format: 'b64_json', // Changed from 'url' to 'b64_json' to match your existing flow
        size: finalSize,
        watermark: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Doubao API Error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: `Failed to generate image: ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json() as DoubaoImageResponse;

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Received image generation response from Doubao');
    }

    // Extract image data from response
    let imageBase64: string | undefined;
    let imageUrl: string | undefined;

    if (data.data && data.data.length > 0) {
      const imageData = data.data[0];
      imageBase64 = imageData.b64_json;
      imageUrl = imageData.url;
    }

    if (!imageBase64 && !imageUrl) {
      console.error('❌ No image data in response:', data);
      return res.status(500).json({ 
        error: 'No image data received from Doubao API',
        details: data.error?.message || 'Unknown error'
      });
    }

    // Return success response
    return res.status(200).json({
      success: true,
      imageBase64,
      imageUrl,
      provider: 'doubao',
      model: 'doubao-seedream-3-0-t2i-250415',
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      size: finalSize,
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