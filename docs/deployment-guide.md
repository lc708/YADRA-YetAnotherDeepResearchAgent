# YADRA 生产环境部署指南

## ⚠️ 重要说明：部署架构更新

**YADRA 现在采用云原生 Serverless 架构，无需管理服务器！**

### 🆕 **新架构 vs 旧架构**

| 组件 | 新架构（推荐） | 旧架构（已废弃） |
|------|---------------|-----------------|
| **前端** | Vercel (Next.js) | Vercel ✅ |
| **后端** | 腾讯云 TKE Serverless | 云服务器 + Docker ❌ |
| **负载均衡** | TKE 内置 CLB | 自配置 nginx ❌ |
| **运维复杂度** | 极低（Serverless） | 高（需要管理服务器） ❌ |
| **成本** | 按需付费，更经济 | 固定成本，闲置浪费 ❌ |

## 🎯 新部署架构

YADRA 采用**前后端分离 + 云原生 Serverless**架构：

- **前端**: Vercel (Next.js) - 全球CDN加速
- **后端**: 腾讯云 TKE Serverless - 自动扩缩容
- **数据库**: Supabase PostgreSQL - 托管数据库
- **镜像仓库**: 腾讯云 TCR - 容器镜像管理
- **负载均衡**: TKE 内置 CLB - 自动HTTPS

## 📋 部署前准备

### 1. 腾讯云资源准备
- [x] 注册腾讯云账号
- [ ] 创建 TKE Serverless 集群
- [ ] 创建容器镜像仓库（TCR）
- [ ] 申请域名和SSL证书

### 2. 网络规划
```yaml
VPC配置（推荐）:
  VPC CIDR: 10.0.0.0/12
  容器子网: 10.1.0.0/16
  Service CIDR: 192.168.128.0/17
  
域名配置:
  前端: yourdomain.com (Vercel)
  API: api.yourdomain.com (腾讯云CLB)
```

### 3. 外部服务准备
- [x] Supabase 数据库已配置
- [ ] Tavily Search API Key
- [ ] LLM API Keys (在conf.yaml中配置)

## 🚀 后端部署步骤

### Step 1: 本地准备配置文件

```bash
# 克隆代码到本地
git clone https://github.com/lc708/YADRA-YetAnotherDeepResearchAgent.git
cd YADRA-YetAnotherDeepResearchAgent

# 创建生产环境配置
cp production.env.template .env.production
# 编辑 .env.production，填写实际的API密钥

# 创建模型配置
cp conf.yaml.example conf.yaml
# 编辑 conf.yaml，配置LLM模型信息

# 检查配置文件是否完整
ls -la conf.yaml .env.production
```

### Step 2: 构建推送Docker镜像

```bash
# 修改构建脚本中的命名空间
nano build-and-push.sh
# 将 NAMESPACE="your-namespace" 改为你的实际命名空间

# 给脚本执行权限
chmod +x build-and-push.sh

# 执行构建推送
./build-and-push.sh
```

**构建脚本会自动：**
1. ✅ 检查Docker环境和必要文件
2. ✅ 登录腾讯云镜像仓库
3. ✅ 构建生产优化的Docker镜像
4. ✅ 推送到腾讯云TCR

### Step 3: 腾讯云TKE Serverless部署

#### 3.1 创建TKE Serverless集群
```yaml
集群配置:
  名称: yadra-prod-serverless
  Kubernetes版本: 1.28.3 (推荐稳定版本)
  
网络配置:
  VPC: 10.0.0.0/12
  容器子网: 10.1.0.0/16
  Service CIDR: 192.168.128.0/17
  
安全组:
  入站: TCP 8000 (来源: 负载均衡)
  出站: 全部协议 (访问外部API)
```

#### 3.2 创建工作负载
```yaml
工作负载配置:
  类型: Deployment
  名称: yadra-backend
  副本数: 2 (推荐，实现高可用)
  
镜像配置:
  镜像地址: ccr.ccs.tencentyun.com/your-namespace/yadra:latest
  
资源配置:
  CPU: 2核心
  内存: 4GB
  
环境变量: (从.env.production复制)
  - APP_ENV=production
  - DEBUG=False
  - NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
  - DATABASE_URL=postgresql://...
  - TAVILY_API_KEY=your_key
  # ... 其他环境变量
```

#### 3.3 配置负载均衡器
```yaml
Service配置:
  类型: LoadBalancer
  端口: 80 → 8000
  
CLB配置:
  健康检查: /api/health
  SSL证书: 绑定域名证书
  
域名配置:
  A记录: api.yourdomain.com → CLB IP
```

### Step 4: 验证部署

```bash
# 健康检查
curl https://api.yourdomain.com/api/health

# 预期响应：
# {"status":"ok","timestamp":"2024-01-xx"}
```

## 🌐 前端部署（Vercel）

