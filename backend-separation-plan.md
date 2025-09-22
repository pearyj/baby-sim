# 后端拆分方案

## 项目现状分析

### 当前架构
- **前端**: Vite + React + TypeScript
- **后端**: Vercel Serverless Functions (Node.js/TypeScript)
- **数据库**: Supabase (PostgreSQL)
- **存储**: Supabase Storage
- **支付**: Stripe
- **部署**: Vercel

### 现有API模块
```
api/
├── chat.ts              # AI对话服务 (OpenAI/DeepSeek/火山引擎)
├── image.ts             # AI图片生成服务 (豆包)
├── consume-credit.ts    # 积分消费
├── credits.ts           # 积分查询
├── create-checkout-session.ts  # Stripe支付会话
├── subscribe.ts         # 订阅管理
├── webhook.ts           # Stripe Webhook
├── log-event.ts         # 事件日志
├── session-init.ts      # 会话初始化
├── session-flag.ts      # 会话标记
├── supabaseAdmin.ts     # Supabase管理客户端
└── _utils.ts            # 工具函数 (CORS, 限流等)
```

## 拆分方案

### Go语言微服务架构 (确定方案)

#### 技术栈选择
- **语言**: Go 1.21+
- **框架**: Gin + GORM
- **数据库**: 继续使用Supabase PostgreSQL
- **缓存**: Redis (阿里云Redis)
- **部署**: 阿里云ECS + Docker
- **负载均衡**: 阿里云SLB
- **CDN**: 阿里云CDN
- **API文档**: Swagger/OpenAPI

#### 服务拆分设计

```
backend/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── api/
│   │   ├── handlers/
│   │   │   ├── chat.go
│   │   │   ├── image.go
│   │   │   ├── credit.go
│   │   │   ├── payment.go
│   │   │   └── user.go
│   │   ├── middleware/
│   │   │   ├── cors.go
│   │   │   ├── ratelimit.go
│   │   │   └── auth.go
│   │   └── routes/
│   │       └── router.go
│   ├── services/
│   │   ├── ai_service.go
│   │   ├── credit_service.go
│   │   ├── payment_service.go
│   │   └── user_service.go
│   ├── models/
│   │   ├── user.go
│   │   ├── credit.go
│   │   └── session.go
│   ├── repository/
│   │   ├── interfaces.go
│   │   └── postgres/
│   │       ├── user_repo.go
│   │       └── credit_repo.go
│   └── config/
│       └── config.go
├── pkg/
│   ├── logger/
│   ├── database/
│   └── utils/
├── deployments/
│   ├── Dockerfile
│   └── docker-compose.yml
└── docs/
    └── api.yaml
```

#### API设计

```go
// RESTful API 设计
GET    /api/v1/health
POST   /api/v1/auth/session
GET    /api/v1/credits
POST   /api/v1/credits/consume
POST   /api/v1/chat
POST   /api/v1/image/generate
POST   /api/v1/payment/checkout
POST   /api/v1/payment/webhook
POST   /api/v1/events/log
```



## 迁移策略

### 阶段一：环境准备 (1-2周)
1. **新后端项目初始化**
   - 创建Go项目结构
   - 配置开发环境
   - 设置CI/CD流水线

2. **数据库迁移准备**
   - 分析现有Supabase表结构
   - 设计Go模型结构
   - 准备数据迁移脚本

### 阶段二：核心服务迁移 (2-3周)
1. **用户认证服务**
   - 实现JWT认证
   - 迁移会话管理
   - 集成Supabase Auth

2. **积分系统**
   - 迁移积分查询API
   - 迁移积分消费逻辑
   - 实现事务处理

3. **AI服务集成**
   - 迁移聊天API
   - 迁移图片生成API
   - 实现提供商切换逻辑

### 阶段三：支付系统迁移 (1-2周)
1. **Stripe集成**
   - 迁移支付会话创建
   - 迁移Webhook处理
   - 实现订阅管理

