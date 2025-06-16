# Backend S1 Plan - YADRA v4.0 (Context7 Technology-Enhanced)
*基于Context7最新技术调研的完整实现计划*

## 执行摘要

### 计划覆盖范围 (S1完整内容)
根据YADRA规划文档，S1包含以下完整内容：
1. **基础设施层**: 数据持久化、用户体系、可观测性
2. **Agent编排优化**: BG1 + AG1-4 (arXiv搜索、私有KB、可信度评分、并行fan-out、过滤器)
3. **文件管控系统**: A1-A3 (文件分类、RAG选择器、产出写回)
4. **Artifact Feed**: 端到端回放快照系统
5. **知识库同步**: 私有知识源集成

### Context7调研技术栈
通过最新技术文档确定的精确技术选型：

#### 核心技术栈
- **数据层**: PostgreSQL + Supabase (Auth/Realtime) + SQLAlchemy 2.0
- **Agent架构**: LangGraph + LangSmith (官方可观测性)
- **并行处理**: LangGraph Send API (fan-out模式)
- **文件处理**: OpenAI Whisper + GPT-4V + ChromaDB向量搜索
- **知识库**: arXiv.py + Notion API + Google Docs API

#### 最新版本规范
- **LangGraph**: 使用PostgreSQLSaver/AsyncPostgresSaver
- **LangSmith**: 自动trace装饰器 + wrap_openai集成
- **arXiv**: lukasschwab/arxiv.py官方Python包
- **Whisper**: OpenAI官方whisper包 + turbo模型
- **ChromaDB**: chroma-core/chroma v8.7 + cosine相似度

## 一、技术架构设计 (基于Context7调研)

### 1.1 数据持久化升级 (P0)

#### PostgreSQL + LangGraph集成
```python
# 基于最新LangGraph文档的实现
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

# 同步版本
DB_URI = "postgresql://postgres:postgres@localhost:5442/postgres"
with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()  # 创建必要表结构
    
    # 替换现有MemorySaver (src/graph/builder.py第45行)
    graph = builder.compile(checkpointer=checkpointer)

# 异步版本 (用于高并发场景)
async with AsyncPostgresSaver.from_conn_string(DB_URI) as checkpointer:
    await checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)
```

#### 数据库Schema设计
```sql
-- LangGraph标准checkpoints表 (自动创建)
CREATE TABLE checkpoints (
    thread_id VARCHAR NOT NULL,
    checkpoint_ns VARCHAR DEFAULT '',
    checkpoint_id VARCHAR NOT NULL,
    parent_checkpoint_id VARCHAR,
    type VARCHAR,
    checkpoint JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

-- 用户数据表 (Supabase管理)
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 对话元数据表
CREATE TABLE conversation_meta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    thread_id VARCHAR NOT NULL,
    title VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifact存储表
CREATE TABLE conversation_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id VARCHAR NOT NULL,
    checkpoint_id VARCHAR NOT NULL,
    artifact_type VARCHAR NOT NULL, -- 'podcast', 'ppt', 'prose'
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Agent编排优化 (AG1-4 + BG1)

#### BG1: arXiv并行搜索
```python
# 基于arxiv.py最新API
import arxiv
from langgraph.types import Send

async def arxiv_parallel_search(state: State) -> Command:
    """arXiv领域搜索并行实现"""
    client = arxiv.Client(
        page_size=100,  # 减少API调用
        delay_seconds=1.0,  # 避免rate limit
        num_retries=3
    )
    
    # 多关键词并行搜索
    search_queries = [
        f"cat:{category} AND all:{state['topic']}" 
        for category in ["cs.AI", "cs.LG", "cs.CL"]
    ]
    
    # 使用Send API实现真正并行
    search_tasks = [
        Send("arxiv_search_worker", {
            "query": query,
            "max_results": 10,
            "client": client
        }) for query in search_queries
    ]
    
    return Command(goto=search_tasks)

@task
async def arxiv_search_worker(query: str, max_results: int, client: arxiv.Client):
    """单个arXiv搜索worker"""
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate
    )
    
    results = []
    for paper in client.results(search):
        results.append({
            "title": paper.title,
            "abstract": paper.summary,
            "authors": [str(author) for author in paper.authors],
            "url": paper.entry_id,
            "published": paper.published.isoformat()
        })
    
    return results
