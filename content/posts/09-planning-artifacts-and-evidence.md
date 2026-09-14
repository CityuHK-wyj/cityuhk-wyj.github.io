# Task Planner 与证据质量：从数据依赖到分层 Agent 架构

最近几轮讨论把总体架构进一步收敛到可以 Architecture Freeze 的程度。重点不再是增加新模块，而是明确 Definition / Runtime State、Requirement / Artifact、Planner / Router / Orchestrator、Assessment / Sufficiency、Persistence / Context 和最终 Response 之间的边界。

**记录性质：** 以下是截至 2026-09-14 当前讨论确认的设计方向，尚不代表 Agent 仓库已经实现这些接口。

## 1. 六个主层 + 三组贯穿能力

主架构仍保持六层：

```text
User
 ↓
① Interaction Layer
   Conversation / Clarification
 ↓
② Normalization Layer
   Semantic / Entity / Constraint / Objective
   Evidence / Artifact / Metric transformation
 ↓
③ Planning & Orchestration Layer
   Requirement Decomposer
   Planning Agent
   Routing Agent
   Orchestrator / Executor
 ↓
④ Data & Tool Layer
   PostgreSQL / DuckDB / API / Web
 ↓
⑤ Evaluation & Sufficiency Layer
   Deterministic Validation / Judge
   ArtifactAssessment / State Services
 ↓
⑥ Response Layer
   Finalization / Response Agent
```

贯穿能力分为：

- Shared Knowledge & Context：RAG、Metric Registry、Schema Registry、Source Mapping、Entity Dictionary、League/Reference Context、Context Management；
- Runtime State：Query、Objective、Requirement、Planning、Routing、Execution、Artifact、Interaction、Permission、Budget、Checkpoint；
- Governance：Validation/Policy、Logging/Observability、Retry/Budget、Read-only execution、Permission/Escalation。

Architecture Layer 不等于 Python Package。代码模块可以独立，但总体职责应保持这些边界。

## 2. Definition、Produced Knowledge 与 Runtime State 分开

核心模型不应该被画成一条“Objective → Requirement → Task → Artifact → State”的直线，因为 State 从 Definition 创建时就伴随存在。

```text
AnalysisObjective ─────────────── ObjectiveState
        │                              ▲
        ▼                              │ aggregate
ArtifactRequirement ─────────── RequirementState
        │                              ▲
        ▼                              │ evaluate
AgentTask → TaskExecution → Artifact → ArtifactAssessment
```

可以把领域对象分成三组：

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
- TaskExecution
```

Definition 回答“它是什么”，State 回答“它现在怎么样”。

## 3. Requirement Decomposer 产生不可修改的 Initial Requirements

Requirement Decomposer 仍是 Planner 前的窄职责 Sub-agent：它根据 Objective 和 Shared Knowledge 决定为了回答原问题，需要哪些 semantic-atomic Requirement。

这些 Initial Requirements 是原始业务基线：Planner 不能删除、改写或降低其 `base_criticality`。执行过程中 Planner 可以新增支撑性 Requirement：

```text
Requirement.origin
├── INITIAL
└── PLANNER_ADDED
```

Planner-added Requirement 可以帮助完成 Initial Requirement，但不能反过来偷偷提高原问题的完成门槛。

Requirement 与 Artifact 继续共享统一 `ArtifactDescriptor`、ArtifactType、canonical Entity、typed Constraint 和 semantic data key，保持 `Requirement = what we need`、`Artifact = what we have` 的对称关系。

## 4. Planner 拿到 RequirementState，也能检阅 Artifact

Planner 不应只看到 `R1 = PARTIAL` 这种过度压缩状态。它需要：Initial/Planner-added Requirements、RequirementStates、相关 Artifact index、ArtifactAssessment summary、执行历史摘要、当前 round/budget 与约束。

默认只加载 Artifact 的索引、descriptor、关键结果和 Judge summary；如果 Planner 需要深入检查，再由 Shared Context Service 提供对应 Artifact projection。

因此 Judge 的 Assessment 必须有简短、可消费的总结，而不是只有一个离散等级。

## 5. Planner 自己决定 PLAN / REPLAN / STOP_PLANNING

最新职责边界进一步收敛：Planner 根据当前 RequirementState、Artifact 情况、recoverability、轮数、预算和 source availability 决定是否值得继续规划。

```text
PlanningDecision
├── PLAN
├── REPLAN
└── STOP_PLANNING
```

核心 Requirement 未满足且仍有合理获取路径时选择 REPLAN；达到最大轮次、所有来源均不可用、数据客观不存在、policy 阻止或预算耗尽时返回 STOP_PLANNING。

为了防止 Objective 未完成时 Orchestrator 反复调用 Planner，需要显式：

```text
planner_terminal = true
terminal_reason = ...
```

除非用户放宽约束、获得新权限、新 source 出现或新的 Artifact 到达，否则 Orchestrator 应尊重 terminal planning state。

## 6. Router 与 Orchestrator 保持窄职责

Planner 回答“应该做什么”；Router 回答“这个 Task 去哪里做”。Router 可以基于 freshness、cost、availability、previous failures 推翻 Planner 的 source preference，但不能绕过用户 constraint 或 Governance policy。

Orchestrator 仍是办公室管理者，而不是领域专家。它负责调度、并行、等待、权限、预算、跨 State transition、用户 escalation 和 Finalization。它不重新做 Planner、Router、Judge 的专业工作。

Sub-agent 只更新自己的 Local State；跨 Domain 状态变化由 Orchestrator 审阅，继续遵循：

```text
Local ownership + reviewed global transition
```

## 7. ArtifactAssessment：代码给事实基线，Judge 做上下文解释

Artifact 本身尽量 immutable；Quality 不属于 Artifact 固有属性。Assessment 绑定 `artifact_ref + requirement_ref + objective_ref`，保存 Artifact 索引与评估结果，不复制 payload。

```text
ArtifactAssessment
├── artifact_ref
├── requirement_ref
├── deterministic_result
├── judge_result
├── final_assessment
├── assessment_summary
├── usable_for
└── limitations
```

Deterministic Validation 分两类：

```text
Hard Validation
- corrupted artifact
- wrong entity
- required field completely missing
- explicit time range entirely wrong
- integrity / policy failure

