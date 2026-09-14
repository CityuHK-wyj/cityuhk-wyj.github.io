# Task Planner：任务之间传递什么，才能继续执行

一旦问题被拆成多个步骤，最容易丢失的就不再是原始文本，而是步骤之间的约定。上一步查到了哪些球员？年份和筛选条件是否已经固定？下一步真正依赖的是某个 task_id，还是某类已经得到的数据？一个任务显示“完成”时，究竟完成了什么？

**记录性质：** 设计讨论整理；下面的对象名和字段是当前收敛方向，不代表已落地接口。本文在 2026-09-14 根据后续讨论继续修订。

## Objective 先于 Planner

当前职责边界进一步明确：Semantic Understanding Layer 负责把用户问题拆成 `AnalysisObjective`，Planner 不再重新解释用户到底想问什么。

例如用户问“分析某球员最近打击下滑、伤病影响和薪资性价比”，Semantic Layer 可以拆成：

- `player_performance`
- `injury_context`
- `salary_value`

`objective_type` 采用受控主类，允许开放的 subtype 和 description。这样既能给系统稳定边界，又不会把棒球问题限制成僵硬菜单。

如果用户自己也不明确问题含义，Semantic Layer 不应强行猜测。它应生成少量合理选项交给用户确认。系统可以给出推荐项，但改变问题语义的决定最终属于用户。

## Definition 与 Runtime State 从一开始就并存

`ObjectiveState` 和 `RequirementState` 不是执行链末端才产生的结果，而是在对应 Definition 创建时就建立、随后持续更新的 Runtime Projection。

```text
AnalysisObjective ───────── ObjectiveState
       │                         ▲
       ▼                         │ aggregate
ArtifactRequirement ─────── RequirementState
       │                         ▲
       ▼                         │ evaluate
    AgentTask → Artifact → ArtifactAssessment
```

因此：

```text
AnalysisObjective = 用户想解决什么
ObjectiveState    = 这个目标现在解决到什么程度

ArtifactRequirement = 为回答目标需要什么
RequirementState    = 这个需求现在满足到什么程度
```

State Service 负责根据已经形成的事实更新状态，不应再新增一个同职责的 Sub-agent。

## Requirement Decomposer：先决定需要什么，再决定怎么做

Planner 前保留一个职责更窄的 `Requirement Decomposer` 子 Agent。它根据 Objective 与 Shared Knowledge Services 判断，为回答这个 Objective 最合理的数据需求单元是什么。

```text
AnalysisObjective
      ↓
Requirement Decomposer
      ↓
Initial ArtifactRequirement[]
      ↓
Planning Agent
      ↓
AgentTask[]
```

Requirement Decomposer 可以读取 Metric Registry、RAG Knowledge Base、Schema/Source Mapping、Entity Dictionary 与 League/Reference Context，但它只回答“需要什么信息”，不能决定具体 Tool，也不能用当前数据源能力反过来删掉用户明确要求。

Requirement 的拆分追求 **semantic atomicity**，而不是 field-level atomicity。比如“近期击球质量”可以作为一个完整 Requirement，内部包含 EV、HardHit%、Barrel% 等 required/optional data，而不是每个指标拆成一个独立 Requirement。

## Initial Requirement 是不可修改的业务基线

Requirement Decomposer 产生的 Initial Requirement 代表系统对原始用户问题的正式理解。Planner 可以在执行过程中发现新的支撑性需求，但不能删除、改写或降低 Initial Requirement 的语义重要性。

可以显式区分：

```text
Requirement.origin
├── INITIAL
└── PLANNER_ADDED
```

Planner-added Requirement 用于帮助完成原始 Requirement，例如为了判断打击下滑原因临时增加历史 baseline 或伤病上下文。它不能反过来偷偷提高原问题的完成门槛：如果 Initial Requirement 已足够满足，新增的可选支撑需求没拿到，不应把本可 COMPLETE 的 Objective 强行降成 LIMITED。

每个 Initial Requirement 的 `base_criticality` 表示其对原始 Objective 的业务重要性，原则上近似 immutable。执行调度可以变化，Completion semantics 不能被偷偷改写。

## Requirement 与 Artifact 使用同一套语义语言

`ArtifactRequirement` 表示“我要什么”，实际 Artifact 表示“我现在有什么”。两者不应各自发明字段，而应共享统一 semantic contract，例如：

```text
ArtifactDescriptor
├── artifact_type
├── entities
├── time_range
├── constraints
├── data_keys
├── granularity
└── population_scope
```

Requirement 与 Artifact 都使用相同的 `ArtifactType`、canonical Entity、typed Constraint 和 semantic data key。Requirement Matcher 才能直接比较结构化条件，而不是猜测两个自由字符串是否代表同一类数据。

Artifact 本体尽量 immutable；`artifact_id` 只作为运行时唯一标识，不承担复杂业务语义。

## Planner 负责完整的 Planning Loop

Planner 不只负责第一次生成 Plan，也负责根据 Requirement 的实际解决情况决定是否值得继续规划。

它至少需要看到：

```text
Planner Context
├── immutable Initial Requirements
├── Planner-added Requirements
├── RequirementStates
├── relevant Artifact index
├── ArtifactAssessment summaries
├── execution history summary
├── current round / budget
└── user/system constraints
```

