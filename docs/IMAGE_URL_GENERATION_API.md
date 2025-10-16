# 图片URL生成 API 文档

## 概述

图片URL生成API是专门用于生成图片并返回图片URL地址的服务。与标准的图片生成API不同，此API只返回图片的URL地址，不返回base64编码数据，适合需要直接获取图片链接的场景。

## API 端点

```
POST /api/image-url
```

## 请求参数

### Content-Type
```
Content-Type: application/json
```

### 请求体参数

| 参数名 | 类型 | 必需 | 默认值 | 描述 |
|--------|------|------|--------|---------|
| `prompt` | string | ✅ | - | 图片生成提示词，描述要生成的图片内容 |
| `size` | string | ❌ | `"1024x1024"` | 图片尺寸，支持 `"1024x1024"` 和 `"1920x640"` |
| `quality` | string | ❌ | `"standard"` | 图片质量，支持 `"standard"` 和 `"hd"` |
| `filename` | string | ❌ | `"image_{timestamp}.png"` | 自定义图片文件名，如果不提供则自动生成 |

### 请求示例

```json
{
  "prompt": "一个可爱的婴儿在公园里玩耍，阳光明媚，卡通风格",
  "size": "1024x1024",
  "quality": "hd",
  "filename": "cute_baby_park.png"
}
```

## 响应格式

### 成功响应 (200 OK)

```json
{
  "success": true,
  "imageUrl": "https://example.com/generated-image.jpg",
  "filename": "cute_baby_park.png",
  "provider": "doubao",
  "model": "doubao-seedream-4-0-250828",
  "prompt": "一个可爱的婴儿在公园里玩耍，阳光明媚，卡通风格",
  "size": "1024x1024",
  "quality": "hd"
}
```

### 响应字段说明

| 字段名 | 类型 | 描述 |
|--------|------|---------|
| `success` | boolean | 请求是否成功 |
| `imageUrl` | string | 生成图片的URL地址 |
| `provider` | string | AI提供商，固定为 "doubao" |
| `model` | string | 使用的AI模型名称 |
| `prompt` | string | 截断后的提示词（最多100字符） |
| `size` | string | 实际使用的图片尺寸 |
| `quality` | string | 实际使用的图片质量 |

### 错误响应

#### 400 Bad Request - 缺少必需参数
```json
{
  "error": "Prompt is required"
}
```

#### 405 Method Not Allowed - 请求方法错误
```json
{
  "error": "Method not allowed"
}
```

#### 429 Too Many Requests - 超出速率限制
```json
{
  "error": "Rate limit exceeded"
}
```

#### 500 Internal Server Error - 服务器错误
```json
{
  "error": "Failed to generate image URL",
  "details": "具体错误信息"
}
```

## 与标准图片生成API的区别

| 特性 | `/api/image` | `/api/image-url` |
|------|-------------|------------------|
| 返回格式 | base64 + URL | 仅URL |
| 响应大小 | 较大（包含base64数据） | 较小（仅元数据） |
| 适用场景 | 需要立即使用图片数据 | 需要图片链接引用 |
| 网络传输 | 较慢 | 较快 |
| 存储需求 | 客户端需处理base64 | 直接使用URL |

## 支持的图片尺寸

| 尺寸 | 像素数 | 适用场景 |
|------|--------|----------|
| `1024x1024` | 1,048,576 | 方形图片，适合头像、卡片 |
| `1920x640` | 1,228,800 | 横向图片，适合横幅、背景 |

> **注意**: Doubao API要求图片像素数至少为921,600，因此只支持上述两种尺寸。

## 限制说明

### 速率限制
- **限制**: 30次请求/分钟
- **基于**: IP地址
- **超出限制**: 返回429状态码

### 提示词限制
- **最大长度**: 无明确限制，但建议控制在合理范围内
- **语言支持**: 支持中文和英文
- **内容限制**: 遵循AI服务商的内容政策

## 使用示例

### JavaScript/TypeScript

