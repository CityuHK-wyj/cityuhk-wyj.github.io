# Baseball Agent 当前状态

更新时间：2026-09-15。此页是后续接手的首要上下文。与上一版不同，本轮已直接审计 `CityuHK-wyj/baseball_agent` 的 GitHub 分支、提交、关键代码、测试与 handoff 文档，因此“实现状态”不再只来自讨论摘要。

## 目标

构建可解释、可验证的 MLB 数据分析 Agent：保留用户原问题和确认约束，跨 PostgreSQL、Parquet/DuckDB、Web 与长期 Shared Knowledge 获取证据，通过确定性计算与质量评估形成 Artifact / Evidence，再生成带来源、限制和 provenance 的中文回答。

## 当前阶段

宏观架构已经完成 Architecture Freeze，并且核心架构已经实际落地。项目当前阶段不再是“Domain Modeling 前准备”，而是：

```text
Architecture Freeze
→ Domain Modeling / ADR / Implementation
→ Runtime Audit & Hardening
→ Shared Knowledge V1
→ v0.1 Integration
→ Real Data Verification
→ Final Review / Release
```

当前最新产品整合分支为：

```text
astra/v0.1-integration
```

它已经通过真实 Git merge 合并：

```text
gpt56/runtime-audit-hardening
        +
agent/shared-knowledge
```

因此目前应把 Astra 分支视为 v0.1 integration candidate，而不是分别把各工作分支当成独立产品。

## 多 Agent 实现轨迹

- `codex/architecture-implementation`：建立安全 Domain foundation，隔离旧 credential-bearing ancestry，并冻结一批关键 invariant。
- `agent/deepseek-implementation-safe`：把冻结架构实现成完整 deterministic Agent Runtime，包括 Planning、Routing、Artifact、Assessment、State、Persistence、Resume、Context、LLM seams、CLI 与测试。
- `gpt56/runtime-audit-hardening`：把实现与测试都视为不可信对象做独立攻击，修复 evidence leakage、DuckDB filesystem bypass、SourceMapping wiring、LLM output validation、Web Evidence、Clarification / Permission lifecycle 等问题。
- `agent/shared-knowledge`：建立 MLB Shared Knowledge V1，包括规则、术语、球队、球员、社区来源、知识持久化、provenance、freshness、versioning 与 ContextSource。
- `astra/v0.1-integration`：真实 merge runtime hardening 与 Shared Knowledge，并继续补 ConstraintRevision、permission expiry、default composition、knowledge runtime projection、bounded context、persistent metrics 与部分 live probe。

## 当前主流程

主流程仍保持六层：

```text
Interaction
→ Normalization
→ Planning & Orchestration
→ Data & Tool
→ Evaluation & Sufficiency
→ Response
```

但这些现在已有真实实现，而不只是架构图。

典型 Runtime flow：

```text
User Query
→ Semantic Normalization
→ AnalysisObjective
→ Requirement Decomposer
→ ArtifactRequirement
→ Planner
→ SourceMapping / Router
→ Tool Execution
→ Artifact / Evidence
→ Deterministic Validation
→ Judge
→ ArtifactAssessment
→ RequirementState
→ ObjectiveState
→ Planner REPLAN / STOP
→ CompletionReport
→ ResponsePackage
→ Response
```

## Definition / State / Produced Knowledge

核心模型保持：

```text
Definition
- AnalysisObjective
- ArtifactRequirement
- AgentTask

Produced Knowledge
- Artifact
- ArtifactAssessment

Runtime State
- ObjectiveState
- RequirementState
- TaskExecution / Attempt
```

`ObjectiveState` 与 `RequirementState` 从对应 Definition 创建时就存在；State Service 负责持续更新，不新增同职责 Evaluator Agent。

Initial Requirement 仍是不可修改业务基线；Planner 可新增 `PLANNER_ADDED` supporting Requirement，但不能删除、改写或降低原始 Requirement 的语义重要性，也不能借新增 Requirement 偷偷提高原 Objective 的完成门槛。

## Planner / Router / Orchestrator

职责边界已经落地：

- Planner 决定 `PLAN / REPLAN / STOP_PLANNING`，依据 RequirementState、ArtifactAssessment summary、recoverability、round、budget 与 source availability。
- Router 决定具体 tool/source；SourceMapping 已进入真实 Runtime，并且 mapped tool 约束高于 Planner preference。
- Orchestrator 负责调度、等待、权限、预算、checkpoint、cross-domain transition 与 Finalization，不重新做 Planner / Router / Judge 的专业判断。
- `planner_terminal` 在无外部变化时防止重复规划；新的 clarification、permission、constraint revision、source 或 Artifact 可以按显式理由重新打开。

