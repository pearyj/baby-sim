# Base64 to URL API 文档

## 概述

这个API服务用于将base64格式的图片数据转换为可访问的URL地址。图片会被上传到Supabase Storage并返回公共访问URL。

## API端点

```
POST /api/base64-to-url
```

## 请求参数

### Headers
```
Content-Type: application/json
```

### Body参数

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `imageBase64` | string | 是 | base64格式的图片数据，必须包含完整的data URL格式 |
| `filename` | string | 否 | 自定义文件名前缀（不包含扩展名） |

### 请求示例

```json
{
  "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "filename": "my-image"
}
```

## 响应格式

### 成功响应 (200)

```json
{
  "success": true,
  "imageUrl": "https://your-supabase-url.supabase.co/storage/v1/object/public/ending-cards/uploads/my-image-1703123456789-abc12345.png",
  "storageKey": "uploads/my-image-1703123456789-abc12345.png"
}
```

### 错误响应

#### 400 Bad Request - 缺少必需参数
```json
{
  "success": false,
  "error": "imageBase64 is required"
}
```

#### 400 Bad Request - 无效的base64格式
```json
{
  "success": false,
  "error": "Invalid base64 format. Must start with data:image/"
}
```

#### 400 Bad Request - base64编码错误
```json
{
  "success": false,
  "error": "Invalid base64 encoding"
}
```

#### 405 Method Not Allowed
```json
{
  "error": "Method not allowed"
}
```

#### 429 Too Many Requests
```json
{
  "error": "rate_limited"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed to upload image to storage"
}
```

## 支持的图片格式

- PNG (`data:image/png;base64,...`)
- JPEG (`data:image/jpeg;base64,...`)
- JPG (`data:image/jpg;base64,...`)
- GIF (`data:image/gif;base64,...`)
- WebP (`data:image/webp;base64,...`)

## 限制

- **请求频率限制**: 60次/分钟/IP
- **文件大小**: 受Supabase Storage限制（通常为50MB）
- **图片格式**: 必须是有效的base64编码图片数据

## 使用示例

### JavaScript/TypeScript

```javascript
async function uploadBase64Image(imageBase64, filename) {
  try {
    const response = await fetch('/api/base64-to-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        filename
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('图片上传成功:', result.imageUrl);
      return result.imageUrl;
    } else {
      console.error('上传失败:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('请求失败:', error);
    throw error;
  }
}

// 使用示例
const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
uploadBase64Image(base64Data, 'test-image')
  .then(url => console.log('图片URL:', url))
  .catch(error => console.error('错误:', error));
```

### cURL

```bash
curl -X POST \
  http://localhost:3000/api/base64-to-url \
  -H 'Content-Type: application/json' \
  -d '{
    "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    "filename": "test-image"
  }'
```

### Python

```python
import requests
import json

def upload_base64_image(image_base64, filename=None):
    url = 'http://localhost:3000/api/base64-to-url'
    
    payload = {
        'imageBase64': image_base64
    }
    
    if filename:
        payload['filename'] = filename
    
    response = requests.post(
        url,
        headers={'Content-Type': 'application/json'},
        data=json.dumps(payload)
    )
    
    result = response.json()
    
    if result.get('success'):
        return result['imageUrl']
    else:
        raise Exception(f"上传失败: {result.get('error')}")

# 使用示例
base64_data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
try:
    image_url = upload_base64_image(base64_data, 'test-image')
    print(f'图片URL: {image_url}')
except Exception as e:
    print(f'错误: {e}')
```

## 技术实现

1. **数据处理**: 解析base64数据，转换为二进制格式
2. **文件上传**: 使用Supabase Storage API上传图片
3. **数据库记录**: 在`ending_cards`表中创建记录以支持RLS策略
4. **URL生成**: 获取Supabase Storage的公共访问URL
5. **错误处理**: 完整的错误处理和资源清理机制

## 安全考虑

- 启用了CORS保护
- 实施了速率限制（60次/分钟）
- 验证base64格式和编码有效性
- 使用随机UUID防止文件名冲突
- 支持Supabase RLS（行级安全）策略

## 环境要求

确保以下环境变量已配置：

- `SUPABASE_URL`: Supabase项目URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase服务角色密钥

## 故障排除

### 常见问题

1. **"Invalid base64 format"错误**
   - 确保base64数据包含完整的data URL前缀（如`data:image/png;base64,`）

2. **"Failed to upload image to storage"错误**
   - 检查Supabase配置和权限
   - 确认Storage bucket存在且可访问

3. **速率限制错误**
   - 减少请求频率，等待一分钟后重试

4. **文件过大错误**
   - 压缩图片或使用更小的图片尺寸

### 调试建议

- 检查浏览器开发者工具的网络面板
- 查看服务器日志获取详细错误信息
- 验证base64数据的完整性和格式