### 阶段四：前端适配 (1周)
1. **API客户端更新**
   - 更新API端点
   - 调整认证逻辑
   - 更新错误处理

### 阶段五：部署和测试 (1-2周)
1. **部署配置**
   - 配置生产环境
   - 设置监控和日志
   - 性能测试

2. **灰度发布**
   - 部分流量切换
   - 监控系统稳定性
   - 逐步完全切换

## 阿里云部署方案

### 服务器配置推荐

#### ECS实例规格
- **规格**: ecs.c6.large (2核4GB) 或 ecs.c6.xlarge (4核8GB)
- **操作系统**: Ubuntu 22.04 LTS 或 CentOS 8
- **存储**: 40GB SSD云盘
- **带宽**: 5Mbps (可按需调整)
- **地域**: 根据用户分布选择 (推荐华东1-杭州)

#### 配套服务
- **Redis**: 阿里云Redis 1GB标准版
- **SLB**: 应用型负载均衡ALB
- **CDN**: 阿里云CDN (静态资源加速)
- **域名**: 阿里云域名服务
- **SSL证书**: 阿里云SSL证书服务

### 成本估算
- **ECS (2核4GB)**: ¥200-300/月
- **Redis (1GB)**: ¥50-80/月
- **SLB**: ¥20-50/月
- **CDN**: ¥10-30/月 (按流量)
- **域名+SSL**: ¥100/年
- **总计**: ¥280-460/月 (~$40-65/月)

### 阿里云部署详细步骤

#### 1. ECS服务器初始化

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 3. 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. 安装Git
sudo apt install git -y

# 5. 创建应用目录
sudo mkdir -p /opt/baby-sim-backend
sudo chown $USER:$USER /opt/baby-sim-backend
```

#### 2. Docker配置

```dockerfile
# Dockerfile
FROM golang:1.21-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 编译应用
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/server/main.go

# 运行阶段
FROM alpine:latest

# 安装ca证书和时区数据
RUN apk --no-cache add ca-certificates tzdata

# 设置时区
ENV TZ=Asia/Shanghai

# 创建非root用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# 复制编译好的二进制文件
COPY --from=builder /app/main .

# 更改文件所有者
RUN chown appuser:appgroup /app/main

# 切换到非root用户
USER appuser

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

# 启动应用
CMD ["./main"]
```

#### 3. Docker Compose配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: .
    container_name: baby-sim-backend
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - GIN_MODE=release
      - PORT=8080
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - VOLCENGINE_LLM_API_KEY=${VOLCENGINE_LLM_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
    volumes:
      - ./logs:/app/logs
    networks:
      - baby-sim-network
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    container_name: baby-sim-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - baby-sim-network
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}

  nginx:
    image: nginx:alpine
    container_name: baby-sim-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    networks:
      - baby-sim-network
    depends_on:
      - backend

volumes:
  redis_data:

networks:
  baby-sim-network:
    driver: bridge
```

#### 4. Nginx配置

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8080;
    }

    # 限流配置
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=image:10m rate=2r/s;

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL配置
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # API代理
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_timeout 30s;
        }

        # 图片生成API特殊限流
        location /api/v1/image/ {
            limit_req zone=image burst=5 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_timeout 60s;
        }

        # 健康检查
        location /health {
            access_log off;
            proxy_pass http://backend/api/v1/health;
        }
    }
}
```

#### 5. 环境变量配置

```bash
# .env文件
# 数据库配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Redis配置
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# AI服务配置
OPENAI_API_KEY=your-openai-key
DEEPSEEK_API_KEY=your-deepseek-key
VOLCENGINE_LLM_API_KEY=your-volcengine-key

# 支付配置
STRIPE_SECRET_KEY=your-stripe-secret
STRIPE_WEBHOOK_SECRET=your-webhook-secret

# 应用配置
GIN_MODE=release
PORT=8080
ALLOWED_ORIGINS=https://your-frontend-domain.com

