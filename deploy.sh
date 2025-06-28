#!/bin/bash

# YADRA 生产环境后端部署脚本
# 用途：仅部署后端服务到生产环境（使用Docker）
# 注意：这不是本地开发脚本！本地开发请使用 bootstrap.sh
#
# 前置要求：
#   1. 服务器已安装 Docker 和 Docker Compose
#   2. 已配置 .env.production 文件
#   3. 已配置 conf.yaml 文件
#   4. 前端需要单独部署到 Vercel
#
# 使用方法: ./deploy.sh

set -e

echo "🚀 开始部署 YADRA 后端到生产环境..."
echo "⚠️  注意：这只部署后端，前端需要单独部署到 Vercel"

# 检查必要文件
if [[ ! -f ".env.production" ]]; then
    echo "❌ 未找到 .env.production 文件"
    echo "请复制 production.env.template 并填写配置"
    exit 1
fi

if [[ ! -f "conf.yaml" ]]; then
    echo "❌ 未找到 conf.yaml 文件"
    echo "请复制 conf.yaml.example 并填写配置"
    exit 1
fi

# 创建必要目录
mkdir -p logs
mkdir -p ssl

echo "📦 构建Docker镜像..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "🔄 停止旧容器..."
docker-compose -f docker-compose.prod.yml down

echo "🚀 启动新容器..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ 等待服务启动..."
sleep 10

# 健康检查
echo "🔍 检查服务状态..."
if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务运行正常"
else
    echo "❌ 后端服务启动失败，查看日志..."
    docker-compose -f docker-compose.prod.yml logs backend
    exit 1
fi

echo "📊 显示容器状态..."
docker-compose -f docker-compose.prod.yml ps

echo "🎉 后端部署完成！"
echo "🌐 后端API地址: http://your-domain.com/api"
echo "📋 查看日志: docker-compose -f docker-compose.prod.yml logs -f"
echo "📝 记住：前端需要单独部署到 Vercel" 