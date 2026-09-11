# Baseball Agent 当前状态

更新时间：2026-09-11。此页是后续接手的首要上下文。范围为可访问讨论和资料，非当前 Agent 仓库审计。

## 目标

构建可解释、可验证的 MLB 数据分析 Agent：保留用户约束，跨 PostgreSQL、Parquet 与 Web 获取证据，通过程序计算指标，再生成带来源与限制的中文回答。

## 有证据的实现状态

- 历史脚本存在四工具注册与多轮调用循环：热库、冷库、联网赛季数据、姓名反查。未在本次执行这些代码。
- 用户曾报告已存入 2024–2026 Statcast 热数据，2015–2023 Parquet 历史数据，以及部分高阶指标。没有验证当前完整性与截止日。
- 2026-09 的项目讨论显示 Baseball Agent 已建立模块骨架与架构文档，但本博客仍未直接审计 Agent 仓库的当前业务实现。
- 博客仓库 `CityuHK-wyj/cityuhk-wyj.github.io` 已创建并获得写入授权；博客使用 Markdown 内容源、目录与机器可读状态，GitHub Pages 由仓库构建流程生成。

## 当前总体架构基线

当前架构不再被描述成一条包含所有模块的线性流水线，而分成三类：

### Main Agent Flow

```text
Conversation
→ Semantic Understanding
→ Analysis Objectives
→ Task Planner / Re-planner
→ Execution / Orchestrator
→ Tool Router + Tools
→ Artifact / Evidence Processing
→ Quality Approval
→ Feature Engine + Result Analyzer
→ Objective Sufficiency
→ Re-plan OR Response
```

### Shared Knowledge Services

- RAG Knowledge Base
- Metric Registry
- Schema Registry / Schema RAG
- Source Mapping
- Entity Dictionary

这些服务会被 Semantic、Planner、Judge、Analyzer、Formatter 等多个模块按需调用，不属于某一个固定步骤。

### Runtime & Governance

- AgentState
- Artifact Store
- Checkpoint Store
- Validation / Policy
- Logging / Observability
- Retry / Budget Control

这些能力贯穿整个 Agent 生命周期。尤其 `AgentState`、Validation 与 RAG 不应再被画成线性 pipeline 中的一站。

## 讨论中明确的方向

- 保留 `raw_query`，Intent 可多值，但 Intent 与 Tool 分离。
- Semantic Understanding Layer 负责把用户问题拆成一个或多个 `AnalysisObjective`；Planner 不重新解释用户意图，而是围绕 Objective 设计 Requirement 和 Task。
- Objective 使用受控主类 + 开放 subtype/description，以稳定边界而不过度限制 Agent 自主性；objective type 可提供 base priority，Planner 再调整 effective priority。
- Entity Resolver 在 Planner 前进行规范化，内部关联依赖 canonical ID，不依赖姓名唯一性。
- Constraint 作为跨 Query Understanding、Planner、ArtifactRequirement、SQL/API generation 的统一查询约束语言；Semantic Layer 可以补充隐含约束，但需标记其来自系统推断而非用户明确要求。
- Planner 尽量停留在 semantic level；确定性的 physical schema / metric mapping 交给 Registry，RAG 处理语义和动态知识。
- `AgentTask` 描述计划，`TaskExecution` 描述总体执行状态，`TaskAttempt` 保存每一次具体尝试；原始计划不因运行状态反复改写。
- timeout 等技术性失败由 Executor 按原参数 retry；`NO_DATA`、样本不足、数据源不覆盖等语义性问题交给 Result Analyzer，再由 Planner re-plan。
- Task 的数据依赖优先表达为结构化 `ArtifactRequirement`；`depends_on` 主要保留纯 workflow dependency。
- `0 rows` 不等于 Tool failure；`retryable` 属于工具层，`recoverable` 属于 Agent 全局层。
- ToolResult 记录工具级来源，具体数据 / Evidence 自己记录细粒度 provenance。
- Web Tool 可以返回宽松的 RawWebResult；Evidence Extractor 负责非结构化到结构化 Evidence，Router 只决定去哪里找。
- collected data 不自动进入主分析上下文；Candidate Artifact 先经过 deterministic validation、hard gates 与 Judge/Critic Agent，再成为 APPROVED / LIMITED / REJECTED。
- Judge Agent 只做数据与证据语义质量评审，不接管 Planner；倾向使用 STRONG / ACCEPTABLE / WEAK / REJECT 离散等级并附原因。
- `AgentState` 与 `LLM Context View` 分离，避免把失败尝试、低质量结果和已失效信息全部塞进模型上下文。
- confidence 更接近 analysis sufficiency，而非“模型正确概率”；sufficiency 按 Objective 计算，而非只给整个 Query 一个总分。
- 已完成 Objective 可以冻结并复用；仍有 recoverable gap 的 Objective 继续规划；客观不可恢复时允许 `LIMITED` 退出并解释原因。
- 整个 Query 只需要粗粒度 `COMPLETE / PARTIAL / FAILED`，因此部分 Objective 已可靠完成时可以输出 PARTIAL report。
- Metric 层保持简单：`MetricDefinition` 定义指标，`SourceMapping` 描述具体来源映射；状态优先使用 `DIRECT`、`CALCULATED` 与无映射。组合多个来源满足用户问题的工作由 Planner 完成。
- Validation / Policy 是横切能力，覆盖 input、semantic output、plan、SQL/tool call、ToolResult、Artifact 和 final claim/evidence consistency。

不要求手工维护过细的 artifact_id 分类。博客中的 JSON / Pydantic 片段均是设计示例，不代表已批准应用接口。

## 尚未定稿

`AnalysisObjective` / `ObjectivePlan` / `ArtifactRequirement` / `DataArtifact` 正式 schema；quality requirements 的表达；Judge/Critic Agent 输入输出契约；Artifact 与 Objective 两级 sufficiency 的具体计算与权重；Planner 如何消费 `MetricDefinition` 与 `SourceMapping`；checkpoint 的具体持久化实现；执行预算和最大 retry / replan / total step；Evidence validation；LangGraph 是否以及何时引入。

## 建议的下一步

以当前三分法架构作为总体基线，进入正式 Domain Modeling。优先明确 `AnalysisObjective → ObjectivePlan → ArtifactRequirement → AgentTask → TaskExecution → DataArtifact → ArtifactAssessment → ObjectiveState` 的所有权、状态迁移和数据契约，再生成 spec/tickets。不要继续把共享服务和横切能力当成额外 pipeline 节点。

## 本博客的状态

截至 2026-09-11 仍登记 9 篇阶段性文章，没有新增文章。本轮直接修订既有总览、Task Planner、Validation/Feedback 和第 9 篇架构文章，并同步本文、`decisions.md`、`project-state.json`、`sources.md` 与目录元数据。
