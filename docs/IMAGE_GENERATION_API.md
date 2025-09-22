# 图片生成 API 文档

## 概述

图片生成API使用火山引擎的Doubao模型，根据文本提示词生成AI图片。该API支持多种尺寸和质量设置，主要用于游戏结局卡片和里程碑图片的生成。

## API 端点

```
POST /api/image
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

### 请求示例

```json
{
  "prompt": "一个可爱的婴儿在公园里玩耍，阳光明媚，卡通风格",
  "size": "1024x1024",
  "quality": "hd"
}
```

## 响应格式

### 成功响应 (200 OK)

```json
{
  "success": true,
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAA...",
  "imageUrl": "https://example.com/image.jpg",
  "provider": "doubao",
  "model": "doubao-seedream-3-0-t2i-250415",
  "prompt": "一个可爱的婴儿在公园里玩耍，阳光明媚，卡通风格",
  "size": "1024x1024",
  "quality": "hd"
}
```

### 响应字段说明

| 字段名 | 类型 | 描述 |
|--------|------|---------|
| `success` | boolean | 请求是否成功 |
| `imageBase64` | string | Base64编码的图片数据（可选） |
| `imageUrl` | string | 图片的URL地址（可选） |
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
  "error": "Failed to generate image",
  "details": "具体错误信息"
}
```

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
interface ImageGenerationRequest {
  prompt: string;
  size?: '1024x1024' | '1920x640';
  quality?: 'standard' | 'hd';
}

interface ImageGenerationResponse {
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  provider: string;
  model: string;
  prompt: string;
  size: string;
  quality: string;
}

async function generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const response = await fetch('/api/image', {
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
  const result = await generateImage({
    prompt: "一个快乐的孩子在花园里奔跑，水彩画风格",
    size: "1024x1024",
    quality: "hd"
  });
  
  if (result.success) {
    console.log('图片生成成功:', result.imageUrl);
    // 使用 result.imageBase64 或 result.imageUrl
  }
} catch (error) {
  console.error('图片生成失败:', error);
}
```

### Python

```python
import requests
import json

def generate_image(prompt, size="1024x1024", quality="standard"):
    url = "https://www.babysim.fun/api/image"
    
    payload = {
        "prompt": prompt,
        "size": size,
        "quality": quality
    }
    
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
    result = generate_image(
        prompt="一个温馨的家庭场景，父母和孩子在一起，温暖的色调",
        size="1920x640",
        quality="hd"
    )
    
    if result["success"]:
        print(f"图片生成成功: {result['imageUrl']}")
        # 保存base64图片
        if result.get("imageBase64"):
            import base64
            image_data = base64.b64decode(result["imageBase64"])
            with open("generated_image.jpg", "wb") as f:
                f.write(image_data)
except Exception as e:
    print(f"图片生成失败: {e}")
```

### cURL

```bash
curl -X POST https://www.babysim.fun/api/image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "一个可爱的婴儿在学步，周围有玩具，柔和的光线",
    "size": "1024x1024",
    "quality": "hd"
  }'
```

## 技术实现

### AI模型
- **提供商**: 火山引擎 (Volcengine)
- **模型**: `doubao-seedream-3-0-t2i-250415`
- **API端点**: `https://ark.cn-beijing.volces.com/api/v3/images/generations`

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

4. **"No image data received" 错误**
   - 检查提示词是否符合内容政策
   - 尝试简化或修改提示词内容

### 调试建议

1. **开发环境调试**
   - 设置 `NODE_ENV=development` 查看详细日志
   - 检查控制台输出的完整提示词和参数

2. **网络问题**
   - 检查网络连接
   - 确认API端点可访问性

3. **响应时间优化**
   - 图片生成通常需要10-30秒
   - 建议实现适当的超时处理和用户反馈

## 更新日志

- **v1.0.0**: 初始版本，支持基本的图片生成功能
- 使用Doubao模型进行图片生成
- 支持多种尺寸和质量设置
- 实现速率限制和错误处理