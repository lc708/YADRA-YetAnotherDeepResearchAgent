# YADRA 生产环境部署指南

## ⚠️ 重要说明：脚本用途区分

**请务必区分以下两种脚本的用途：**

| 脚本 | 用途 | 使用场景 | 运行位置 |
|-----|------|---------|---------|
| 🏠 **bootstrap.sh** | 本地开发环境启动 | 开发、调试、本地测试 | 本地开发机器 |
| 🚀 **deploy.sh** | 生产环境后端部署 | 云服务器部署 | 生产服务器 |

- ❌ **不要在生产环境使用 bootstrap.sh**
- ❌ **不要在本地开发使用 deploy.sh**
- ✅ **本地开发请使用 bootstrap.sh --dev**
- ✅ **生产部署请使用 deploy.sh**

## 🎯 部署架构

YADRA 采用**前后端分离**的部署架构：

- **前端**: Vercel (Next.js)
- **后端**: 云服务器 + Docker
- **数据库**: Supabase PostgreSQL

## 📋 部署前准备

### 1. 域名和SSL
- 准备域名（如：`api.yourdomain.com`）
- 配置DNS解析到后端服务器
- 可选：配置SSL证书

### 2. 云服务器要求
- **最低配置**: 2核4G内存 + 50G SSD
- **推荐配置**: 4核8G内存 + 100G SSD
- **操作系统**: Ubuntu 20.04+ / CentOS 8+
- **软件依赖**: Docker + Docker Compose

### 3. 外部服务准备
- [x] Supabase 数据库已配置
- [ ] OpenAI API Key
- [ ] Tavily Search API Key  
- [ ] DeepSeek API Key（可选）

## 🚀 后端部署步骤

### 1. 服务器环境配置

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 重新登录使docker组生效
newgrp docker
```

### 2. 部署代码

```bash
# 克隆代码
git clone https://github.com/your-repo/YADRA.git
cd YADRA

# 配置环境变量
cp production.env.template .env.production
# 编辑 .env.production 填写实际配置

# 配置应用参数
cp conf.yaml.example conf.yaml
# 编辑 conf.yaml 填写模型配置

# 给生产部署脚本执行权限
chmod +x deploy.sh

# ⚠️ 重要：使用生产环境部署脚本，不是bootstrap.sh！
./deploy.sh
```

### 3. 验证部署

```bash
# 检查容器状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f backend

# 测试健康检查
curl http://localhost/health
```

## 🌐 前端部署（Vercel）

### 1. 连接GitHub
1. 登录 [Vercel](https://vercel.com)
2. 导入GitHub仓库的 `web` 目录

### 2. 配置构建设置
```
Build Command: pnpm run build
Output Directory: .next
Install Command: pnpm install
Root Directory: web
```

### 3. 环境变量配置
在Vercel Dashboard添加环境变量：
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_SUPABASE_URL=https://idezkdxwnzyrzpmwuimj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. 自定义域名（可选）
- 在Vercel Dashboard添加自定义域名
- 配置DNS CNAME记录

## 🔧 配置要点

### 后端关键配置

**nginx.conf 优化**：
- SSE长连接支持（24小时超时）
- 文件上传大小限制
- API代理配置

**Docker资源限制**：
- 内存：4G限制，2G保留
- CPU：2核限制，1核保留

### 前端关键配置

**Next.js优化**：
- `output: "standalone"` 已配置
- 环境变量验证（`env.js`）
- SSE客户端兼容

## 📊 监控和维护

### 日志查看
```bash
# 后端日志
docker-compose -f docker-compose.prod.yml logs -f backend

# Nginx日志  
docker-compose -f docker-compose.prod.yml logs -f nginx

# 系统资源监控
docker stats
```

### 常用维护命令
```bash
# 重启服务
docker-compose -f docker-compose.prod.yml restart

# 更新部署（使用生产部署脚本）
git pull && ./deploy.sh

# 清理无用镜像
docker system prune -f
```

## 🔒 安全建议

1. **防火墙配置**
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

2. **定期备份**
   - 数据库：Supabase自动备份
   - 配置文件：定期Git提交
   - 日志文件：定期轮转清理

3. **监控告警**
   - 使用云服务商监控
   - 配置服务异常告警
   - 定期检查资源使用

## 📈 性能优化

### 后端优化
- 使用uvloop加速（生产环境自动启用）
- PostgreSQL连接池优化
- 适当调整worker数量

### 前端优化  
- Vercel全球CDN自动优化
- 静态资源缓存策略
- 图片懒加载和压缩

## 🆘 故障排查

### 常见问题

**后端无法启动**：
1. 检查环境变量配置
2. 验证数据库连接
3. 查看Docker日志

**SSE连接断开**：
1. 检查nginx配置
2. 验证防火墙设置
3. 查看网络连接稳定性

**前端API请求失败**：
1. 检查CORS配置
2. 验证API地址配置
3. 查看网络请求日志

### 紧急恢复
```bash
# 快速回滚（使用生产部署脚本）
git checkout last-working-commit
./deploy.sh

# 重置数据库（谨慎使用）
# 可以通过Supabase Dashboard操作
```

## 📝 部署检查清单

### 部署前检查
- [ ] 修复`.dockerignore`（确保conf.yaml包含在内）
- [ ] 创建`.env.production`配置文件
- [ ] 创建`conf.yaml`配置文件
- [ ] **确认使用 deploy.sh 而不是 bootstrap.sh**

### 部署后验证
- [ ] 健康检查通过：`curl http://your-domain/health`
- [ ] 容器状态正常：`docker-compose -f docker-compose.prod.yml ps`
- [ ] 前端能正常连接后端API
- [ ] SSE连接正常工作