# 阿里云配置
ALIYUN_ACCESS_KEY_ID=your-access-key
ALIYUN_ACCESS_KEY_SECRET=your-secret-key
ALIYUN_REGION=cn-hangzhou
```

#### 6. 部署脚本

```bash
#!/bin/bash
# deploy.sh

set -e

echo "开始部署 Baby Sim 后端服务..."

# 1. 拉取最新代码
echo "拉取最新代码..."
git pull origin main

# 2. 构建镜像
echo "构建Docker镜像..."
docker-compose build --no-cache

# 3. 停止旧服务
echo "停止旧服务..."
docker-compose down

# 4. 启动新服务
echo "启动新服务..."
docker-compose up -d

# 5. 等待服务启动
echo "等待服务启动..."
sleep 30

# 6. 健康检查
echo "执行健康检查..."
if curl -f http://localhost:8080/api/v1/health; then
    echo "✅ 部署成功！服务正常运行"
else
    echo "❌ 部署失败！服务异常"
    docker-compose logs
    exit 1
fi

# 7. 清理旧镜像
echo "清理旧镜像..."
docker image prune -f

echo "🎉 部署完成！"
```

#### 7. 监控和日志配置

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - baby-sim-network

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - baby-sim-network

volumes:
  prometheus_data:
  grafana_data:

networks:
  baby-sim-network:
    external: true
```

## 具体拆分实施步骤

### 第一阶段：项目初始化 (1-2周)

#### 1.1 Go项目结构创建
```
baby-sim-backend/
├── cmd/
│   └── server/
│       └── main.go              # 应用入口
├── internal/
│   ├── api/
│   │   ├── handlers/            # HTTP处理器
│   │   │   ├── chat.go
│   │   │   ├── image.go
│   │   │   ├── payment.go
│   │   │   └── health.go
│   │   ├── middleware/          # 中间件
│   │   │   ├── auth.go
│   │   │   ├── cors.go
│   │   │   ├── ratelimit.go
│   │   │   └── logging.go
│   │   └── routes/              # 路由配置
│   │       └── routes.go
│   ├── services/                # 业务逻辑层
│   │   ├── chat_service.go
│   │   ├── image_service.go
│   │   ├── payment_service.go
│   │   └── storage_service.go
│   ├── models/                  # 数据模型
│   │   ├── chat.go
│   │   ├── image.go
│   │   └── payment.go
│   ├── clients/                 # 外部服务客户端
│   │   ├── supabase.go
│   │   ├── openai.go
│   │   ├── deepseek.go
│   │   ├── volcengine.go
│   │   └── stripe.go
│   └── config/                  # 配置管理
│       └── config.go
├── pkg/                         # 公共包
│   ├── logger/
│   ├── validator/
│   └── utils/
├── deployments/                 # 部署配置
│   ├── docker/
│   ├── k8s/
│   └── scripts/
├── docs/                        # API文档
├── tests/                       # 测试文件
├── go.mod
├── go.sum
├── Dockerfile
├── docker-compose.yml
└── README.md
```

#### 1.2 核心依赖安装
```bash
# 初始化Go模块
go mod init baby-sim-backend

# 安装核心依赖
go get github.com/gin-gonic/gin
go get github.com/supabase-community/supabase-go
go get github.com/go-redis/redis/v8
go get github.com/stripe/stripe-go/v75
go get github.com/sashabaranov/go-openai
go get github.com/joho/godotenv
go get github.com/sirupsen/logrus
go get github.com/gin-contrib/cors
go get github.com/gin-contrib/rate
```

### 第二阶段：API迁移 (2-3周)

#### 2.1 聊天API迁移
- 迁移 `/api/chat.ts` → Go handlers
- 实现多模型支持 (OpenAI, DeepSeek, Volcengine)
- 添加请求验证和错误处理
- 实现流式响应

#### 2.2 图片生成API迁移
- 迁移 `/api/image.ts` → Go handlers
- 集成Volcengine图片生成API
- 实现图片存储到Supabase Storage
- 添加图片处理和优化