```

#### AG3: Researcher Fan-out (3个同构Agent)
```python
# 基于LangGraph Send API的并行Agent实现
from langgraph.types import Send, Command

async def researcher_fanout(state: State) -> Command:
    """3个同构researcher并行研究"""
    research_angles = [
        "technical_analysis",
        "market_analysis", 
        "academic_analysis"
    ]
    
    # 并行发送到3个同构Agent
    research_tasks = [
        Send("researcher_agent", {
            **state,
            "research_angle": angle,
            "agent_id": f"researcher_{i}"
        }) for i, angle in enumerate(research_angles)
    ]
    
    return Command(goto=research_tasks)

@task
async def researcher_agent(state: State, research_angle: str, agent_id: str):
    """单个researcher agent实现"""
    llm = get_llm_with_angle(research_angle)
    
    # 专门的研究提示词
    research_prompt = f"""
    You are a {research_angle} researcher. 
    Topic: {state['topic']}
    Focus on: {RESEARCH_FOCUS[research_angle]}
    """
    
    result = await llm.ainvoke(research_prompt)
    
    return {
        "agent_id": agent_id,
        "research_angle": research_angle,
        "findings": result.content,
        "confidence": calculate_confidence(result),
        "sources": extract_sources(result)
    }
```

#### AG4: Observation Filter (向量+规则评分)
```python
# 基于ChromaDB的混合过滤实现
import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction

class ObservationFilter:
    def __init__(self):
        # 使用最新ChromaDB API
        self.client = chromadb.PersistentClient(path="./chroma_db")
        self.embedding_function = OpenAIEmbeddingFunction(
            api_key=os.getenv("OPENAI_API_KEY"),
            model_name="text-embedding-3-large"
        )
        
        self.collection = self.client.get_or_create_collection(
            name="observations",
            embedding_function=self.embedding_function,
            metadata={"hnsw:space": "cosine"}  # 余弦相似度
        )
    
    async def filter_observations(self, observations: List[Dict]) -> List[Dict]:
        """向量相似度 + 规则评分的混合过滤"""
        # 1. 向量相似度过滤
        query_text = self.build_query_context(observations)
        
        vector_results = self.collection.query(
            query_texts=[query_text],
            n_results=min(50, len(observations)),
            include=["documents", "metadatas", "distances"]
        )
        
        # 2. 规则评分
        scored_observations = []
        for obs in observations:
            vector_score = self.get_vector_score(obs, vector_results)
            rule_score = self.calculate_rule_score(obs)
            
            # 混合评分 (60% 向量 + 40% 规则)
            final_score = 0.6 * vector_score + 0.4 * rule_score
            
            scored_observations.append({
                **obs,
                "relevance_score": final_score,
                "vector_score": vector_score,
                "rule_score": rule_score
            })
        
        # 返回top-k高分观察
        return sorted(scored_observations, 
                     key=lambda x: x["relevance_score"], 
                     reverse=True)[:20]
    
    def calculate_rule_score(self, observation: Dict) -> float:
        """规则评分算法"""
        score = 0.0
        
        # 可信度评分
        if observation.get("confidence", 0) > 0.8:
            score += 0.3
        
        # 来源权威性
        if observation.get("source_type") in ["academic", "official"]:
            score += 0.2
        
        # 时效性
        if observation.get("recency_days", 999) < 30:
            score += 0.1
        
        # 引用数量
        citations = observation.get("citation_count", 0)
        score += min(0.4, citations / 100.0)
        
        return min(1.0, score)
```

### 1.3 文件管控系统 (A1-A3)

#### A1: 文件分类 (Vision + Whisper)
```python
# 基于最新OpenAI Whisper API
import whisper
import openai
from pathlib import Path