Soft Validation Signals
- temporal coverage
- freshness
- sample size
- qualification
- missing ratio
```

Hard failure 不能被 Judge 推翻。Soft signals 是辅助事实，Judge 可以根据当前 Requirement 相当程度调整最终 Assessment。例如 27/30 天覆盖对“近期趋势”可能足够，对精确 30 天对比则可能不足。

因此原则是：deterministic layer 提供可计算事实与不可绕过的 hard gates；Judge 判断 contextual usability。

## 8. RequirementState 与 ObjectiveState 由服务更新，不再增加 Sub-agent

`Requirement State Service` 根据 Requirement、ArtifactAssessment 和执行/治理结果更新 RequirementState；`Objective State Service` 根据 RequirementStates 更新 ObjectiveState。

它们都是确定性/规则驱动的状态服务，不是新的 Sub-agent。

信息流：

```text
ArtifactAssessment
        ↓
Requirement State Service
        ↓
RequirementState ─────→ Planner
        ↓
Objective State Service
        ↓
ObjectiveState ───────→ Orchestrator
```

RequirementState 主要服务 Planner 的继续规划判断；ObjectiveState 主要服务 Orchestrator 的协调和 Finalization。

底层原因不需要在 RequirementState 里重复发明：低样本来自 Assessment，source unavailable 来自 Execution/Routing，budget/policy 来自 Governance。State 只保存当前投影与相关引用。

## 9. COMPLETE、LIMITED 与规划终止

`ObjectiveState` 仍倾向：

```text
PENDING / IN_PROGRESS / COMPLETE / LIMITED / FAILED
```

`COMPLETE` 表示核心 Initial Requirements 已足够回答，可保留 optional gaps 和 limitations。

`LIMITED` 的含义进一步明确：核心 Requirement 没有全部满足，但 Planner 已确认在当前约束、权限、数据源、轮数与预算下没有合理继续规划路径，同时已有结果仍足够形成有价值的受限回答。

`FAILED` 表示连可靠的受限回答都无法形成。

## 10. Response Agent 只看到 accepted outputs，不看到尝试过程

最终 Response Agent 不应看到上游 Sub-agent 的 attempt history、失败 route、旧 plan、被拒绝证据或内部 reasoning。

Finalization 由 Orchestrator 生成系统内部 `CompletionReport`，再投影成面向回答的 `ResponsePackage`：

```text
ResponsePackage
├── confirmed query / objectives
├── objective results
├── final accepted Artifacts
├── final accepted Evidence
├── critical Shared Knowledge
├── limitations
├── optional gaps
├── unresolved items
└── provenance
```

真正支持最终结论的 Artifact / Evidence 必须保留。Shared Knowledge 只有在实质影响答案时才暴露，例如 qualification rule、metric definition、league baseline；内部 schema mapping、unused RAG chunks、Entity Dictionary 的技术细节通常不需要呈现给用户。

核心原则：

> Downstream agents consume accepted products, not upstream working history.

## 11. Checkpoint 是可恢复状态坐标，不是全量序列化

Checkpoint 不复制大型 Artifact、attempt history 和所有 Domain Result，而是记录某个一致时刻各 State Domain 的版本引用。

```text
Artifact / Domain Result
→ 独立持久化

