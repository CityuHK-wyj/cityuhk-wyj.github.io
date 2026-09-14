# Baseball Agent 当前状态

更新时间：2026-09-14。此页是后续接手的首要上下文。范围为可访问讨论和资料，非当前 Agent 仓库审计。

## 目标

构建可解释、可验证的 MLB 数据分析 Agent：保留用户约束，跨 PostgreSQL、Parquet 与 Web 获取证据，通过程序计算指标，再生成带来源与限制的中文回答。

## 有证据的实现状态

- 历史脚本存在四工具注册与多轮调用循环：热库、冷库、联网赛季数据、姓名反查。未在本次执行这些代码。
- 用户曾报告已存入 2024–2026 Statcast 热数据，2015–2023 Parquet 历史数据，以及部分高阶指标。没有验证当前完整性与截止日。
- 2026-09 的项目讨论显示 Baseball Agent 已建立模块骨架与架构文档，但本博客仍未直接审计 Agent 仓库的当前业务实现。
- 博客仓库 `CityuHK-wyj/cityuhk-wyj.github.io` 已创建并获得写入授权；博客使用 Markdown 内容源、目录与机器可读状态，GitHub Pages 由仓库构建流程生成。

## 当前架构状态

截至 2026-09-14，宏观架构进入 **Architecture Freeze**：后续不再继续增加大层或独立 Agent，除非 Domain Modeling 发现结构性矛盾。接下来进入 Domain Modeling → ADR → Spec → Tickets → TDD / Implementation → Code Review。

主架构按六个职责层组织：

```text
Interaction
→ Normalization
→ Planning & Orchestration
→ Data & Tool
→ Evaluation & Sufficiency
→ Response
```

Shared Knowledge & Context、Runtime State、Governance 作为 cross-cutting 能力贯穿主流程。

## 核心 Definition / State 模型

State 不再被视为执行链末端产物，而是从对应 Definition 创建时就伴随存在的 Runtime Projection：

```text
AnalysisObjective ─────────────── ObjectiveState
        │                              ▲
        ▼                              │ aggregate
ArtifactRequirement ─────────── RequirementState
        │                              ▲
        ▼                              │ evaluate
AgentTask → TaskExecution → Artifact → ArtifactAssessment
```

Definition 描述“它是什么”，State 描述“它现在怎么样”。`Requirement State Service` 与 `Objective State Service` 负责更新状态，不单独设成 Sub-agent。

## Requirement 与 Planner

- Requirement Decomposer 在 Planner 前把 Objective 拆成 semantic-atomic Initial Requirements。
- Initial Requirement 是原始用户问题的不可修改业务基线；Planner 不能删除、改写或降低其 `base_criticality`。
- Planner 可以根据执行需要新增 `PLANNER_ADDED` supporting Requirement，但新增 Requirement 不能反过来偷偷提高原问题的 Completion 门槛。
- Requirement 与 Artifact 共享统一 ArtifactDescriptor、ArtifactType、canonical Entity、typed Constraint 和 semantic data key。
- `RequirementState` 主要反馈给 Planner。Planner 除状态外还应能看到相关 Artifact index、关键内容与 ArtifactAssessment summary，必要时再通过 Shared Context Service 展开 Artifact。
- Planner 自己根据 RequirementState、Artifact、recoverability、round、budget 与 source availability 产生 `PLAN / REPLAN / STOP_PLANNING`。
- `planner_terminal = true` 表示在当前条件下再次调用 Planner 不会产生有效新计划。除非用户约束、权限、数据源或 Artifact 发生新的外部变化，Orchestrator 应尊重 terminal state，防止死循环。

## Router 与 Orchestrator

- Router 是独立但窄职责的 Routing Agent，负责为具体 Task 选择 source/tool；Planner 只给 semantic task 和 source preference。
- Router 可以因 freshness / availability 推翻 Planner preference，但不能绕过 user constraint 或 Governance policy。
- Orchestrator 是管理者，不做 Requirement decomposition、source 专业判断或证据语义评估。它负责调度、并行/等待/阻塞、权限、预算、跨 State transition、用户 escalation、接收 planner terminal 与 Finalization。
- Sub-agent 采用 `Local ownership + reviewed global transition`：本地状态可由所属 Agent 更新，跨 Domain 影响由 Orchestrator 审阅。

## Artifact 与 ArtifactAssessment

Artifact 本体尽量 immutable，保存 descriptor、payload、provenance、lineage 与时间信息。Feature Engine 的确定性计算结果也成为 Artifact，并通过 lineage 指向输入。

Artifact quality 是 contextual `ArtifactAssessment`，绑定 `artifact_ref + requirement_ref + objective_ref`。Assessment 作为索引记录保存 deterministic result、Judge result、final assessment、summary、usable_for 与 limitations，不重复存 payload。

质量判断采用：

