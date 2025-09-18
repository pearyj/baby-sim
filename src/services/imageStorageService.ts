import { supabase } from '../lib/supabase';
import logger from '../utils/logger';

/**
 * 图片存储服务 - 解决localStorage容量限制问题
 * 
 * 解决方案：
 * 1. 将base64图片上传到Supabase Storage获取URL
 * 2. 本地只存储URL而非base64数据
 * 3. 提供图片缓存和管理功能
 */

export interface ImageUploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export interface StoredImageData {
  age: number;
  imageUrl: string;
  uploadedAt: string;
  localCached?: boolean;
}

/**
 * 将base64图片上传到Supabase Storage
 * @param imageBase64 base64格式的图片数据
 * @param age 孩子的年龄（用于文件命名）
 * @param kidId 孩子的ID（用于文件夹组织）
 * @returns 上传结果，包含图片URL
 */
export const uploadImageToStorage = async (
  imageBase64: string,
  age: number,
  kidId: string
): Promise<ImageUploadResult> => {
  try {
    // 1. 处理base64数据
    const base64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
    const binary = atob(base64);
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    const imageBlob = new Blob([buffer], { type: 'image/png' });

    // 2. 生成存储路径
    const timestamp = Date.now();
    const storageKey = `${kidId}/age-${age}-${timestamp}.png`;

    // 3. 上传到Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('ending-cards')
      .upload(storageKey, imageBlob, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadErr) {
      logger.error('Failed to upload image to storage:', uploadErr);
      return { success: false, error: uploadErr.message };
    }

    // 4. 获取公共URL
    const { data: urlData } = supabase.storage
      .from('ending-cards')
      .getPublicUrl(storageKey);

    if (!urlData?.publicUrl) {
      return { success: false, error: 'Failed to get public URL' };
    }

    logger.info(`Image uploaded successfully for age ${age}:`, urlData.publicUrl);
    return { success: true, imageUrl: urlData.publicUrl };

  } catch (error) {
    logger.error('Error uploading image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * 从localStorage获取存储的图片URL列表
 */
export const getStoredImageUrls = (kidId: string): StoredImageData[] => {
  try {
    const key = `game_images_${kidId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    
    return JSON.parse(stored) as StoredImageData[];
  } catch (error) {
    logger.error('Error loading stored image URLs:', error);
    return [];
  }
};

/**
 * 保存图片URL到localStorage
 */
export const saveImageUrl = (kidId: string, imageData: StoredImageData): void => {
  try {
    const key = `game_images_${kidId}`;
    const existing = getStoredImageUrls(kidId);
    
    // 检查是否已存在相同年龄的图片
    const existingIndex = existing.findIndex(img => img.age === imageData.age);
    
    if (existingIndex >= 0) {
      // 更新现有记录
      existing[existingIndex] = imageData;
    } else {
      // 添加新记录
      existing.push(imageData);
    }
    
    // 按年龄排序
    existing.sort((a, b) => a.age - b.age);
    
    localStorage.setItem(key, JSON.stringify(existing));
    logger.debug(`Saved image URL for age ${imageData.age}`);
  } catch (error) {
    logger.error('Error saving image URL:', error);
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      logger.error('LocalStorage quota exceeded when saving image URL');
    }
  }
};

/**
 * 获取指定年龄的图片URL
 */
export const getImageUrlByAge = (kidId: string, age: number): string | null => {
  const stored = getStoredImageUrls(kidId);
  const imageData = stored.find(img => img.age === age);
  return imageData?.imageUrl || null;
};

/**
 * 清理指定kidId的所有图片数据
 */
export const clearImageUrls = (kidId: string): void => {
  try {
    const key = `game_images_${kidId}`;
    localStorage.removeItem(key);
    logger.debug(`Cleared image URLs for kidId: ${kidId}`);
  } catch (error) {
    logger.error('Error clearing image URLs:', error);
  }
};

/**
 * 处理图片生成和存储的完整流程
 * @param imageBase64 生成的base64图片
 * @param age 孩子年龄
 * @param kidId 孩子ID
 * @returns 处理结果
 */
export const processAndStoreImage = async (
  imageBase64: string,
  age: number,
  kidId: string
): Promise<ImageUploadResult & { imageData?: StoredImageData }> => {
  try {
    // 1. 上传图片到Supabase
    const uploadResult = await uploadImageToStorage(imageBase64, age, kidId);
    
    if (!uploadResult.success || !uploadResult.imageUrl) {
      return uploadResult;
    }
    
    // 2. 保存URL到localStorage
    const imageData: StoredImageData = {
      age,
      imageUrl: uploadResult.imageUrl,
      uploadedAt: new Date().toISOString(),
      localCached: false
    };
    
    saveImageUrl(kidId, imageData);
    
    return {
      success: true,
      imageUrl: uploadResult.imageUrl,
      imageData
    };
    
  } catch (error) {
    logger.error('Error in processAndStoreImage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * 预加载图片到浏览器缓存
 */
export const preloadImage = (imageUrl: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
    img.src = imageUrl;
  });
};

/**
 * 批量预加载图片
 */
export const preloadImages = async (imageUrls: string[]): Promise<void> => {
  try {
    await Promise.all(imageUrls.map(url => preloadImage(url)));
    logger.debug(`Preloaded ${imageUrls.length} images`);
  } catch (error) {
    logger.warn('Some images failed to preload:', error);
  }
};

/**
 * 获取localStorage使用情况统计
 */
export const getStorageStats = () => {
  try {
    let totalSize = 0;
    let imageUrlsSize = 0;
    
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const value = localStorage.getItem(key) || '';
        const size = new Blob([value]).size;
        totalSize += size;
        
        if (key.startsWith('game_images_')) {
          imageUrlsSize += size;
        }
      }
    }
    
    // localStorage通常限制为5-10MB
    const estimatedLimit = 5 * 1024 * 1024; // 5MB
    const usagePercentage = (totalSize / estimatedLimit) * 100;
    
    return {
      totalSize,
      imageUrlsSize,
      estimatedLimit,
      usagePercentage: Math.min(usagePercentage, 100),
      isNearLimit: usagePercentage > 80
    };
  } catch (error) {
    logger.error('Error calculating storage stats:', error);
    return {
      totalSize: 0,
      imageUrlsSize: 0,
      estimatedLimit: 0,
      usagePercentage: 0,
      isNearLimit: false
    };
  }
};