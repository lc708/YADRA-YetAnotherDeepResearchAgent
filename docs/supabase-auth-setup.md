# Supabase 认证设置指南

## 问题诊断

### 已解决的问题
1. ✅ **邮箱验证**：已在 Supabase Dashboard 中禁用邮箱验证（开发环境）
2. ✅ **Pydantic 验证错误**：已修复 datetime 对象转换为 ISO 字符串的问题
3. ✅ **SQL 语法错误**：已修复 PostgreSQL 的 `CREATE POLICY IF NOT EXISTS` 语法问题

### 注意事项
1. **邮箱域名限制**：某些测试域名（如 test.com, example.com）被 Supabase 拒绝
2. **使用 .test 域名**：`@yadra.test` 域名在禁用邮箱验证后可以正常使用

## 开发环境配置

### 方案 1：禁用邮箱验证（推荐用于开发）

1. 访问 Supabase Dashboard: https://supabase.com/dashboard/project/idezkdxwnzyrzpmwuimj/auth/users
2. 进入 `Auth > Providers > Email`
3. 关闭 `Confirm email` 选项
4. 保存更改

### 方案 2：使用测试用户

在 Supabase Dashboard 中手动创建测试用户：
1. 进入 `Authentication > Users`
2. 点击 `Add user`
3. 创建用户并设置密码
4. 手动确认邮箱（点击用户详情中的确认按钮）

### 方案 3：配置 SMTP（生产环境）

1. 进入 `Auth > Email Templates`
2. 配置 SMTP 设置
3. 自定义邮件模板

## 测试账号

已创建的固定测试账号（开发环境）：

### 1. 开发用户
- 邮箱：`dev@yadra.test`
- 密码：`Dev123456!`
- 用户 ID：`dd1148c4-db23-4098-a246-c0f196bbe535`
- 特性：推理模式已启用

### 2. 测试用户
- 邮箱：`test@yadra.test`
- 密码：`Test123456!`
- 用户 ID：`3d2b41af-2815-4bf8-b7c9-f2c2eb82f066`
- 特性：推理模式已禁用

### 3. 管理员用户
- 邮箱：`admin@yadra.test`
- 密码：`Admin123456!`
- 特性：推理模式已启用

## API 使用示例

### 注册用户
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@yadra.test",
    "password": "Password123!",
    "display_name": "New User",
    "enable_deep_thinking": false
  }'
```

### 登录（使用测试账号）
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@yadra.test",
    "password": "Dev123456!"
  }'
```

### 获取用户信息
```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 前端集成

前端需要：
1. 存储 access_token 和 refresh_token
2. 在所有需要认证的请求中添加 `Authorization: Bearer {token}` header
3. 处理 token 过期和刷新逻辑

## 环境变量

确保设置了以下环境变量：
```bash
NEXT_PUBLIC_SUPABASE_URL=https://idezkdxwnzyrzpmwuimj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # 可选，用于管理员操作
DATABASE_URL=your-database-url
```

## 快速测试

使用以下命令快速测试认证系统：

```bash
# 测试登录功能
uv run python test_login.py

# 创建新的测试用户
uv run python create_dev_users.py
```

## 认证系统架构

1. **用户数据存储**：
   - 主要用户数据存储在 Supabase 的 `auth.users` 表
   - 扩展信息存储在 `user_profiles` 表（display_name, enable_deep_thinking）
   - 任务管理存储在 `user_tasks` 表

2. **安全特性**：
   - 使用 JWT Token 进行身份验证
   - 启用 Row Level Security (RLS) 确保数据隔离
   - 用户只能访问自己的数据

3. **API 端点**：
   - `POST /api/auth/register` - 用户注册
   - `POST /api/auth/login` - 用户登录
   - `POST /api/auth/logout` - 用户登出
   - `GET /api/auth/me` - 获取当前用户信息
   - `PUT /api/auth/me` - 更新用户信息
   - `GET /api/tasks` - 获取任务列表
   - `POST /api/tasks/{thread_id}` - 创建/更新任务 