```text
Deterministic Validator
├── Hard Validation
└── Soft Validation Signals
        ↓
Judge Agent
        ↓
Assessment Resolver
        ↓
ArtifactAssessment
```

Hard failure（错误实体、Artifact 损坏、必需字段完全缺失、明确时间范围完全错位、policy/integrity failure 等）不能被 Judge 覆盖。时间覆盖、freshness、样本规模、qualification 等作为 soft signals；Judge 可以根据当前 Requirement 相当程度调整最终 Assessment。

Judge 必须输出简短 assessment summary，供 Planner 消费。

## RequirementState、ObjectiveState 与 Finalization

- `RequirementState` 汇总 Requirement 当前满足情况和相关 refs，主要给 Planner 用于下一轮 PlanningDecision。
- `ObjectiveState` 根据 RequirementStates 更新，主要给 Orchestrator 用于整体协调和 Finalization。
- ObjectiveState 倾向 `PENDING / IN_PROGRESS / COMPLETE / LIMITED / FAILED`。
- COMPLETE 表示核心 Initial Requirements 足以回答，可以保留 optional gaps / limitations。
- LIMITED 表示核心 Requirement 没有全部满足，但 Planner 已 terminal，现有结果仍足够形成受限回答。
- FAILED 表示无法形成可靠的受限回答。

## Response / CompletionReport

Response Agent 只看到已经最终采用的结果，不看到上游 Sub-agent 的尝试过程。

Orchestrator 在 Finalization 形成内部 `CompletionReport`，再投影成 `ResponsePackage`。用户回答相关内容包括：final accepted Artifacts、final accepted Evidence、真正影响结论的 critical Shared Knowledge、limitations、optional gaps、unresolved items 与 provenance。

TaskAttempt、失败 routing、旧 plan、rejected evidence、Judge 内部工作过程等只保留在 System State / Trace。失败过程若影响结论，应先被提炼为 user-relevant limitation，而不是原样暴露给 Response Agent。

## Shared Knowledge & Context

Retrieval 不再作为独立业务 Sub-agent。它属于 Shared Knowledge & Context 的内部资料管理能力：Retrieve / Filter / Rank / Freshness Check / Project / Deliver。

结构化 metadata 足够明确时可以代码 hard filter；非结构化历史、RAG、Web Evidence 等可以组合 semantic retrieval、full-text、reference traversal。Context Service 只负责递材料，不替 Planner、Router 或 Judge 做领域决策。

长期原则：

```text
System State ≠ LLM Context
Persist broadly, retrieve narrowly
```

跨 Run 新 Query 优先从 CompletionReport、final Artifacts、user-confirmed decisions 和 relevant Shared Knowledge 恢复上下文，不重新加载全部 attempt history。

## Persistence / Checkpoint

Checkpoint 是某个一致时刻各 State Domain 的版本引用集合，不是把整个 AgentState 和大型 Artifact 重新序列化一份。

推荐 Snapshot + Event History：Artifact / Domain Result 独立持久化；Event / Trace 保存历史；Checkpoint 保存可恢复坐标。`WAITING_FOR_USER`、Plan accepted、任务批次完成、Assessment 完成、Plan revision、Objective terminal 等 meaningful transition 适合创建 checkpoint。

Agent 自己的长期 Runtime 数据使用独立 Operational PostgreSQL（Control Plane），并可用 pgvector 支持历史/上下文索引；大型 Artifact payload 使用 Local/Object Storage。现有 `baseball_analytics` PostgreSQL 与 Parquet/DuckDB 保持 Data Plane，只读隔离。Redis 暂不作为第一版必需组件。

## 权限与领域规则

- Qualification 与 Sample Adequacy 分离；官方 League progress 与 local ingestion coverage 分离。
- Semantic Clarification 必须询问用户；问题明确后，免费且允许的 source fallback 可自主执行；付费/高成本 source 才升级询问用户。
- PostgreSQL、DuckDB / Parquet 在当前 Runtime 中为只读分析资源；数据库/文件修改属于 System Administrator 权限，用户不能通过对话授权越界。

## 尚未定稿

宏观架构已冻结，但正式 Domain Contract 尚未冻结。下一阶段需要定稿：`AnalysisObjective / ObjectiveState`、`ArtifactRequirement / RequirementState`、`AgentTask / TaskExecution`、Artifact / ArtifactAssessment、AgentReport、PlanningDecision、Checkpoint、ContextPackage；Requirement Matcher；StateTransition contract；Planner terminal reason；Objective / Requirement 状态算法；Persistence 表结构与版本机制；Context projection policy；具体 Prompt、LangGraph 与 API 实现。

## 本博客的状态

截至 2026-09-14 仍登记 9 篇阶段性文章。本轮没有新增文章，只修订现有第 4、5、9 篇以及本文、`decisions.md`、`project-state.json`、`sources.md` 与目录元数据。