```typescript
interface ImageUrlRequest {
  prompt: string;
  size?: '1024x1024' | '1920x640';
  quality?: 'standard' | 'hd';
  filename?: string;
}

interface ImageUrlResponse {
  success: boolean;
  imageUrl: string;
  filename?: string;
  provider: string;
  model: string;
  prompt: string;
  size: string;
  quality: string;
}

async function generateImageUrl(request: ImageUrlRequest): Promise<ImageUrlResponse> {
  const response = await fetch('/api/image-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// 使用示例
try {
  const result = await generateImageUrl({
    prompt: "一个快乐的孩子在花园里奔跑，水彩画风格",
    size: "1024x1024",
    quality: "hd",
    filename: "happy_child_garden.png"
  });
  
  if (result.success) {
    console.log('图片URL:', result.imageUrl);
    console.log('文件名:', result.filename);
    // 直接使用URL设置图片src
    const img = document.createElement('img');
    img.src = result.imageUrl;
    img.alt = result.filename || 'Generated image';
    document.body.appendChild(img);
  }
} catch (error) {
  console.error('图片生成失败:', error);
}
```

### React组件示例

```tsx
import React, { useState } from 'react';

interface ImageGeneratorProps {
  onImageGenerated?: (imageUrl: string) => void;
}

const ImageUrlGenerator: React.FC<ImageGeneratorProps> = ({ onImageGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [filename, setFilename] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入图片描述');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/image-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          size: '1024x1024',
          quality: 'hd',
          ...(filename && { filename })
        })
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setImageUrl(result.imageUrl);
        onImageGenerated?.(result.imageUrl);
      } else {
        setError('图片生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="image-generator">
      <div className="input-group">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想要生成的图片..."
          rows={3}
          className="prompt-input"
        />
        <input
          type="text"
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="自定义文件名 (可选)"
          className="filename-input"
        />
        <button 
          onClick={handleGenerate} 
          disabled={loading || !prompt.trim()}
          className="generate-button"
        >
          {loading ? '生成中...' : '生成图片'}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          错误: {error}
        </div>
      )}
      
      {imageUrl && (
        <div className="result">
          <img 
            src={imageUrl} 
            alt="Generated image" 
            className="generated-image"
            onLoad={() => console.log('图片加载完成')}
            onError={() => setError('图片加载失败')}
          />
          <div className="image-url">
            <label>图片URL:</label>
            <input 
              type="text" 
              value={imageUrl} 
              readOnly 
              className="url-input"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUrlGenerator;
```

### Python示例

```python
import requests
import json

def generate_image_url(prompt, size="1024x1024", quality="standard", filename=None):
    """
    生成图片并返回URL
    
    Args:
        prompt (str): 图片描述提示词
        size (str): 图片尺寸
        quality (str): 图片质量
        filename (str, optional): 自定义文件名
    
    Returns:
        dict: 包含图片URL的响应数据
    """
    url = "https://www.babysim.fun/api/image-url"
    
    payload = {
        "prompt": prompt,
        "size": size,
        "quality": quality
    }
    
    if filename:
        payload["filename"] = filename
    
    headers = {
        "Content-Type": "application/json"
    }
    
    response = requests.post(url, json=payload, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"API请求失败: {response.status_code} - {response.text}")

# 使用示例
try:
    result = generate_image_url(
        prompt="一个温馨的家庭场景，父母和孩子在一起，温暖的色调",
        size="1920x640",
        quality="hd",
        filename="warm_family_scene.png"
    )
    
    if result["success"]:
        print(f"图片URL: {result['imageUrl']}")
        print(f"文件名: {result.get('filename', 'N/A')}")
        
        # 可以进一步下载图片
        import urllib.request
        download_filename = result.get('filename', 'generated_image.jpg')
        urllib.request.urlretrieve(result['imageUrl'], download_filename)
        print(f"图片已下载为 {download_filename}")
        
except Exception as e:
    print(f"图片生成失败: {e}")
```

