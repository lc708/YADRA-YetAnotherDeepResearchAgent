# 统一数据架构设计

## 问题分析

当前架构存在数据流不一致的问题：
- **实时数据**：SSE流（直接来自LangGraph）
- **历史数据**：数据库查询（来自save_message/save_artifact，可能失败）
- **LangGraph数据**：checkpoints表（始终可靠）

## 解决方案对比

### 方案A：基于Checkpoints的统一数据源 ⭐ 推荐

**核心思想**：将checkpoints表作为唯一数据源，废弃自定义的message_history和artifact_storage表。

**优势**：
- ✅ 数据一致性：LangGraph保证checkpoints数据的完整性
- ✅ 实时性：SSE直接从LangGraph获取，checkpoints同步更新
- ✅ 简化架构：减少数据同步问题
- ✅ 可靠性：不依赖自定义的保存逻辑

**实现步骤**：
1. 创建CheckpointDataAdapter，解析checkpoints中的LangGraph状态
2. 修改workspace API，从checkpoints读取历史数据
3. 保留SSE用于实时更新
4. 逐步废弃message_history和artifact_storage表

```python
class CheckpointDataAdapter:
    """从LangGraph checkpoints提取前端需要的数据"""
    
    async def get_messages_from_checkpoints(self, thread_id: str) -> List[Message]:
        """从checkpoints解析消息历史"""
        checkpoints = await self.get_checkpoints(thread_id)
        messages = []
        
        for checkpoint in checkpoints:
            state = checkpoint.get('checkpoint', {}).get('channel_values', {})
            if 'messages' in state:
                for msg in state['messages']:
                    messages.append({
                        'role': msg.get('role', 'assistant'),
                        'content': msg.get('content', ''),
                        'agent': self.extract_agent_from_checkpoint(checkpoint),
                        'timestamp': checkpoint.get('created_at')
                    })
        
        return messages
    
    async def get_artifacts_from_checkpoints(self, thread_id: str) -> List[Artifact]:
        """从checkpoints解析artifacts"""
        checkpoints = await self.get_checkpoints(thread_id)
        artifacts = []
        
        for checkpoint in checkpoints:
            state = checkpoint.get('checkpoint', {}).get('channel_values', {})
            
            # 提取plan
            if 'current_plan' in state:
                artifacts.append({
                    'type': 'research_plan',
                    'title': '研究计划',
                    'content': json.dumps(state['current_plan']),
                    'timestamp': checkpoint.get('created_at')
                })
            
            # 提取final_report
            if 'final_report' in state:
                artifacts.append({
                    'type': 'summary',
                    'title': '研究报告',
                    'content': state['final_report'],
                    'timestamp': checkpoint.get('created_at')
                })
        
        return artifacts
```

### 方案B：修复双数据源架构

**核心思想**：保持当前架构，但修复数据保存逻辑。

**实现**：
1. 增强错误处理和重试机制
2. 添加数据同步验证
3. 实现数据修复工具

**缺点**：
- ❌ 架构复杂性高
- ❌ 维护成本大
- ❌ 仍然存在同步风险

### 方案C：前端缓存优化

**核心思想**：前端缓存SSE数据，减少对数据库依赖。

**实现**：
- 前端LocalStorage缓存SSE数据
- 页面刷新时优先使用缓存
- 数据库作为最后备份

**缺点**：
- ❌ 缓存管理复杂
- ❌ 多设备同步问题
- ❌ 数据丢失风险

## 推荐实施方案A

### 第一阶段：创建CheckpointDataAdapter
```python
# src/server/adapters/checkpoint_data_adapter.py
class CheckpointDataAdapter:
    def __init__(self, db_url: str):
        self.db_url = db_url
    
    async def get_workspace_data_from_checkpoints(self, thread_id: str) -> Dict:
        """从checkpoints获取完整的workspace数据"""
        messages = await self.get_messages_from_checkpoints(thread_id)
        artifacts = await self.get_artifacts_from_checkpoints(thread_id)
        execution_status = await self.get_execution_status(thread_id)
        
        return {
            'messages': messages,
            'artifacts': artifacts,
            'status': execution_status,
            'source': 'checkpoints'  # 标记数据源
        }
```

### 第二阶段：修改workspace API
```python
@router.get("/workspace/{url_param}")
async def get_workspace_data(url_param: str):
    # 优先使用checkpoints数据
    checkpoint_adapter = CheckpointDataAdapter(db_url)
    workspace_data = await checkpoint_adapter.get_workspace_data_from_checkpoints(thread_id)
    
    # 如果checkpoints没有数据，再尝试从自定义表读取（向后兼容）
    if not workspace_data['messages']:
        workspace_data = await get_workspace_data_from_custom_tables(session_id)
    
    return workspace_data
```

### 第三阶段：逐步迁移
1. 并行运行两套系统
2. 对比数据一致性
3. 逐步切换到checkpoints
4. 废弃自定义表

## 实时性对比

| 数据源 | 实时性 | 一致性 | 可靠性 | 复杂度 |
|--------|--------|--------|--------|--------|
| SSE | 毫秒级 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| Checkpoints | 秒级 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| 自定义表 | 秒级 | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

**结论**：Checkpoints提供最佳的一致性和可靠性，实时性略低但完全可接受。

## 迁移计划

### Week 1: 分析和设计
- [x] 分析现有数据流问题
- [ ] 设计CheckpointDataAdapter接口
- [ ] 制定迁移策略

### Week 2: 实现适配器
- [ ] 实现CheckpointDataAdapter
- [ ] 单元测试和集成测试
- [ ] 性能基准测试

### Week 3: API迁移
- [ ] 修改workspace API
- [ ] 实现数据源切换逻辑
- [ ] 向后兼容性测试

### Week 4: 前端适配
- [ ] 前端适配新的数据格式
- [ ] 端到端测试
- [ ] 性能优化

### Week 5: 上线和监控
- [ ] 灰度发布
- [ ] 数据一致性监控
- [ ] 清理废弃代码 