## Clarification / Permission / Constraint Revision

交互升级已经变成持久化生命周期，而不是 UI 占位符。

### Clarification

```text
ambiguous query
→ ClarificationRequest
→ InteractionRecord
→ WAITING_FOR_USER checkpoint
→ answer
→ USER_CONFIRMED constraint
→ same-run resume
```

重复 confirmation fail closed，并避免重复 execution。

### Permission

```text
paid / high-cost source
→ PermissionRequest
→ WAITING_FOR_USER
→ approve / reject
→ same-run resume
```

Permission 是 scoped、single-use / auditable，并有 expiry / stale validation。用户批准不能覆盖 `SYSTEM_POLICY`。

### Constraint Revision

```text
USER_CONSTRAINT blocks useful legal source
→ ConstraintRevisionRequest
→ WAITING_FOR_USER
→ accept / reject
→ same-run resume
```

接受后形成 `USER_CONFIRMED` revision；拒绝则保留原约束。System Policy 不可重新协商。

## Artifact / Validation / Judge

Artifact 尽量 immutable，保存 descriptor、payload/ref、provenance、lineage 与时间信息。Feature Engine 输出也统一成为 Artifact。

`ArtifactAssessment` 绑定 `artifact_ref + requirement_ref + objective_ref`，同一 Artifact 对不同 Requirement 可以得到不同 Assessment。

质量链路：

```text
Artifact
→ Deterministic Validator
   ├── Hard Validation
   └── Soft Signals
→ Judge
→ ArtifactAssessment
```

Hard failure 不能被 Judge 覆盖；soft signals 可由 Judge 根据当前 Requirement 解释。

GPT-5.6 的独立 audit 曾发现并修复跨 Objective accepted-evidence leakage，说明 Response / Context boundary 已经经历过实际 adversarial hardening，而不是只存在设计原则。

## SQL / DuckDB 安全

PostgreSQL、DuckDB / Parquet 继续是只读 Data Plane。用户不能通过聊天授权写操作。

当前 guard 已专门攻击并阻断多类绕过，包括 CTE hidden mutation、multi-statement、DuckDB ATTACH / COPY / extension loading、URI、动态文件路径与 path traversal。执行拒绝发生在危险操作进入底层执行前。

## Persistence / Checkpoint / Resume

Agent Runtime 使用独立 Control Plane，不把运行状态写进 `baseball_analytics`。

当前实现包含：

- OperationalStore Protocol；
- SQLite dev/test implementation；
- PostgreSQL implementation（live production path仍待真实验证）；
- ArtifactStorage；
- payload-before-state 持久化顺序；
- Checkpoint；
- Resume / rehydrate；
- Artifact reuse 与 duplicate-execution prevention；
- persisted interaction lifecycle；
- persisted RunMetrics events。

Checkpoint 是恢复坐标，不是 giant AgentState dump。

## Shared Knowledge V1

Shared Knowledge 已从架构概念变成真实长期知识层。

物理来源与运行形态：

```text
knowledge/sources/*.json
knowledge/seed/*.json
        ↓
ingestion / validation / staging
        ↓
Knowledge Store
        ↓
KnowledgeContextSource
        ↓
ContextService
```

开发/测试默认：

```text
.runtime/knowledge.db
```

生产方向：独立 PostgreSQL `knowledge` schema，与 `baseball_analytics` Data Plane 和 runtime object tables 隔离。

当前 V1 覆盖：

- 2026 Official Baseball Rules 的主要规则结构与编号规则；
- roster / transaction / CBA-sensitive 基础规则；
- 标准统计、sabermetrics、Statcast、pitch、plate discipline、qualification、scouting terminology；
- 当前 30 支 MLB 球队、30 个主场、league/division、双语 aliases 与 franchise lineage；
- notable active / historical player identity；
- awards、league/postseason context 与重要历史 era；
- trusted source registry 与 community creator/source directory。

每个 KnowledgeItem 可以携带 authority、effective dates、as_of、last_verified、verification status 与 version。

原则：

```text
Collected Knowledge != Active Knowledge
Persist broadly, retrieve narrowly
```

