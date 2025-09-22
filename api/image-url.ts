import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';
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

// Configuration interface for Doubao API
interface DoubaoImageConfig {
  apiKey: string;
}

// Response interface for this API
interface ImageUrlResponse {
  success: boolean;
  imageUrl?: string;
  filename?: string;
  provider: string;
  model: string;
  prompt: string;
  size: string;
  quality: string;
  error?: string;
  details?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res);
  if (!rateLimit(req, res, 'image-url', 30)) return;

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, size = '1024x1024', quality = 'standard', filename } = req.body;

    // Validate required parameters
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Validate filename if provided
    if (filename && typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename must be a string' });
    }

    // Generate default filename if not provided
    const finalFilename = filename || `image_${Date.now()}.png`;

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
      console.log(`🎨 Making image generation request to Doubao API (URL mode)`);
      console.log(`📝 Prompt (truncated): ${prompt.substring(0, 100)}...`);
      console.log(`📏 Size: ${finalSize}, Quality: ${quality}`);
      console.log(`📁 Filename: ${finalFilename}`);
      
      // Debug: Log full prompt for debugging purposes (development only)
      console.group('🖼️ IMAGE URL GENERATION API DEBUG - Full Prompt');
      console.log('📝 Full Image Prompt:');
      console.log(prompt);
      console.log('📏 Prompt Length:', prompt.length, 'characters');
      console.log('⚙️ Generation Parameters:', {
        size: finalSize,
        quality,
        filename: finalFilename,
        response_format: 'url'
      });
      console.groupEnd();
    }

    // Make request to Doubao API with URL response format
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doubaoConfig.apiKey}`
      },
      body: JSON.stringify({
        model: 'doubao-seedream-4-0-250828',
        prompt: prompt,
        response_format: 'url', // Request URL instead of base64
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

    const data: DoubaoImageResponse = await response.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Received image generation response from Doubao (URL mode)');
    }

    // 检查是否有错误信息
    if (data.error) {
      console.error('❌ Doubao API returned error:', data.error);
      
      // 特殊处理敏感内容检测错误
      if (data.error.code === 'OutputImageSensitiveContentDetected') {
        return res.status(400).json({
          success: false,
          error: '图片生成失败：内容可能包含敏感信息，请尝试修改描述后重新生成',
          code: 'SENSITIVE_CONTENT_DETECTED'
        });
      }
      
      // 其他错误
      return res.status(500).json({
        success: false,
        error: data.error.message || '图片生成失败',
        code: data.error.code
      });
    }

    // 从响应中提取图片URL
    const doubaoImageUrl = data.data?.[0]?.url;
    if (!doubaoImageUrl) {
      console.error('No image URL in response:', data);
      return res.status(500).json({
        success: false,
        error: 'No image URL returned from API'
      });
    }

    console.log('✅ Image generated by Doubao:', doubaoImageUrl);

    // 下载豆包返回的图片
    const imageResponse = await fetch(doubaoImageUrl);
    if (!imageResponse.ok) {
      console.error('Failed to fetch image from Doubao URL:', doubaoImageUrl);
      return res.status(500).json({
        success: false,
        error: 'Failed to download generated image'
      });
    }

    const imageBlob = await imageResponse.blob();
    
    // 生成存储路径，使用用户指定的filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().substring(0, 8);
    // 从finalFilename中提取文件名（去掉扩展名）
    const baseFilename = finalFilename.replace(/\.[^/.]+$/, '');
    const storageKey = `uploads/${baseFilename}-${timestamp}-${randomId}.png`;

    // 上传到我们的Supabase Storage
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('ending-cards')
      .upload(storageKey, imageBlob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadErr) {
      console.error('Failed to upload image to storage:', uploadErr);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload image to storage'
      });
    }

    // 创建数据库记录以支持RLS策略
    const recordId = crypto.randomUUID();
    const { error: insertErr } = await supabaseAdmin.from('ending_cards').insert({
      id: recordId,
      child_status_at_18: 'Generated via image-url API',
      parent_review: 'AI generated image',
      outlook: `Image generated with prompt: ${prompt.substring(0, 100)}...`,
      image_path: storageKey,
      share_ok: true,
    });

    if (insertErr) {
      console.error('Failed to create database record for image:', insertErr);
      // 清理已上传的文件
      await supabaseAdmin.storage.from('ending-cards').remove([storageKey]);
      return res.status(500).json({
        success: false,
        error: 'Failed to create database record'
      });
    }

    // 获取我们域名的公共URL
    const { data: urlData } = supabaseAdmin.storage
      .from('ending-cards')
      .getPublicUrl(storageKey);

    if (!urlData?.publicUrl) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get public URL'
      });
    }

    console.log('✅ Image uploaded to our storage:', urlData.publicUrl);

    return res.status(200).json({
      success: true,
      imageUrl: urlData.publicUrl
    });

  } catch (error: any) {
    console.error('❌ Image URL generation error:', error);
    
    return res.status(500).json({
      error: 'Failed to generate image URL',
      details: error.message || 'Unknown error',
    });
  }
}