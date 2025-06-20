import asyncio
import os
from dotenv import load_dotenv
from src.graph.async_builder import create_graph

load_dotenv()


async def test_checkpointer():
    print("🔄 测试 LangGraph checkpointer...")

    try:
        # 创建graph实例
        graph = await create_graph()
        print("✅ Graph 创建成功")

        # 检查是否有checkpointer
        if hasattr(graph, "checkpointer") and graph.checkpointer:
            print("✅ Graph 有 checkpointer")
            print(f"   Checkpointer类型: {type(graph.checkpointer)}")
        else:
            print("❌ Graph 没有 checkpointer")
            return

        # 测试简单的执行
        test_thread_id = "test_thread_123"
        initial_state = {
            "messages": [{"role": "user", "content": "测试消息"}],
            "research_topic": "测试主题",
            "locale": "zh-CN",
            "auto_accepted_plan": True,
            "enable_background_investigation": False,
            "plan_iterations": 0,
        }

        config = {"configurable": {"thread_id": test_thread_id}}

        print(f"🚀 开始测试执行，thread_id: {test_thread_id}")

        # 只执行一步看看是否会保存checkpoint
        try:
            event_count = 0
            async for event in graph.astream(
                initial_state, config, stream_mode="updates"
            ):
                event_count += 1
                print(
                    f"📊 收到事件 {event_count}: {list(event.keys()) if isinstance(event, dict) else type(event)}"
                )

                # 只执行一个事件就停止
                if event_count >= 1:
                    break

        except Exception as e:
            print(f"❌ 执行过程中出错: {e}")
            return

        # 检查是否生成了checkpoint
        print(f"🔍 检查是否生成了checkpoint...")

        # 使用checkpointer直接查询
        try:
            state_snapshot = await graph.aget_state(config)
            if state_snapshot and state_snapshot.values:
                print("✅ 找到了state snapshot")
                print(f"   State keys: {list(state_snapshot.values.keys())}")
                print(f"   Config: {state_snapshot.config}")
            else:
                print("❌ 没有找到state snapshot")
        except Exception as e:
            print(f"❌ 查询state失败: {e}")

        # 直接查询数据库
        import psycopg
        from psycopg.rows import dict_row

        db_url = os.getenv("DATABASE_URL")
        async with await psycopg.AsyncConnection.connect(db_url) as conn:
            cursor = conn.cursor(row_factory=dict_row)

            await cursor.execute(
                """
                SELECT COUNT(*) as count
                FROM checkpoints 
                WHERE thread_id = %s
            """,
                (test_thread_id,),
            )
            result = await cursor.fetchone()

            print(f"📊 数据库中的checkpoint数量: {result['count']}")

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_checkpointer())
