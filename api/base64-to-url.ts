import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin.js';
import { applyCors, handlePreflight, rateLimit } from './_utils.js';

export interface Base64ToUrlResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
  storageKey?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  applyCors(req, res);
  if (!rateLimit(req, res, 'base64-to-url', 60)) return;

  try {
    const { imageBase64, filename } = req.body;

    // 验证必需参数
    if (!imageBase64) {
      return res.status(400).json({ 
        success: false, 
        error: 'imageBase64 is required' 
      });
    }

    // 验证base64格式
    if (!imageBase64.startsWith('data:image/')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid base64 format. Must start with data:image/' 
      });
    }

    // 1. 处理base64数据
    const base64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
    
    let binary: string;
    try {
      binary = atob(base64);
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid base64 encoding' 
      });
    }

    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binary.charCodeAt(i);
    }

    // 检测图片类型
    const imageType = imageBase64.match(/data:image\/([^;]+)/)?.[1] || 'png';
    const contentType = `image/${imageType}`;
    const imageBlob = new Blob([buffer], { type: contentType });

    // 2. 生成存储路径
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().substring(0, 8);
    const fileExtension = imageType === 'jpeg' ? 'jpg' : imageType;
    const storageKey = filename 
      ? `uploads/${filename}-${timestamp}-${randomId}.${fileExtension}`
      : `uploads/image-${timestamp}-${randomId}.${fileExtension}`;

    // 3. 上传到Supabase Storage
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('ending-cards')
      .upload(storageKey, imageBlob, {
        contentType,
        upsert: false,
      });

    if (uploadErr) {
      console.error('Failed to upload image to storage:', uploadErr);
      return res.status(500).json({ 
        success: false, 
        error: uploadErr.message 
      });
    }

    // 4. 创建数据库记录以支持RLS策略
    const recordId = crypto.randomUUID();
    const { error: insertErr } = await supabaseAdmin.from('ending_cards').insert({
      id: recordId,
      child_status_at_18: 'Base64 to URL conversion',
      parent_review: 'Uploaded via API',
      outlook: 'Image uploaded via base64-to-url API',
      image_path: storageKey,
      share_ok: true, // 允许公开访问
    });

    if (insertErr) {
      console.error('Failed to create database record for image:', insertErr);
      // 清理已上传的文件
      await supabaseAdmin.storage.from('ending-cards').remove([storageKey]);
      return res.status(500).json({ 
        success: false, 
        error: insertErr.message 
      });
    }

    // 5. 获取公共URL
    const { data: urlData } = supabaseAdmin.storage
      .from('ending-cards')
      .getPublicUrl(storageKey);

    if (!urlData?.publicUrl) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get public URL' 
      });
    }

    console.log(`Image uploaded successfully:`, urlData.publicUrl);
    
    return res.status(200).json({
      success: true,
      imageUrl: urlData.publicUrl,
      storageKey
    });

  } catch (error) {
    console.error('Error in base64-to-url API:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}