#!/usr/bin/env python3
"""
PostgreSQL Setup Script for YADRA S1
基于现有Supabase配置设置PostgreSQL连接
"""

import os
import re
from urllib.parse import urlparse
from dotenv import load_dotenv


def extract_project_ref_from_supabase_url(supabase_url):
    """从Supabase URL中提取project reference"""
    # https://idezkdxwnzyrzpmwuimj.supabase.co -> idezkdxwnzyrzpmwuimj
    pattern = r"https://([a-zA-Z0-9]+)\.supabase\.co"
    match = re.match(pattern, supabase_url)
    if match:
        return match.group(1)
    return None


def get_connection_strings(project_ref, password):
    """构建多种PostgreSQL连接字符串"""
    connections = {
        "direct": (
            f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:5432/postgres"
        ),
        "session_pooler": (
            f"postgresql://postgres.{project_ref}:{password}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
        ),
        "transaction_pooler": (
            f"postgresql://postgres.{project_ref}:{password}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
        ),
    }
    return connections


def expand_env_vars(text):
    """展开环境变量，如 ${VAR_NAME}"""
    import re

    def replace_var(match):
        var_name = match.group(1)
        return os.getenv(var_name, match.group(0))

    return re.sub(r"\$\{([^}]+)\}", replace_var, text)


def test_database_connection(db_url, connection_type=""):
    """测试数据库连接"""
    try:
        import psycopg

        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
                print(f"✅ {connection_type}连接成功! PostgreSQL 版本: {version}")
                return True
    except Exception as e:
        print(f"❌ {connection_type}连接失败: {e}")
        if "nodename nor servname provided" in str(e):
            print("   提示: DNS解析失败")
        elif "authentication failed" in str(e):
            print("   提示: 密码可能不正确")
        elif "timeout" in str(e):
            print("   提示: 连接超时")
        elif "Connection refused" in str(e):
            print("   提示: 连接被拒绝")
        return False


def main():
    # 加载环境变量
    load_dotenv()

    print("🔍 检查当前配置...")

    # 检查Supabase URL
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    if not supabase_url:
        print("❌ 错误: 未找到 NEXT_PUBLIC_SUPABASE_URL")
        print("请确保 .env 文件中包含 Supabase 配置")
        return False

    print(f"   SUPABASE_URL: {supabase_url}")

    # 提取project reference
    project_ref = extract_project_ref_from_supabase_url(supabase_url)
    if not project_ref:
        print("❌ 错误: 无法从 Supabase URL 提取 project reference")
        return False

    print(f"   Project Ref: {project_ref}")

    # 检查密码配置
    db_password = os.getenv("SUPABASE_DB_PASSWORD")
    if not db_password:
        print("\n❌ 未找到 SUPABASE_DB_PASSWORD")
        print("请在 .env 文件中添加以下配置:")
        print(f"SUPABASE_DB_PASSWORD=你的数据库密码")
        print(
            f"DATABASE_URL=postgresql://postgres:${{SUPABASE_DB_PASSWORD}}@db.{project_ref}.supabase.co:5432/postgres"
        )
        print("\n获取密码的步骤:")
        print("1. 登录 https://supabase.com/dashboard")
        print("2. 选择你的项目")
        print("3. 转到 Settings → Database")
        print("4. 查看 Connection string 部分")
        print("5. 复制 postgres 用户的密码")
        return False

    print(f"✅ 找到密码配置: {db_password[:3]}***")

    # 获取所有连接字符串选项
    connections = get_connection_strings(project_ref, db_password)

    # 检查DATABASE_URL配置
    raw_database_url = os.getenv("DATABASE_URL")
    if raw_database_url:
        expanded_database_url = expand_env_vars(raw_database_url)
        print(f"✅ 找到 DATABASE_URL 配置")

        # 测试现有配置
        print("\n🔧 测试现有DATABASE_URL...")
        if test_database_connection(expanded_database_url, "当前配置"):
            return True

        print("\n⚠️  当前配置连接失败，尝试其他连接方式...")

    # 尝试不同的连接方式
    print(f"\n🔧 测试多种连接方式...")

    # 1. 尝试Session Pooler (推荐用于持久连接，仅IPv4)
    print("\n1️⃣ 尝试Session Pooler (IPv4支持，适合持久应用)...")
    if test_database_connection(connections["session_pooler"], "Session Pooler"):
        print(f"\n✅ 推荐使用Session Pooler连接!")
        print(f"📄 请更新你的 .env 文件:")
        print(
            f"DATABASE_URL=postgresql://postgres.{project_ref}:${{SUPABASE_DB_PASSWORD}}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
        )
        print(
            "ℹ️  Session Pooler: IPv4支持，适合持久服务器应用，支持prepared statements"
        )
        return True

    # 2. 尝试Transaction Pooler (推荐用于无服务器函数，仅IPv4)
    print("\n2️⃣ 尝试Transaction Pooler (IPv4支持，适合无状态应用)...")
    if test_database_connection(
        connections["transaction_pooler"], "Transaction Pooler"
    ):
        print(f"\n✅ Transaction Pooler可用!")
        print(f"📄 请更新你的 .env 文件:")
        print(
            f"DATABASE_URL=postgresql://postgres.{project_ref}:${{SUPABASE_DB_PASSWORD}}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
        )
        print("ℹ️  Transaction Pooler: IPv4支持，适合无状态/serverless应用")
        print(
            "⚠️  注意: Transaction Pooler不支持prepared statements，可能影响LangGraph性能"
        )
        return True

    # 3. 尝试直连 (IPv6，最佳性能)
    print("\n3️⃣ 尝试直连 (IPv6，最佳性能)...")
    if test_database_connection(connections["direct"], "直连"):
        print(f"\n✅ 直连可用!")
        print(f"📄 请更新你的 .env 文件:")
        print(
            f"DATABASE_URL=postgresql://postgres:${{SUPABASE_DB_PASSWORD}}@db.{project_ref}.supabase.co:5432/postgres"
        )
        print("ℹ️  直连: 最佳性能，但仅支持IPv6网络")
        return True

    print("\n❌ 所有连接方式都失败了，请检查:")
    print("1. SUPABASE_DB_PASSWORD 是否正确")
    print("2. 网络连接是否正常")
    print("3. Supabase项目是否正常运行")
    print("4. 是否需要在Supabase dashboard中添加IP白名单")
    return False


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