### 1. 连接GitHub
1. 登录 [Vercel](https://vercel.com)
2. 导入GitHub仓库
3. **Root Directory**: `web`

### 2. 配置构建设置
```yaml
Framework Preset: Next.js
Build Command: pnpm run build
Output Directory: .next
Install Command: pnpm install
Node.js Version: 18.x
```

### 3. 环境变量配置
```bash
# 在Vercel Dashboard添加：
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SUPABASE_URL=https://idezkdxwnzyrzpmwuimj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. 自定义域名
- Vercel Dashboard → 项目设置 → Domains
- 添加自定义域名：`yourdomain.com`
- 配置DNS CNAME记录

## 🔧 关键配置说明

### Docker镜像优化
```dockerfile
✅ 多阶段构建，减小镜像体积
✅ 非root用户运行，提高安全性
✅ 健康检查配置，自动监控
✅ 生产环境依赖优化
```

### TKE Serverless特性
```yaml
✅ 自动扩缩容（0-1000个实例）
✅ 按需付费（CPU/内存使用量计费）
✅ 内置负载均衡和健康检查
✅ 无需管理服务器和K8s
✅ 自动容灾和高可用
```

## 📊 监控和维护

### TKE控制台监控
- **工作负载状态**: 实时查看Pod运行状态
- **资源使用**: CPU、内存、网络监控
- **日志查看**: 实时日志流和历史日志
- **事件监控**: 部署、扩缩容事件

### 常用维护操作
```bash
# 更新镜像
1. 本地更新代码
2. 执行 ./build-and-push.sh 推送新镜像
3. TKE控制台更新工作负载镜像
4. 滚动更新自动完成

# 扩容/缩容
1. TKE控制台调整副本数
2. 或配置HPA自动扩缩容

# 查看日志
1. TKE控制台 → 工作负载 → 日志
2. 支持实时流和历史查询
```

## 💰 成本优化

### 资源配置建议
```yaml
小规模使用 (<1000 DAU):
  副本数: 1-2个
  资源: 2核4GB
  预期成本: ¥200-400/月

中规模使用 (1000-10000 DAU):
  副本数: 2-5个
  资源: 2核4GB
  预期成本: ¥400-1000/月

大规模使用 (>10000 DAU):
  副本数: 5-20个
  资源: 4核8GB
  预期成本: ¥1000-5000/月
```

### 成本控制策略
- 🎯 配置HPA自动扩缩容
- 📊 监控资源使用率，优化配置
- ⏰ 可选择按量计费或包年包月

## 🔒 安全最佳实践

### 1. 网络安全
```yaml
VPC隔离: 
  - 容器运行在私有子网
  - 只通过CLB对外提供服务
  
安全组配置:
  - 最小权限原则
  - 只开放必要端口
```

### 2. 容器安全
```yaml
镜像安全:
  - 使用非root用户运行
  - 定期更新基础镜像
  - 扫描镜像漏洞
  
配置安全:
  - 敏感信息使用Secret管理
  - 环境变量加密存储
```

### 3. 应用安全
```yaml
API安全:
  - HTTPS强制加密
  - CORS正确配置
  - 请求频率限制
```

## 🆘 故障排查

### 常见问题及解决

**镜像构建失败**:
```bash
1. 检查Dockerfile语法
2. 确认conf.yaml和.env.production文件存在
3. 验证Docker环境和Buildx支持
```

**TKE部署失败**:
```bash
1. 检查镜像地址是否正确
2. 验证环境变量配置
3. 查看TKE事件日志
```

**API无法访问**:
```bash
1. 检查负载均衡器状态
2. 验证域名DNS解析
3. 确认SSL证书配置
```

**前端连接后端失败**:
```bash
1. 检查NEXT_PUBLIC_API_URL配置
2. 验证CORS设置
3. 查看浏览器网络请求
```

### 快速诊断命令
```bash
# 本地测试镜像
docker run -p 8000:8000 --env-file .env.production your-image

# 检查域名解析
nslookup api.yourdomain.com

# 测试API连通性
curl -v https://api.yourdomain.com/api/health
```

## 📈 性能优化建议

### 后端优化
- ✅ 已配置uvloop异步优化
- ✅ 数据库连接池自动管理
- ✅ TKE自动负载均衡
- 🎯 可配置HPA自动扩缩容

### 前端优化
- ✅ Vercel全球CDN自动优化
- ✅ Next.js静态生成优化
- ✅ 图片自动压缩和懒加载

## 📝 部署检查清单

### 部署前检查
- [ ] 腾讯云TKE Serverless集群已创建
- [ ] 容器镜像仓库TCR已配置
- [ ] conf.yaml配置文件已创建
- [ ] .env.production配置文件已创建
- [ ] build-and-push.sh脚本中命名空间已修改
- [ ] 域名和SSL证书已准备

### 部署后验证
- [ ] 镜像构建推送成功
- [ ] TKE工作负载运行正常
- [ ] 负载均衡器配置正确
- [ ] 域名解析和SSL证书生效
- [ ] API健康检查通过: `https://api.yourdomain.com/api/health`
- [ ] 前端可以正常连接后端API
- [ ] SSE实时连接正常工作

## 🎉 部署完成

恭喜！你已经成功部署了YADRA的云原生Serverless架构！

### 访问地址
- **前端**: https://yourdomain.com
- **API**: https://api.yourdomain.com/api
- **健康检查**: https://api.yourdomain.com/api/health
- **API文档**: https://api.yourdomain.com/docs

### 后续维护
- 🔄 代码更新：`./build-and-push.sh` + TKE控制台更新
- 📊 监控：TKE控制台实时监控
- 📈 扩容：根据使用量调整副本数或配置HPA
- 💰 成本：定期查看账单，优化资源配置