## Shared Knowledge 与 RAG

RAG / pgvector 仍有意 deferred。

当前优先：canonical lookup、alias lookup、structured filter、full-text / reference traversal。对于球队、规则编号、metric definition 等确定性结构化知识，这比统一向量化更准确。

只有真实使用证明自然语言语义召回不足时，再增加 embedding / semantic retrieval。Embedding 只能是可重建索引，不是知识 truth source。

## Default Composition Root

Astra 已增加真实默认 composition，使系统不再只是“有很多模块但没人负责拼起来”。默认 Runtime 会组装：

```text
Knowledge Store
Entity Dictionary
Metric Registry
Schema Registry
SourceMappingResolver
ContextService
Operational Store
Artifact Storage
Router / Tools
Assessment / Judge
Planner
AnalysisPipeline
```

Shared Knowledge 已能投影为 EntityDictionary 与 MetricRegistry，并通过 ContextService 向 Planner / Judge / Response 提供 bounded context。

## Synthetic Data 的新边界

SyntheticDataTool 仍用于测试完整 Agent loop，但不再默认伪装成真实 analytics source。

只有显式 `--demo` 才允许 SyntheticDataTool：

```bash
python -m app.cli ask "Judge最近30天表现怎么样？" --demo
```

正常模式没有真实数据时应暴露缺口，而不是用 fake data 生成看似真实的 MLB 结论。

## 已验证的用户体验切片

当前 integration tests 已覆盖类似：

```text
“DFA是什么意思？”
→ Shared Knowledge
→ COMPLETE
→ accepted evidence 来自 shared-knowledge
```

```text
“道奇属于哪个分区？”
→ 中文 alias
→ canonical LAD
→ National League West
```

以及：

- Hernandez 多候选 → Clarification → same-run resume；
- paid tool → PermissionRequest → scoped approval；
- blocked user source constraint → ConstraintRevisionRequest；
- accepted evidence / context 跨 run、跨 objective 隔离；
- persisted checkpoint / resume 不重复执行。

## Live Integration 状态

必须区分“测试闭环”和“真实来源已验证”。

截至 2026-09-15：

- test suite 已增长到 300+ 级别，开发分支持续在稳定 checkpoint 上保持全绿；
- 真实 Parquet 已成功做 bounded read probe；复杂 high-zone 查询暴露历史 schema 缺少 `sz_bot / sz_top` 一类字段，需要继续适配；
- MLB Stats API 曾成功返回 30 队 reference 数据，但后续网络存在 timeout，因此完整 WebEvidenceTool live E2E 仍是 partial；
- 最近一次本地 `baseball_analytics` PostgreSQL probe 连接不可用，真实 read-only PostgreSQL E2E 仍待完成；
- Operational PostgreSQL 代码路径已实现，但 production live path 未完整验证。

因此当前更准确的标签是：

> **architecture-complete / heavily-tested v0.1 integration candidate**

不是 production-ready。

## Git / Release 状态

当前安全开发线与旧 `main` 因 credential 清理历史而不是普通线性 ancestry。GitHub compare 显示 `main` 与 `astra/v0.1-integration` 不能按普通“ahead N commits”理解。

因此最终进入 `main` 需要单独做 release integration。当前倾向：完成 final review 后，用明确的 reviewed v0.1 snapshot / release commit 把稳定 tree 发布到 main，同时保留安全开发分支的完整研发历史，而不是草率把 unrelated histories 强行混合。

## 下一阶段

当前不再需要横向增加大型模块。优先级是：

1. 真实 `baseball_analytics` PostgreSQL read-only E2E；
2. 2015–2023 Parquet schema 与 SchemaRegistry / Feature Engine 对齐；
3. 跑通复杂真实问题，例如“两好球后 >95 mph 高区快速球 EV Top 5 + salary value”；
4. 完整 WebEvidenceTool live provider E2E；
5. 清理 README / handoff / development-status 中历史残留；
6. final architecture / security / integration review；
7. 安全发布到 `main` 并标记 v0.1。

## 本博客状态

截至 2026-09-15，博客从 9 篇增加到 10 篇。新增第 10 篇记录 Architecture Freeze 之后的真实工程落地、多 Agent 分工、runtime audit、Shared Knowledge V1 与 Astra integration；同时本文、`decisions.md`、`project-state.json`、`sources.md` 与目录元数据同步更新。