#### 2.3 支付API迁移
- 迁移Stripe相关API
- 实现Webhook处理
- 添加支付状态管理

### 第三阶段：数据库集成 (1周)

#### 3.1 Supabase集成
- 配置Supabase Go客户端
- 实现数据库操作封装
- 添加连接池管理
- 实现事务支持

#### 3.2 Redis集成
- 配置Redis连接
- 实现缓存策略
- 添加会话管理
- 实现限流功能

### 第四阶段：部署和测试 (1-2周)

#### 4.1 阿里云ECS配置
- 购买和配置ECS实例
- 安装Docker和相关工具
- 配置防火墙和安全组
- 设置域名和SSL证书

#### 4.2 CI/CD配置
- 配置GitHub Actions
- 实现自动化部署
- 添加健康检查
- 配置监控告警

### 第五阶段：前端适配和上线 (1周)

#### 5.1 前端API地址更新
- 更新 `apiClient.ts` 中的API地址
- 测试所有功能接口
- 性能优化和调试

#### 5.2 灰度发布
- 配置负载均衡
- 实现流量切换
- 监控系统稳定性
- 完全切换到新后端

## 数据迁移方案

### 现有数据保持不变
- 继续使用Supabase作为主数据库
- 只需要更新连接配置
- 无需数据迁移

### 配置更新
```go
// config/database.go
type Config struct {
    SupabaseURL    string
    SupabaseKey    string
    DatabaseURL    string
}
```

## 监控和日志

### 监控方案
1. **应用监控**: Prometheus + Grafana
2. **错误追踪**: Sentry
3. **性能监控**: New Relic 或 DataDog
4. **健康检查**: 内置健康检查端点

### 日志方案
1. **结构化日志**: logrus 或 zap
2. **日志聚合**: ELK Stack 或 Loki
3. **日志级别**: Debug/Info/Warn/Error

## 成本分析

### 开发成本
- **人力成本**: 1-2个开发者，2-3个月 (~¥30,000-60,000)
- **学习成本**: Go语言学习曲线相对平缓 (1-2周)
- **迁移成本**: 逐步迁移，风险可控
- **测试成本**: 需要完整的API测试和压力测试

### 运维成本对比

#### 当前 Vercel 成本
- **Pro Plan**: $20/月
- **函数调用**: 超出限制后额外收费
- **带宽**: 1TB/月，超出后 $40/TB
- **预估月成本**: $50-100/月

#### 阿里云 ECS 成本
- **ECS实例**: ¥200-300/月
- **带宽**: ¥50-100/月
- **Redis**: ¥30-50/月
- **CDN**: ¥20-40/月
- **SSL证书**: ¥0-200/年
- **预估月成本**: ¥300-490/月 (~$42-68/月)

#### 成本优势
- **可控性**: 固定成本，不受流量波动影响
- **性能**: 专用资源，性能更稳定
- **扩展性**: 可根据需求灵活调整配置

### ROI分析
- **初期投入**: ¥50,000-80,000 (开发+部署)
- **月度节省**: ¥100-200/月
- **回本周期**: 12-18个月
- **长期收益**: 更好的性能和可控性

## 风险评估

### 技术风险 (中等)

#### 风险点
1. **Go语言熟悉度**: 团队需要学习Go语言生态
2. **部署复杂度**: 相比Serverless需要更多运维知识
3. **性能调优**: 需要深入了解Go性能优化
4. **并发处理**: Go协程的正确使用

#### 缓解措施
- 提前进行Go语言培训
- 使用成熟的框架和最佳实践
- 建立完善的监控和告警系统
- 逐步迁移，保留回滚方案

### 业务风险 (低)

#### 风险点
1. **服务中断**: 迁移过程中的潜在中断
2. **数据一致性**: API接口兼容性问题
3. **用户体验**: 响应时间和稳定性变化
4. **SEO影响**: 域名和URL结构变更