Planner 默认无需吞下所有大型 Artifact 原始 payload，但必须能看到 Artifact 的索引、descriptor、关键内容和 Judge 的简短 assessment summary；确实需要深入检查时，再通过 Shared Context Service 请求对应 Artifact projection。

一个 Requirement 可以需要多个 Task，一个 Task 也可以同时服务多个 Requirement。Planner 可以设置 source preference，例如优先结构化、优先本地或优先官方来源，但一般不硬绑定具体工具。Preference 不是 Constraint。

## Planner 自己决定 Re-plan 或停止规划

最新职责边界不再是“Orchestrator 看到缺口就强制调用 revise”。Planner 根据当前 RequirementState、Artifact 情况、轮数、预算和 recoverability 判断下一步：

```text
PlanningDecision
├── PLAN
├── REPLAN
└── STOP_PLANNING
```

核心 Requirement 未满足且仍存在合理获取路径时，Planner 选择 `REPLAN` 并产生局部新 Task。核心 Requirement 已满足时通常不需要继续规划；如果已经达到最大轮次、所有可用来源都失败、数据客观不存在、政策阻止或预算耗尽，则返回 `STOP_PLANNING`。

为了防止 Orchestrator 因 Objective 仍不完整而反复调用 Planner，需要显式输出：

```text
planner_terminal = true
terminal_reason = MAX_ROUNDS_REACHED
                | UNRECOVERABLE_DATA_GAP
                | NO_VALID_SOURCE
                | POLICY_BLOCKED
                | BUDGET_EXHAUSTED
                | REQUIREMENTS_SUFFICIENT
```

只要没有新的外部条件变化，例如用户放宽约束、获得新权限、新数据源出现或新的 Artifact 到达，Orchestrator 就应尊重 terminal planning state，不再次调用 Planner。

## Router 与 Planner 是并列的决策型 Sub-agent

Router 与 Planner 都属于 Planning & Orchestration Layer，但职责不同：

```text
Planning Agent
“应该做什么？”

Routing Agent
“这个 Task 现在应该去哪里做？”
```

Router 接收 Task、Planner preference、SourceMapping、Schema Registry、available tools、freshness、cost、previous failures 等信息，输出 `RoutingDecision`。大多数确定性场景优先由规则解决；多个可行来源之间需要权衡时，可以使用轻量模型。

Router 可以违背 Planner preference，例如本地数据过旧时改用实时来源，但不能绕过用户明确的 source constraint 或 Governance Policy。

## Orchestrator 是管理者，不是另一个领域专家

Orchestrator 更像办公室管理者：它看到各 Sub-agent 的执行状态、阻塞、权限请求、预算、ObjectiveState 与 Planner 的 PlanningDecision，并负责协调工作，而不是指导每个 Sub-agent 怎样完成专业任务。

它负责调度 ready work、管理并行/等待/阻塞、处理权限与用户升级、审阅跨 Domain State transition、接收 Planner terminal signal，以及在最终状态满足时进入 Finalization。

在最新边界下：Planner 判断 **是否以及怎样继续规划**；Router 判断 **具体去哪里执行**；Orchestrator 判断 **什么时候调度这些已经有明确职责的组件，并尊重它们的终止状态**。

## Plan、Execution、Attempt 分离

`AgentTask` 只描述“计划做什么”，运行状态单独放在 `TaskExecution` 中；每次真实调用进一步保存为 `TaskAttempt`。

```text
AgentTask
= Planner 想做什么

TaskExecution
= 这个任务总体执行情况

TaskAttempt
= 某一次真实尝试用了什么参数、返回什么结果
```

原始计划不因为 `pending → running → failed → retrying → completed` 被反复改写。技术性错误可以由 Executor 在不改变语义计划的情况下直接 retry；业务缺口则通过 ArtifactAssessment 与 RequirementState 回到 Planner。

## 多个 State Domain，而不是一个巨大 dict

运行时状态拆成多个独立 State Domain，例如 Query、Objective、Requirement、Planning、Routing、Execution、Artifact、Interaction、Permission、Budget 等。每个 State Domain 保存引用而不是复制完整对象，并记录版本、时间与 transition reason。

Sub-agent 只能更新自己拥有的 Local State；跨 Domain 变化由 Orchestrator 审阅。核心模式仍是：

```text
Local ownership + reviewed global transition
```

## Checkpoint、Persistence 与 Context 不混为一谈

Checkpoint 不应复制全部 Artifact、Report 和 attempts，而是记录一个可恢复时刻各 State Domain 的一致版本引用。Artifact / Domain Result 独立持久化，Event 保存历史，Checkpoint 保存恢复坐标。

同样：

```text
System State ≠ LLM Context
```

Shared Context Service 负责从持久化状态、Accepted Artifacts、Completion Reports 与 Shared Knowledge 中按请求投影给 Planner 所需材料。Retrieval 是这一共享上下文能力的内部功能，不再单独设成与 Planner/Router 同等级的 Sub-agent。

## 当前阶段

宏观架构已进入 Architecture Freeze。下一步不再继续增加大模块，而是进入 Domain Modeling，正式确定 `AnalysisObjective / ObjectiveState`、`ArtifactRequirement / RequirementState`、`AgentTask / TaskExecution`、Artifact、ArtifactAssessment、AgentReport 与 PlanningDecision 等契约，再进入 ADR、spec、tickets、TDD 与实现。

**来源：** S1、S5。本文更新内容来自 2026-09-07 至 2026-09-14 当前架构讨论。