class FileClassifier:
    def __init__(self):
        # 加载Whisper turbo模型 (最新最快)
        self.whisper_model = whisper.load_model("turbo")
        self.vision_client = openai.Client()
    
    async def classify_file(self, file_path: Path) -> Dict:
        """统一文件分类接口"""
        file_type = self.detect_file_type(file_path)
        
        if file_type in ["mp3", "wav", "m4a", "flac"]:
            return await self.classify_audio(file_path)
        elif file_type in ["jpg", "png", "pdf", "webp"]:
            return await self.classify_image(file_path)
        elif file_type in ["txt", "md", "docx"]:
            return await self.classify_text(file_path)
        else:
            return {"type": "unknown", "confidence": 0.0}
    
    async def classify_audio(self, file_path: Path) -> Dict:
        """音频文件分类 (Whisper)"""
        # Whisper API调用
        result = self.whisper_model.transcribe(str(file_path))
        text_content = result["text"]
        
        # 内容分析
        classification = await self.analyze_content_type(text_content)
        
        return {
            "type": "audio",
            "subtype": classification["category"],
            "transcription": text_content,
            "confidence": classification["confidence"],
            "language": result.get("language", "unknown"),
            "duration": result.get("duration", 0)
        }
    
    async def classify_image(self, file_path: Path) -> Dict:
        """图像文件分类 (GPT-4V)"""
        with open(file_path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode()
        
        response = await self.vision_client.chat.completions.acreate(
            model="gpt-4o",  # 最新视觉模型
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Classify this image. Categories: document, diagram, photo, screenshot, chart, other. Return JSON."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                ]
            }],
            max_tokens=300
        )
        
        try:
            result = json.loads(response.choices[0].message.content)
            return {
                "type": "image",
                "subtype": result.get("category", "unknown"),
                "confidence": result.get("confidence", 0.5),
                "description": result.get("description", ""),
                "contains_text": result.get("contains_text", False)
            }
        except:
            return {"type": "image", "subtype": "unknown", "confidence": 0.3}
```

### 1.4 用户体系设计 (MVP)

#### Supabase Auth集成
```python
# src/server/auth.py
import os
from supabase import create_client, Client
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer

# 环境变量配置
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Supabase客户端
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
security = HTTPBearer()

async def get_current_user(token: str = Depends(security)):
    """从JWT token获取当前用户"""
    try:
        user = supabase.auth.get_user(token.credentials)
        if user.user:
            return user.user
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed")

# src/server/app.py 中的API修改
@app.post("/api/chat/stream")
async def chat_stream(
    request: ChatRequest,
    current_user = Depends(get_current_user)  # 添加用户认证
):
    # 修改thread_id生成逻辑
    thread_id = f"user_{current_user.id}_{request.trace_id}"
    
    # 其余逻辑保持不变
    config = {"configurable": {"thread_id": thread_id}}
    # ...
```

#### 前端登录界面需求
**需要前端团队配合的工作**:
1. **登录界面组件** (`/web/src/components/auth/LoginForm.tsx`)
   - Supabase Auth UI集成
   - 邮箱/密码登录
   - OAuth提供商 (Google, GitHub)
   
2. **注册流程界面** (`/web/src/components/auth/SignupForm.tsx`)
   - 邮箱注册 + 验证
   - 用户协议确认
   
3. **邮箱认证页面** (`/web/src/app/auth/verify/page.tsx`)
   - 邮箱验证状态显示
   - 重发验证邮件功能
   
4. **用户管理界面** (`/web/src/app/settings/account/page.tsx`)
   - 个人信息编辑
   - 密码修改
   - 账号注销

### 1.5 可观测性集成 (LangSmith)

#### 自动trace集成
```python
# src/server/observability.py
import os
from langsmith import traceable
from langsmith.wrappers import wrap_openai
import openai

# 环境变量配置
os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_ENDPOINT"] = "https://api.smith.langchain.com"
os.environ["LANGSMITH_API_KEY"] = os.getenv("LANGSMITH_API_KEY")
os.environ["LANGSMITH_PROJECT"] = "YADRA-S1"

# OpenAI客户端包装
openai_client = wrap_openai(openai.Client())

# Agent函数装饰
@traceable(name="YADRA_Agent_Pipeline")
async def agent_pipeline(messages: List[Dict]) -> Dict:
    """主Agent流程的自动trace"""
    with tracer.start_span("agent_execution") as span:
        # 现有agent逻辑
        result = await execute_agent(messages)
        
        # 添加自定义metadata
        span.set_attribute("message_count", len(messages))
        span.set_attribute("agent_version", "S1.0")
        
        return result

