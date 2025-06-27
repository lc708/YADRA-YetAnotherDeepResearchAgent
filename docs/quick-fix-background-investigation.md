# 快速修复：Background Investigation 节点错误

## 问题描述

在执行研究任务时，`background_investigation_node` 调用 Tavily 搜索引擎时出现错误：

```
ValueError: Since response_format='content_and_artifact' a two-tuple of the message content and raw tool output is expected. Instead generated response of type: <class 'list'>.
```

## 问题原因

1. langchain 的工具系统期望返回 `(content, artifact)` 元组格式
2. 我们之前修改了 `TavilySearchResultsWithImages` 返回列表而不是元组
3. `LoggedTavilySearch` 通过 `create_logged_tool` 包装后，仍然期望元组返回格式

## 已实施的修复

### 1. 恢复元组返回格式
已修改 `src/tools/tavily_search/tavily_search_results_with_images.py`：
- `_run` 和 `_arun` 方法恢复返回 `Tuple[Union[List[Dict[str, str]], str], Dict]`
- 在 artifact 中包含完整的搜索结果数据

### 2. 更新 background_investigation_node
已修改 `src/graph/nodes.py` 中的 `background_investigation_node`：
- 正确处理元组返回值
- 保留原始的标题和 URL 信息
- 在输出中包含 URL 信息

## 引用准确性的长期解决方案

### 方案1：在State中传递引用管理器

```python
# 在 State 中添加
class State(TypedDict):
    # ... 现有字段
    reference_manager: Optional[ReferenceManager]

# 在 background_investigation_node 中
def background_investigation_node(state: State, config: RunnableConfig):
    ref_manager = state.get("reference_manager") or ReferenceManager()
    
    # ... 搜索逻辑
    
    # 保存引用到管理器
    if isinstance(searched_content, list):
        ref_ids = ref_manager.add_from_tavily_results(searched_content)
    
    # 更新 state
    return {
        "background_investigation_results": formatted_results,
        "reference_manager": ref_manager
    }
```

### 方案2：修改工具输出格式

在搜索结果中嵌入引用信息：

```python
# 在 background_investigation_results 中包含结构化数据
background_investigation_results = {
    "text": "\n\n".join(formatted_results),
    "references": [
        {
            "title": elem["title"],
            "url": elem["url"],
            "type": "search"
        }
        for elem in searched_content if elem.get("type") == "page"
    ]
}
```

### 方案3：使用引用感知的工具包装器

已创建 `src/tools/reference_aware_search.py`：
- 自动跟踪所有搜索结果的引用
- 为每个引用生成唯一 ID
- 在输出中包含引用映射

## 测试步骤

1. 启动开发服务器
2. 创建一个新的研究任务
3. 确保启用了 background investigation
4. 验证：
   - background_investigation_node 正常执行
   - projectmanager 收到搜索结果
   - 生成的计划包含背景调查信息

## 后续优化

1. **统一所有工具的输出格式**
   - 搜索工具：返回结构化的引用信息
   - 爬取工具：保留完整的标题和 URL
   - 本地搜索：包含文档元数据

2. **在 researcher 节点中集成引用管理**
   - 使用 ReferenceManager 跟踪所有来源
   - 在输出中包含引用 ID
   - 生成结构化的研究结果

3. **在 reporter 节点中使用精确引用**
   - 从 state 中获取引用管理器
   - 只使用已验证的引用
   - 生成准确的引用列表

## 回滚计划

如果出现问题：

```bash
# 恢复原始文件
git checkout src/tools/tavily_search/tavily_search_results_with_images.py
git checkout src/graph/nodes.py
```

## 监控点

- 检查日志中的 "Tavily search returned tuple with content type"
- 验证 background_investigation_results 不为空
- 确认 projectmanager 收到了背景调查结果 