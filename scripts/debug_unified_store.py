#!/usr/bin/env python3
"""调试unified store的状态和消息存储情况"""

import json
import sys


# 模拟前端的调试信息输出
def debug_unified_store_state():
    print("🔍 Unified Store 状态调试")
    print("=" * 50)

    print("\n📊 关键问题分析:")
    print("1. addMessage方法需要thread存在才能添加消息")
    print("2. thread通过createThread或setCurrentThread创建")
    print("3. SSE事件处理中直接调用store.addMessage(threadId, message)")
    print("4. 如果threadId对应的thread不存在，addMessage会直接return")

    print("\n🔍 可能的问题场景:")
    print("场景1: SSE事件中的threadId与store中的currentThreadId不匹配")
    print("场景2: thread没有正确创建或映射")
    print("场景3: URL参数映射有问题")

    print("\n💡 调试建议:")
    print("1. 检查workspace页面初始化时是否正确设置thread映射")
    print("2. 检查SSE事件中使用的threadId是否与store中的一致")
    print("3. 验证addMessage调用时thread是否存在")

    print("\n🚨 关键代码位置:")
    print("- addMessage实现: unified-store.ts Line 218-237")
    print("- SSE事件处理: workspace/[traceId]/page.tsx Line 250+")
    print("- thread创建: unified-store.ts Line 150-160")


if __name__ == "__main__":
    debug_unified_store_state()