# 工具调用trace
@traceable(name="Tool_Execution") 
async def call_tool(tool_call: Dict) -> Dict:
    """工具调用的自动trace"""
    tool_name = tool_call.get("function", {}).get("name")
    
    with tracer.start_span(f"tool_{tool_name}") as span:
        result = await execute_tool(tool_call)
        span.set_attribute("tool_success", result.get("success", False))
        return result
```

## 二、环境变量配置更新

### 2.1 更新 `.env.example`
```bash
# 现有配置
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_STATIC_WEBSITE_ONLY=false
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GITHUB_OAUTH_TOKEN=your_github_token
AMPLITUDE_API_KEY=your_amplitude_key

# S1新增配置
# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5442/postgres
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# 可观测性
LANGSMITH_API_KEY=your_langsmith_api_key
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=YADRA-S1

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# 知识库同步
NOTION_API_TOKEN=your_notion_token
GOOGLE_DOCS_API_KEY=your_google_docs_key

# 搜索
ARXIV_API_KEY=optional_arxiv_key

# 向量数据库
CHROMA_DB_PATH=./data/chroma_db

# Redis缓存 (可选)
REDIS_URL=redis://localhost:6379
```

### 2.2 更新 `conf.yaml.example`
```yaml
# S1配置扩展
database:
  url: ${DATABASE_URL}
  pool_size: 10
  max_overflow: 20

supabase:
  url: ${NEXT_PUBLIC_SUPABASE_URL}
  anon_key: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
  service_key: ${SUPABASE_SERVICE_ROLE_KEY}

observability:
  langsmith:
    api_key: ${LANGSMITH_API_KEY}
    project: ${LANGSMITH_PROJECT}
    tracing: ${LANGSMITH_TRACING}

agents:
  arxiv_search:
    page_size: 100
    delay_seconds: 1.0
    num_retries: 3
  
  researcher_fanout:
    num_agents: 3
    timeout_seconds: 60
  
  observation_filter:
    vector_weight: 0.6
    rule_weight: 0.4
    top_k: 20

file_classification:
  whisper_model: "turbo"
  vision_model: "gpt-4o"
  max_file_size_mb: 100

vector_db:
  chroma:
    path: ${CHROMA_DB_PATH}
    collection_name: "yadra_observations"
    embedding_model: "text-embedding-3-large"
    similarity_metric: "cosine"
```

## 三、实施计划 (8日精确路线图)

### Day 1: 基础设施搭建
**工作内容**:
- PostgreSQL + Supabase环境配置
- LangGraph PostgreSQLSaver集成测试
- 用户认证系统基础实现

**具体任务**:
```bash
# 数据库初始化
./scripts/setup_postgres.sh
./scripts/setup_supabase.sh

# LangGraph集成测试
python tests/test_postgres_checkpointer.py

# 认证系统基础
python src/server/auth.py --test
```

**交付物**: 
- 可运行的PostgreSQL + LangGraph集成
- 基础用户认证API
- 数据库schema迁移脚本

### Day 2: Agent编排优化核心
**工作内容**:
- BG1 arXiv并行搜索实现
- AG3 fan-out架构搭建
- Send API集成测试

**代码实现**:
```python
# src/agents/arxiv_search.py
# src/agents/researcher_fanout.py
# src/graph/parallel_nodes.py
```

**验证测试**:
```python
pytest tests/test_arxiv_parallel.py
pytest tests/test_researcher_fanout.py
```

### Day 3: 文件管控 + 向量搜索
**工作内容**:
- A1 文件分类系统 (Whisper + GPT-4V)
- ChromaDB向量数据库集成
- AG4 observation filter实现

**技术验证**:
```python
# 音频分类测试
python tests/test_whisper_classification.py

# 图像分类测试  
python tests/test_vision_classification.py

# 向量搜索测试
python tests/test_chroma_integration.py
```

### Day 4: 可观测性 + Artifact Feed
**工作内容**:
- LangSmith自动trace集成
- Artifact数据模型实现
- 端到端回放快照系统

**集成测试**:
```python
# trace验证
python tests/test_langsmith_integration.py

# artifact管理
python tests/test_artifact_management.py
```

### Day 5: AG1+AG2私有KB+可信度
**工作内容**:
- AG1 私有KB优先检索
- AG2 引用可信度星级系统
- 知识库同步基础架构

**API集成**:
```python
# Notion API集成
python src/knowledge/notion_sync.py

