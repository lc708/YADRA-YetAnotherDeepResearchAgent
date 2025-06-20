import asyncio
import os
import json
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv()


async def debug_recent_langgraph():
    db_url = os.getenv("DATABASE_URL")

    async with await psycopg.AsyncConnection.connect(db_url) as conn:
        cursor = conn.cursor(row_factory=dict_row)

        # 查看最近的LangGraph执行
        print("=== 最近的LangGraph执行 ===")

        # 获取最近的checkpoints和对应的数据
        await cursor.execute(
            """
            SELECT thread_id, checkpoint_id, checkpoint, metadata
            FROM checkpoints 
            ORDER BY checkpoint_id DESC
            LIMIT 5
        """
        )
        recent_checkpoints = await cursor.fetchall()

        for i, cp in enumerate(recent_checkpoints):
            print(f"\n--- 最近执行 {i+1} ---")
            print(f"Thread ID: {cp['thread_id']}")
            print(f"Checkpoint ID: {cp['checkpoint_id']}")

            # 解析checkpoint数据
            checkpoint_data = cp["checkpoint"]
            if checkpoint_data:
                try:
                    # 查看channel_values
                    channel_values = checkpoint_data.get("channel_values", {})

                    # 研究主题
                    research_topic = channel_values.get("research_topic", "")
                    if research_topic:
                        print(f"研究主题: {research_topic}")

                    # 消息数量
                    messages = channel_values.get("messages", [])
                    print(f"消息数量: {len(messages)}")

                    # 最新消息
                    if messages:
                        last_msg = messages[-1]
                        if isinstance(last_msg, dict):
                            print(
                                f"最新消息: [{last_msg.get('role', 'unknown')}] {str(last_msg.get('content', ''))[:100]}..."
                            )

                    # Artifacts
                    artifacts = channel_values.get("artifacts", [])
                    print(f"Artifacts数量: {len(artifacts)}")

                    # 计划
                    current_plan = channel_values.get("current_plan")
                    if current_plan:
                        print(f"当前计划: {str(current_plan)[:100]}...")

                except Exception as e:
                    print(f"解析checkpoint失败: {e}")

        # 查看与我们的时间范围相近的执行
        print(f"\n=== 查找2025-06-18时间范围的执行 ===")

        # 查找session中的thread_id对应的执行时间
        await cursor.execute(
            """
            SELECT thread_id, checkpoint_id, checkpoint
            FROM checkpoints 
            WHERE checkpoint_id::text LIKE '%2025-06-18%' 
               OR checkpoint_id::text LIKE '%20:41%'
               OR checkpoint_id::text LIKE '%04:41%'
            ORDER BY checkpoint_id DESC
            LIMIT 10
        """
        )
        time_related = await cursor.fetchall()

        print(f"找到时间相关的checkpoints: {len(time_related)}")
        for cp in time_related:
            print(f"  - Thread: {cp['thread_id']}, ID: {cp['checkpoint_id']}")

        # 检查是否有包含"jewelry"关键词的研究
        print(f"\n=== 查找包含'jewelry'的研究 ===")

        await cursor.execute(
            """
            SELECT thread_id, checkpoint_id, checkpoint
            FROM checkpoints 
            WHERE checkpoint::text ILIKE '%jewelry%'
               OR checkpoint::text ILIKE '%valuable%'
            ORDER BY checkpoint_id DESC
            LIMIT 5
        """
        )
        jewelry_related = await cursor.fetchall()

        print(f"找到jewelry相关的checkpoints: {len(jewelry_related)}")
        for cp in jewelry_related:
            print(f"  - Thread: {cp['thread_id']}, ID: {cp['checkpoint_id']}")

            # 显示研究主题
            checkpoint_data = cp["checkpoint"]
            if checkpoint_data:
                channel_values = checkpoint_data.get("channel_values", {})
                research_topic = channel_values.get("research_topic", "")
                if research_topic:
                    print(f"    研究主题: {research_topic}")

        # 检查thread_id生成逻辑问题
        print(f"\n=== 检查Session表中的thread_id ===")
        await cursor.execute(
            """
            SELECT thread_id, url_param, initial_question, created_at
            FROM session_mapping 
            WHERE url_param = 'most-valuable-jewelry-each-year-past-RZsGesir'
        """
        )
        session_info = await cursor.fetchone()

        if session_info:
            print(f"Session Thread ID: {session_info['thread_id']}")
            print(f"URL Param: {session_info['url_param']}")
            print(f"Question: {session_info['initial_question']}")
            print(f"Created: {session_info['created_at']}")

            # 检查是否存在相似的thread_id
            similar_thread = session_info["thread_id"].replace("thread_", "")
            await cursor.execute(
                """
                SELECT thread_id, checkpoint_id
                FROM checkpoints 
                WHERE thread_id LIKE %s
                LIMIT 5
            """,
                (f"%{similar_thread}%",),
            )
            similar_checkpoints = await cursor.fetchall()

            print(f"相似thread_id的checkpoints: {len(similar_checkpoints)}")
            for cp in similar_checkpoints:
                print(f"  - {cp['thread_id']}")


if __name__ == "__main__":
    asyncio.run(debug_recent_langgraph())