### cURL示例

```bash
curl -X POST https://www.babysim.fun/api/image-url \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "一个可爱的婴儿在学步，周围有玩具，柔和的光线",
    "size": "1024x1024",
    "quality": "hd",
    "filename": "baby_learning_walk.png"
  }'
```

## 技术实现

### AI模型
- **提供商**: 火山引擎 (Volcengine)
- **模型**: `doubao-seedream-4-0-250828`
- **API端点**: `https://ark.cn-beijing.volces.com/api/v3/images/generations`
- **响应格式**: `url` (仅返回图片URL)

### 安全特性
- **CORS支持**: 允许跨域请求
- **速率限制**: 基于IP的请求频率控制
- **参数验证**: 严格的输入参数校验
- **错误处理**: 完善的错误信息返回

### 环境要求

#### 环境变量
- `VOLCENGINE_LLM_API_KEY`: 火山引擎LLM API密钥
- `ARK_API_KEY`: 备用API密钥（可选）

#### 部署环境
- **平台**: Vercel Serverless Functions
- **运行时**: Node.js
- **依赖**: `@vercel/node`

## 最佳实践

### 1. 错误处理
```typescript
async function safeGenerateImageUrl(prompt: string) {
  try {
    const result = await generateImageUrl({ prompt });
    return result;
  } catch (error) {
    console.error('图片生成失败:', error);
    // 提供默认图片或重试逻辑
    return { success: false, error: error.message };
  }
}
```

### 2. 缓存策略
```typescript
const imageCache = new Map<string, string>();

async function getCachedImageUrl(prompt: string) {
  const cacheKey = `img_${btoa(prompt)}`;
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  
  const result = await generateImageUrl({ prompt });
  if (result.success) {
    imageCache.set(cacheKey, result.imageUrl);
  }
  
  return result;
}
```

### 3. 批量处理
```typescript
async function generateMultipleImageUrls(prompts: string[]) {
  const results = await Promise.allSettled(
    prompts.map(prompt => generateImageUrl({ prompt }))
  );
  
  return results.map((result, index) => ({
    prompt: prompts[index],
    result: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : null
  }));
}
```

## 故障排除

### 常见问题

1. **"Prompt is required" 错误**
   - 确保请求体包含 `prompt` 字段
   - 检查 `prompt` 不为空字符串

2. **"Image generation service not configured" 错误**
   - 检查环境变量 `VOLCENGINE_LLM_API_KEY` 或 `ARK_API_KEY` 是否正确配置

3. **"Rate limit exceeded" 错误**
   - 降低请求频率，等待一分钟后重试
   - 考虑实现客户端请求队列

4. **"No image URL received" 错误**
   - 检查提示词是否符合内容政策
   - 尝试简化或修改提示词内容
   - 确认Doubao API支持URL响应格式

5. **图片URL无法访问**
   - 检查返回的URL是否有效
   - 确认图片服务器的可访问性
   - 注意URL可能有时效性限制

### 调试建议

1. **开发环境调试**
   - 设置 `NODE_ENV=development` 查看详细日志
   - 检查控制台输出的完整提示词和参数

2. **网络问题**
   - 检查网络连接
   - 确认API端点可访问性
   - 测试返回的图片URL是否可访问

3. **响应时间优化**
   - 图片生成通常需要10-30秒
   - 建议实现适当的超时处理和用户反馈
   - 考虑使用WebSocket或轮询获取生成状态

## 更新日志

- **v1.1.0**: 新增自定义文件名功能
  - 新增 `filename` 参数，支持自定义图片文件名
  - 响应中包含 `filename` 字段
  - 如果未提供文件名，自动生成时间戳格式的文件名
  - 更新所有示例代码以包含新参数

- **v1.0.0**: 初始版本
  - 支持基于prompt的图片URL生成
  - 使用Doubao模型
  - 支持多种尺寸和质量设置
  - 实现速率限制和错误处理
  - 仅返回图片URL，不包含base64数据