Event / Trace
→ 保存历史

Checkpoint
→ 保存一致恢复坐标
```

推荐采用 Snapshot + Event History：恢复时加载最近 Checkpoint，再 replay 少量后续 event。`WAITING_FOR_USER`、Plan accepted、并行任务批次完成、Assessment 完成、Plan revision、Objective terminal 等 meaningful transition 都适合作为 checkpoint 时机。

RUNNING Task 在恢复后不能默认仍运行，应进入 interrupted/unknown 语义再判断是否可安全重试。只读查询与确定性 Feature Engine 更容易做到幂等恢复。

## 12. 长期 Persistence：Control Plane 与 Data Plane 分离

Agent 自己的长期数据不应写进现有 baseball analytics 数据库。推荐独立 Operational PostgreSQL 作为 Agent Control Plane：

```text
Agent Operational PostgreSQL
- users / sessions / runs
- objectives / requirements / plans
- state domains / checkpoints
- reports / assessments
- artifact metadata / provenance / lineage
- user-confirmed preferences / decisions
- pgvector embeddings / retrieval index
```

大型 Artifact payload、raw web documents、大表或归档 payload 放 Object/Blob Storage；第一版本地 filesystem 即可通过统一 ArtifactStorage interface 抽象，后续可切 S3/MinIO。

Redis 暂不作为必需组件，只在未来需要 cache、lock、queue、rate-limit 时引入。

现有：

```text
baseball_analytics PostgreSQL
Parquet / DuckDB
```

继续作为 Data Plane，只读提供棒球数据；Agent Runtime Database 与它物理/权限隔离。

## 13. Retrieval 不是独立 Sub-agent，而是 Shared Context 的内部能力

前一版曾考虑独立 Retrieval Agent，但职责与其他 Sub-agent 重叠。当前修正为：Retrieval 只是 `Shared Knowledge & Context` 的内部子功能，像资料管理员一样按调用者请求递材料，不做新的业务判断。

```text
Shared Knowledge & Context
├── Knowledge Sources
│   ├── RAG
│   ├── Metric Registry
│   ├── Schema Registry
│   ├── Source Mapping
│   ├── Entity Dictionary
│   └── League State
├── Persistent Context Sources
│   ├── Completion Reports
│   ├── Accepted Artifacts / Evidence
│   └── User Preferences
└── Context Management
    ├── Retrieve
    ├── Filter
    ├── Rank
    ├── Freshness Check
    ├── Project
    └── Deliver
```

代码 filter 只能在情境和结构化 metadata 足够明确时使用；大量非结构化资料可以使用 semantic retrieval、full-text、reference traversal 等组合。具体 retrieval 策略是 Context Service 的实现细节，而不是再增加一个独立业务 Agent。

## 14. System State、CompletionReport 与 LLM Context 分层

完整 System State 可以长期保存 attempts、reports、transitions、rejected candidates 和旧计划；正常 Sub-agent Context 只获取当前任务相关、仍有效、经过筛选的投影。

跨 Run 新问题优先从 `CompletionReport + final artifacts + user decisions` 恢复相关历史，而不是重新加载全部 execution history。

因此长期原则是：

```text
Persist broadly, retrieve narrowly.
```

## 15. Architecture Freeze

截至 2026-09-14，宏观架构已经基本设计完成。后续不再横向增加大模块，除非 Domain Modeling 发现真正矛盾。

下一阶段顺序：

```text
Architecture Freeze
        ↓
Domain Modeling
        ↓
ADR
        ↓
Architecture / Feature Spec
        ↓
Tickets
        ↓
TDD / Implementation
        ↓
Code Review
```

Domain Modeling 优先正式定义：`AnalysisObjective / ObjectiveState`、`ArtifactRequirement / RequirementState`、`AgentTask / TaskExecution`、Artifact / ArtifactAssessment、AgentReport、PlanningDecision、Checkpoint 与 ContextPackage 的契约和引用关系。

**来源：** S5，2026-09-07 至 2026-09-14 当前 Baseball Agent 架构讨论。
