@echo off
SETLOCAL ENABLEEXTENSIONS

REM YADRA 本地开发环境启动脚本 (Windows)
REM 用途：同时启动前端和后端，用于本地开发和调试
REM 注意：这不是生产环境部署脚本！生产环境请使用 deploy.sh (Linux/Mac)
REM
REM 使用方法：
REM   bootstrap.bat --dev    开发模式（推荐）
REM   bootstrap.bat          生产模式预览

echo YADRA 本地开发环境启动脚本
echo ================================
echo 后端地址: http://localhost:8000
echo 前端地址: http://localhost:3000 (如果端口被占用，会自动使用下一个可用端口)
echo 提示：请关注启动窗口中显示的实际端口信息
echo ================================

REM Check if argument is dev mode
SET MODE=%1
IF "%MODE%"=="--dev" GOTO DEV
IF "%MODE%"=="-d" GOTO DEV
IF "%MODE%"=="dev" GOTO DEV
IF "%MODE%"=="development" GOTO DEV

:PROD
echo Starting YADRA in [LOCAL PRODUCTION] mode...
start uv run server.py
cd web
start pnpm start
REM Wait for user to close
GOTO END

:DEV
echo Starting YADRA in [DEVELOPMENT] mode...
start uv run server.py --reload
cd web
start pnpm dev
REM Wait for user to close
pause

:END
ENDLOCAL
