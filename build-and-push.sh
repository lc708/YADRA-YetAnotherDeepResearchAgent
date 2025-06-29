#!/bin/bash
# YADRA Docker镜像构建推送脚本
# 用途：构建多平台Docker镜像并推送到腾讯云容器镜像仓库
# 使用方法：./build-and-push.sh

set -e

# ===== 配置变量 =====
# 请修改为你的实际信息
REGISTRY="ccr.ccs.tencentyun.com"
NAMESPACE="yadra_prod"  # 替换为你在腾讯云创建的命名空间
IMAGE_NAME="yadra"
TAG="latest"

# 完整镜像地址
FULL_IMAGE="${REGISTRY}/${NAMESPACE}/${IMAGE_NAME}:${TAG}"

echo "🚀 开始构建YADRA Docker镜像..."
echo "📍 目标镜像: ${FULL_IMAGE}"
echo ""

# ===== 环境检查 =====
echo "🔍 检查构建环境..."

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker Buildx
if ! docker buildx version &> /dev/null; then
    echo "❌ Docker Buildx不可用，请启用Docker Buildx"
    exit 1
fi

echo "✅ Docker环境检查通过"

# ===== 文件检查 =====
echo "🔍 检查必要文件..."

if [[ ! -f "conf.yaml" ]]; then
    echo "❌ 缺少 conf.yaml 文件"
    echo "请执行: cp conf.yaml.example conf.yaml 并填写配置"
    exit 1
fi

if [[ ! -f ".env.production" ]]; then
    echo "❌ 缺少 .env.production 文件"  
    echo "请执行: cp production.env.template .env.production 并填写配置"
    exit 1
fi

if [[ ! -f "Dockerfile" ]]; then
    echo "❌ 缺少 Dockerfile 文件"
    exit 1
fi

echo "✅ 必要文件检查通过"

# ===== 登录腾讯云镜像仓库 =====
echo "🔐 登录腾讯云镜像仓库..."
echo "请输入腾讯云账号密码或使用访问密钥:"

if ! docker login ${REGISTRY}; then
    echo "❌ 登录腾讯云镜像仓库失败"
    echo "请确认账号密码或访问密钥正确"
    exit 1
fi

echo "✅ 成功登录腾讯云镜像仓库"

# ===== 构建镜像 =====
echo "📦 构建多平台Docker镜像..."
echo "目标平台: linux/amd64"
echo ""

# 创建并使用多平台构建器（如果不存在）
if ! docker buildx ls | grep -q "yadra-builder"; then
    echo "📝 创建多平台构建器..."
    docker buildx create --name yadra-builder --use
    docker buildx inspect --bootstrap
else
    echo "📝 使用现有构建器..."
    docker buildx use yadra-builder
fi

# 构建镜像
echo "🔨 开始构建镜像..."
docker buildx build \
    --platform linux/amd64 \
    -t ${FULL_IMAGE} \
    --load \
    .

if [ $? -eq 0 ]; then
    echo "✅ 镜像构建成功"
else
    echo "❌ 镜像构建失败"
    exit 1
fi

# ===== 推送镜像 =====
echo "⬆️  推送镜像到腾讯云..."
docker push ${FULL_IMAGE}

if [ $? -eq 0 ]; then
    echo "✅ 镜像推送成功!"
else
    echo "❌ 镜像推送失败"
    exit 1
fi

# ===== 完成信息 =====
echo ""
echo "🎉 Docker镜像构建推送完成!"
echo "📍 镜像地址: ${FULL_IMAGE}"
echo ""
echo "📋 下一步操作:"
echo "1. 在腾讯云TKE控制台创建工作负载"
echo "2. 使用镜像地址: ${FULL_IMAGE}"
echo "3. 配置环境变量（从.env.production复制）"
echo "4. 设置资源规格: 2核4GB内存"
echo "5. 配置负载均衡器和域名"
echo "6. 部署并测试"
echo ""
echo "🔗 有用的命令:"
echo "查看镜像信息: docker inspect ${FULL_IMAGE}"
echo "本地测试镜像: docker run -p 8000:8000 --env-file .env.production ${FULL_IMAGE}" 