#### 缓解措施
- 采用蓝绿部署策略
- 保持API接口完全兼容
- 进行充分的压力测试
- 保持前端URL结构不变

### 运维风险 (中等)

#### 风险点
1. **服务器维护**: 需要专业运维知识
2. **安全管理**: 服务器安全配置
3. **备份恢复**: 数据备份和灾难恢复
4. **监控告警**: 系统监控的完整性

#### 缓解措施
- 使用Docker容器化部署
- 配置自动化运维脚本
- 建立完善的备份策略
- 集成专业监控工具

### 风险矩阵

| 风险类型 | 概率 | 影响 | 风险等级 | 应对策略 |
|---------|------|------|----------|----------|
| Go学习曲线 | 中 | 中 | 中等 | 提前培训 |
| 服务中断 | 低 | 高 | 中等 | 蓝绿部署 |
| 性能问题 | 中 | 中 | 中等 | 压力测试 |
| 安全漏洞 | 低 | 高 | 中等 | 安全审计 |
| 运维复杂 | 高 | 中 | 中等 | 自动化 |

## 时间规划

### 总体时间线: 6-8周

#### 第1-2周: 项目初始化
- **Week 1**:
  - [ ] Go环境搭建和团队培训
  - [ ] 项目结构设计和代码仓库创建
  - [ ] 核心依赖选型和安装
  - [ ] 基础框架搭建

- **Week 2**:
  - [ ] 数据库连接和基础模型定义
  - [ ] 中间件开发 (CORS, 日志, 限流)
  - [ ] 健康检查和基础路由
  - [ ] Docker配置和本地开发环境

#### 第3-4周: 核心API开发
- **Week 3**:
  - [ ] 聊天API迁移和测试
  - [ ] 图片生成API迁移
  - [ ] Supabase客户端集成
  - [ ] Redis缓存集成

- **Week 4**:
  - [ ] 支付API迁移
  - [ ] Webhook处理实现
  - [ ] 错误处理和日志完善
  - [ ] 单元测试编写

#### 第5-6周: 部署和集成
- **Week 5**:
  - [ ] 阿里云ECS购买和配置
  - [ ] Docker Compose配置
  - [ ] Nginx反向代理配置
  - [ ] SSL证书配置

- **Week 6**:
  - [ ] CI/CD流水线配置
  - [ ] 监控和日志系统部署
  - [ ] 压力测试和性能调优
  - [ ] 安全配置和防火墙设置

#### 第7-8周: 上线和优化
- **Week 7**:
  - [ ] 前端API地址更新
  - [ ] 灰度发布配置
  - [ ] 用户验收测试
  - [ ] 性能监控和调优

- **Week 8**:
  - [ ] 全量切换到新后端
  - [ ] 旧服务下线
  - [ ] 文档更新和团队培训
  - [ ] 项目总结和经验沉淀

### 关键里程碑

| 里程碑 | 时间 | 交付物 | 验收标准 |
|--------|------|--------|----------|
| 架构完成 | Week 2 | 基础框架 | 健康检查通过 |
| API完成 | Week 4 | 核心接口 | 功能测试通过 |
| 部署完成 | Week 6 | 生产环境 | 压力测试通过 |
| 上线完成 | Week 8 | 正式服务 | 用户验收通过 |

### 应急预案
- **延期风险**: 预留1-2周缓冲时间
- **技术难题**: 准备外部技术顾问
- **服务中断**: 保持原系统并行运行
- **性能问题**: 准备快速回滚方案

## 总结

推荐采用**方案一 (Go语言微服务)**，理由如下：

1. **性能优势**: Go的并发性能和内存效率
2. **维护性**: 强类型系统，代码可维护性高
3. **部署简单**: 单二进制文件，容器化友好
4. **生态成熟**: 丰富的第三方库支持
5. **团队成长**: 学习现代后端开发技术

迁移过程建议采用**渐进式策略**，确保业务连续性，同时建立完善的监控和回滚机制。