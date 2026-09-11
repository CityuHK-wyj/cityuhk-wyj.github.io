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

当前架构按大职责组织为六个主层，并由 Shared Knowledge、Runtime State 和 Governance 贯穿：

```text
Interaction
→ Normalization
→ Planning & Orchestration
→ Data & Tool
→ Evaluation & Sufficiency
→ Response
```

### Normalization

Semantic Understanding、Entity / Constraint / Objective normalization、Evidence / Artifact normalization、Metric / Feature transformation 都属于更大的标准化职责。Architecture Layer 不等于 Python package；不同代码模块可以独立实现，但在总体信息流上共享“把不稳定或异构输入转成 canonical representation”的目标。

### Shared Knowledge Services

- RAG Knowledge Base
- Metric Registry
- Schema Registry / Schema RAG
- Source Mapping
- Entity Dictionary
- League / Reference Context

这些服务由 Semantic、Requirement Decomposer、Planner、Router、Judge、Analyzer、Formatter 等按需调用，不属于某一个固定步骤。

### Runtime State & Governance

运行时状态倾向拆为多个 State Domain，而不是单个超级 AgentState：Query、Objective、Requirement/Planning、Routing、Execution、Artifact、Interaction、Permission、Budget 等。Validation / Policy、Logging / Observability、Retry / Budget、Read-only DB policy、Permission / Escalation policy 属于 cross-cutting governance。

## 讨论中明确的方向

- 保留 `raw_query`，Intent 可多值，但 Intent 与 Tool 分离。
- Semantic Layer 负责拆 `AnalysisObjective`；用户自己也不明确需求时，应生成少量 clarification options 让用户确认，而不是擅自固定问题含义。
- Objective 使用受控主类 + 开放 subtype/description；Objective type 可提供 base priority，后续只调整 execution priority，不偷偷改变业务语义。
- Definition 与 State 分离，例如 `AnalysisObjective ↔ ObjectiveState`、`AgentTask ↔ TaskExecution`。
- Requirement Decomposer 作为 Planner 前的窄职责 Sub-agent，利用 Shared Knowledge Services 把 Objective 拆成 semantic-atomic `ArtifactRequirement`；它不选 Tool，也不能因当前 source 不方便而删除用户明确需求。
- Requirement 的 `base_criticality` 表示它对原 Objective 的语义重要性，原则上近似 immutable；后续 round / budget 可以影响调度，但不能为了更容易 COMPLETE 而降级关键 Requirement。
- `ArtifactRequirement` 与实际 Artifact 共享统一 `ArtifactDescriptor` / `ArtifactType`、canonical Entity、typed Constraint、semantic data key 等语言，避免 Requirement 与 Artifact 各自发明命名。
- Artifact 本体尽量 immutable，保存 descriptor、payload、provenance、lineage；Feature Engine 计算结果也产生新的 Metric/Feature Artifact，并通过 `derived_from` 保留 data lineage。
- Qualification 与 Sample Adequacy 分离：qualification 决定能否进入候选池，sample adequacy 决定样本能否支撑分析结论。`minimum_sample_size` 不再作为 Planner 随意填写的独立字段。
- 赛季进行中的 qualification 需要 League/Reference Context；官方 season progress 与 local ingestion coverage 分开记录，避免把数据库最新日期误当联盟真实进度。
- Planner 负责 logical execution strategy，并可提供 source preference；Router 是与 Planner 并列但权限更窄的 Routing Agent，结合 SourceMapping、freshness、cost、failures 和 available tools 选择实际 source/tool。
- Router 可因 freshness / availability 违背 Planner preference，但不能绕过用户 source constraint 或 Governance hard policy。
- Orchestrator 是管理者而非领域专家：调度、并行、阻塞、权限、预算、跨 State transition、replan timing 和用户 escalation 由它协调；Sub-agent 的专业工作由各自完成。
- Re-planning 不需要第二个 Planner；同一 Planning Agent 支持 INITIAL_PLAN / REVISE_PLAN。Orchestrator 决定 when，Planner 决定 what，Router 决定 where/how。
- Sub-agent 可以更新自己的 Local State，并提交 Report / Decision；跨 Domain / 全局 State transition 需由 Orchestrator 审阅。核心原则为 `Local ownership + reviewed global transition`。
- `0 rows` 不等于 Tool failure；`retryable` 属于工具层，`recoverable` 属于 Agent 全局层。
- Web Tool 可返回 RawWebResult；Evidence Extractor 负责转为 structured Evidence / Artifact，Router 只决定去哪找。
- Artifact quality 不是 Artifact 固有分数，而是绑定 `artifact_id + requirement_id + objective_id` 的 contextual `ArtifactAssessment`。
- 质量链路为 deterministic validation / hard gate → Judge/Critic Agent → ArtifactAssessment；Artifact Registry 管理索引、lineage、lifecycle、assessment ref，但不是质量裁判。
- Judge 使用离散语义等级，不接管 Planner，也不能直接把 Objective 标成 COMPLETE。
- Objective Sufficiency 先做 Critical Requirement hard gate，再做 weighted requirement coverage；不能用大量低重要性证据平均掉核心缺口。
- ObjectiveState 倾向 `PENDING / IN_PROGRESS / COMPLETE / LIMITED / FAILED`；COMPLETE 可以保留 optional_gaps / limitations，并由 Formatter 反馈用户。
- Selective re-plan 综合 gap criticality、recoverability、round count、attempt history、remaining budget 和 expected benefit；已完成部分冻结复用。
- Semantic Clarification 必须询问用户；问题已明确后，免费且允许的数据源 fallback 可由 Agent 自主进行；付费 / 高成本 source 才需要用户授权。
- PostgreSQL、DuckDB / Parquet 在当前 Runtime 中是只读分析资源；数据库/文件修改属于 System Administrator 权限，用户不能在对话中授权 Agent 越过这一边界。
- `System State != LLM Context`；完整状态用于恢复/审计，LLM 只接收当前决策需要的投影。

博客中的 JSON / Pydantic 片段均是设计示例，不代表已批准应用接口或已实现代码。

## 尚未定稿

统一 `ArtifactDescriptor`、`ArtifactRequirement`、Artifact / payload subtype、ArtifactAssessment 正式 schema；Requirement Matcher；QualificationRule / SampleAdequacyRule / LeagueStateSnapshot 的正式契约；PlannerReport / RoutingReport / JudgeReport 等 Sub-agent Report envelope；State Domain 与 transition contract；Objective hard gate / weighted coverage 的具体算法；Orchestrator review policy；checkpoint persistence；预算与成本策略；LangGraph 是否以及何时引入。

## 建议的下一步

继续 Domain Modeling，不再增加新的大层。优先把共享 Artifact contract、多个 State Domain、Sub-agent Report / Decision Contract 和 Orchestrator transition policy 定清，再进入 spec/tickets。实现时保持“窄职责 Sub-agent + deterministic governance + shared canonical models”的方向。

## 本博客的状态

截至 2026-09-11 仍登记 9 篇阶段性文章，没有新增文章。本轮继续修订 Task Planner、Validation/Feedback 与第 9 篇总体架构文章，并同步本文、`decisions.md`、`project-state.json`、`sources.md` 与目录元数据。