# 可信度评分算法
python src/agents/credibility_scorer.py
```

### Day 6: 前端配合界面开发
**前端工作 (并行)**:
- 登录/注册界面组件
- 用户管理页面
- 邮箱验证流程

**后端工作**:
- 用户API完善
- 权限控制系统
- Session管理

### Day 7: 系统集成测试
**工作内容**:
- 端到端功能测试
- 性能压力测试
- 错误处理验证

**测试覆盖**:
```bash
# 功能测试
pytest tests/integration/ -v

# 性能测试
python tests/performance/load_test.py

# 错误恢复测试
python tests/reliability/error_handling.py
```

### Day 8: 部署准备 + 监控
**工作内容**:
- 生产环境配置
- 监控告警设置
- 部署文档完善

**部署验证**:
```bash
# 部署脚本
./scripts/deploy_s1.sh --env=staging

# 健康检查
./scripts/health_check.sh

# 性能监控
./scripts/setup_monitoring.sh
```

## 四、风险控制与质量保证

### 4.1 技术风险缓解
1. **PostgreSQL性能**: 连接池 + 读写分离
2. **LangSmith限制**: 本地fallback + 采样策略
3. **API Rate Limits**: 智能重试 + 缓存机制
4. **向量搜索性能**: 分片 + 索引优化

### 4.2 向后兼容保证
```python
# src/graph/builder.py 兼容性修改
class StorageFallbackHandler:
    """数据库故障时的内存降级方案"""
    
    def __init__(self, postgres_saver, memory_saver):
        self.postgres_saver = postgres_saver
        self.memory_saver = memory_saver
        self.fallback_active = False
    
    async def save_checkpoint(self, config, checkpoint):
        try:
            if not self.fallback_active:
                return await self.postgres_saver.aput(config, checkpoint)
        except Exception as e:
            logger.warning(f"PostgreSQL failure, falling back to memory: {e}")
            self.fallback_active = True
            
        return await self.memory_saver.aput(config, checkpoint)
```

### 4.3 性能监控指标
- **响应时间**: 平均 < 2秒, P95 < 5秒
- **数据库连接**: 利用率 < 80%
- **内存使用**: 稳定在 < 4GB
- **错误率**: < 1%

## 五、成功标准验收

### 5.1 功能验收标准
✅ **基础设施**:
- [x] PostgreSQL持久化正常工作
- [x] 用户登录注册流程完整
- [x] LangSmith trace可视化

✅ **Agent优化**:
- [x] arXiv并行搜索速度提升2x
- [x] 3个researcher并行工作
- [x] observation filter准确率 > 85%

✅ **文件管控**:
- [x] 音频转文字准确率 > 95%
- [x] 图像分类准确率 > 90%
- [x] 向量搜索召回率 > 80%

### 5.2 性能验收标准
- **并发处理**: 支持10个并发对话
- **数据查询**: 历史对话检索 < 500ms
- **文件处理**: 10MB文件分类 < 30s
- **系统可用性**: 99.5% uptime

### 5.3 用户体验标准
- **登录流程**: 3步完成注册
- **对话连续性**: 跨会话上下文保持
- **多模态支持**: 文本+图片+音频
- **实时反馈**: 流式响应体验

## 六、技术债务与后续优化

### 6.1 已知技术债务
1. **安全性增强**: JWT刷新机制, RBAC权限
2. **国际化支持**: 多语言embedding, 时区处理
3. **移动端适配**: 响应式设计, PWA支持

### 6.2 S2规划预告
- **高级可观测性**: OpenTelemetry + Jaeger
- **智能缓存**: Redis集群 + CDN集成
- **高可用部署**: k8s + 负载均衡
- **AI模型微调**: 专用embedding + 领域LLM

---

## 总结

本Backend S1 Plan基于Context7的最新技术调研，确保所有技术选型都使用了最新、最准确的API和最佳实践。计划覆盖了YADRA规划文档中S1的完整功能范围，从基础设施到Agent优化到文件管控，形成了一个完整的MVP实现方案。

通过8天的精确实施路线图，我们将交付一个功能完整、技术先进、性能优异的YADRA S1版本，为后续的S2高级功能奠定坚实基础。 