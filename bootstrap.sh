#!/bin/bash

# YADRA 本地开发环境启动脚本
# 用途：同时启动前端和后端，用于本地开发和调试
# 注意：这不是生产环境部署脚本！生产环境请使用 deploy.sh
#
# 使用方法：
#   ./bootstrap.sh --dev    # 开发模式（推荐）- 启用热重载
#   ./bootstrap.sh          # 生产模式预览
#
# 默认端口：前端 3000，后端 8000
# 注意：如果端口被占用，Next.js会自动使用下一个可用端口

# Start both of YADRA's backend and web UI server.
# If the user presses Ctrl+C, kill them both.

if [ "$1" = "--dev" -o "$1" = "-d" -o "$1" = "dev" -o "$1" = "development" ]; then
  echo -e "🚀 Starting YADRA in [DEVELOPMENT] mode...\n"
  echo "📍 后端: http://localhost:8000"
  echo "📍 前端: http://localhost:3000 (如果端口被占用，会自动使用下一个可用端口)"
  echo "💡 请关注下方启动日志中的实际端口信息"
  echo "📍 按 Ctrl+C 停止所有服务\n"
  uv run server.py --reload & SERVER_PID=$!
  cd web && pnpm dev & WEB_PID=$!
  trap "kill $SERVER_PID $WEB_PID" SIGINT SIGTERM
  wait
else
  echo -e "🚀 Starting YADRA in [LOCAL PRODUCTION] mode...\n"
  echo "📍 后端: http://localhost:8000"
  echo "📍 前端: http://localhost:3000 (如果端口被占用，会自动使用下一个可用端口)"
  echo "💡 请关注下方启动日志中的实际端口信息"
  echo "📍 按 Ctrl+C 停止所有服务\n"
  uv run server.py & SERVER_PID=$!
  cd web && pnpm start & WEB_PID=$!
  trap "kill $SERVER_PID $WEB_PID" SIGINT SIGTERM
  wait
fi
