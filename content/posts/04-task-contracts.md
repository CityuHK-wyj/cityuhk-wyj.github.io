# Task Planner：任务之间传递什么，才能继续执行

一旦问题被拆成多个步骤，最容易丢失的就不再是原始文本，而是步骤之间的约定。上一步查到了哪些球员？年份和筛选条件是否已经固定？下一步真正依赖的是某个 task_id，还是某类已经得到的数据？一个任务显示“完成”时，究竟完成了什么？

**记录性质：** 设计讨论整理；下面的对象名和字段是当前收敛方向，不代表已落地接口。本文在 2026-09-11 根据后续讨论继续修订。

## Objective 先于 Planner

当前职责边界进一步明确：Semantic Understanding Layer 负责把用户问题拆成 `AnalysisObjective`，Planner 不再重新解释用户到底想问什么。

例如用户问“分析某球员最近打击下滑、伤病影响和薪资性价比”，Semantic Layer 可以拆成：

- `player_performance`
- `injury_context`
- `salary_value`

`objective_type` 采用受控主类，允许开放的 subtype 和 description。这样既能给系统稳定边界，又不会把棒球问题限制成僵硬菜单。

每个 Objective 可以有默认 `base_priority`，Planner 再根据用户强调程度、当前证据和执行成本得到 `effective_priority`。Router 可以据此调整执行策略，但不应擅自改变 Objective 的业务重要性。

如果用户自己也不明确问题含义，Semantic Layer 不应强行猜测。它应生成少量合理选项交给用户确认，例如“最近怎么样”可以拆成场上表现、伤病/阵容状态、综合表现与舆论等解释。系统可以给出推荐选项，但改变问题含义的决定最终属于用户。

## Requirement Decomposer：先决定需要什么，再决定怎么做

Planner 前增加一个职责更窄的 `Requirement Decomposer` 子 Agent。它根据 Objective 与 Shared Knowledge Services 判断，为回答这个 Objective 最合理的数据需求单元是什么。

```text
AnalysisObjective
      ↓
Requirement Decomposer
      ↓
ArtifactRequirement[]
      ↓
Planning Agent
      ↓
AgentTask[]
```

Requirement Decomposer 可以读取 Metric Registry、RAG Knowledge Base、Schema/Source Mapping、Entity Dictionary 与 League/Reference Context，但它只回答“需要什么信息”，不能决定具体 Tool，也不能用当前数据源能力反过来删掉用户明确要求。

Requirement 的拆分追求 **semantic atomicity**，而不是 field-level atomicity。比如“近期击球质量”可以作为一个完整 Requirement，内部包含 EV、HardHit%、Barrel% 等 required/optional data，而不是每个指标拆成一个独立 Requirement。

## base_criticality 是 Requirement 的语义属性

每个 Requirement 可以带 `base_criticality`，表示它对原始 Objective 的业务重要性。这个值由 Requirement Decomposer 根据用户问题和领域知识确定，原则上近似 immutable。

后续 Planner / Orchestrator 可以基于轮数、预算和失败历史调整执行调度，但不能为了更容易完成任务，把一个原本 CRITICAL 的 Requirement 悄悄降成 LOW。调度优先级可以变化，Completion semantics 不能被偷偷改写。

## Requirement 与 Artifact 使用同一套语义语言

`ArtifactRequirement` 表示“我要什么”，实际 Artifact 表示“我现在有什么”。两者不应各自发明字段，而应共享一个统一的 semantic contract，例如 `ArtifactDescriptor`：

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

Requirement 与 Artifact 都使用相同的 `ArtifactType`、canonical Entity、typed Constraint 和 semantic data key。Requirement Matcher 才能直接比较结构化条件，而不是猜测 `PLAYER_STATS` 和 `STAT_TABLE` 是否代表同一种东西。

`artifact_id` 只作为运行时唯一标识，不承担复杂业务语义，也不需要维护无限细分的人工 taxonomy。

## Planner 负责执行策略，不重新解释用户问题

Main Planner 接收已经标准化的 Objective、ArtifactRequirements、已有 Artifact、当前 ObjectiveState、执行历史与预算，输出逻辑上的 `ExecutionPlan`。

一个 Requirement 可以需要多个 Task，一个 Task 也可以同时服务多个 Requirement。比如“近期击球质量”可能先取 Statcast events，再由 Feature Engine 计算指标；一次结构化查询也可能同时为多个 Requirement 提供 EV、launch angle 与 barrel 信息。

Planner 可以设置 source preference，例如“优先结构化来源”“优先本地数据”“优先官方来源”，但一般不硬绑定具体工具。Preference 只是偏好，不是 Constraint；只有用户明确指定来源或 Governance 规则形成的 hard constraint 才必须遵守。

## Router 与 Planner 是并列的决策型 Sub-agent

Router 不只是一个简单 if/else 函数，而是 Orchestration Layer 下与 Planner 并列、但权限更窄的 Routing Agent：

```text
Planning Agent
“应该做什么？”

Routing Agent
“这个 Task 现在应该去哪里做？”
```

Router 接收 Task、Planner preference、SourceMapping、Schema Registry、available tools、freshness、cost、previous failures 等信息，输出 `RoutingDecision`。大多数确定性场景优先由规则解决；多个可行来源之间需要权衡时，可以使用轻量模型。越靠近真实执行，决策空间越应收窄。

Router 可以违背 Planner preference，例如本地数据过旧时改用实时来源，但不能绕过用户明确的 source constraint 或 Governance Policy。

## Orchestrator 是管理者，不是另一个领域专家

Orchestrator 更像办公室管理者：它看到各 Sub-agent 的执行状态、阻塞、权限请求、预算和 Objective 进展，并负责协调工作，而不是指导每个 Sub-agent 怎样完成专业任务。

它负责：

- 调度 ready 的 Sub-agent / Task；
- 管理并行、等待和阻塞；
- 分配执行权限与预算；
- 接收标准化 Report / Decision；
- 更新跨 Domain 的运行状态；
- 判断何时再次调用 Planner；
- 判断何时需要询问用户；
- 判断何时结束并进入 Response。

它不负责决定指标含义、Requirement 如何拆分、Web 证据是否可信、Router 应选哪个来源或具体棒球结论如何解释。

Re-planning 因此不需要单独拥有一个“第二 Planner”。同一个 Planning Agent 支持 `INITIAL_PLAN` 与 `REVISE_PLAN` 两种模式。Orchestrator 决定 **何时**需要重规划；Planner 决定 **计划应该怎样改**；Router 决定 **修改后的 Task 具体去哪里执行**。

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

原始计划不因为 `pending → running → failed → retrying → completed` 被反复改写。每次 attempt 保留参数快照和 ToolResult，便于 debug、evaluation 和 checkpoint 恢复。

技术性错误如 timeout、connection reset 可以由 Executor 在不改变语义计划的情况下直接 retry；`NO_DATA`、数据源不覆盖、样本不足或结果无法满足 Requirement 等语义性问题进入整体评估，再由 Orchestrator 决定是否调用 Planner 的 revise mode。

## 多个 State Domain，而不是一个巨大 dict

运行时状态倾向拆成多个独立 State Domain，例如：

```text
AgentRuntimeState
├── QueryState
├── ObjectiveState
├── Requirement / PlanningState
├── RoutingState
├── ExecutionState
├── ArtifactState
├── InteractionState
├── PermissionState
└── BudgetState
```

不同 State Domain 尽量采用相同设计原则：Definition 与 State 分离、保存引用而不是复制完整对象、记录 version / timestamps / transition reason，并限制每个 Domain 只管理自己的职责。

`AgentRuntimeState` 更像这些 State Domain 的协调入口，而不是包含数百字段的超级 JSON。

## Local ownership + reviewed global transition

Sub-agent 类似提交报告的员工。它可以更新自己所属的 Local State，但不能直接修改其他 Domain 或全局状态。

例如 Router 可以更新自己的 RoutingState，并提交 `RoutingReport`；Judge 可以更新自己的 JudgeState 并提交 ArtifactAssessment；Planner 可以更新 PlanningState。但它们不能自行批准权限、把 Objective 标记 COMPLETE、修改用户确认过的 Constraint 或删除其他模块的 Artifact。

统一模式是：

```text
Sub-agent
   ↓
更新自己的 Local State
   ↓
提交 Report / Decision
   ↓
Orchestrator Review
   ↓
产生 Cross-domain State Transition
```

这既保留专业模块的自治，也减少并行执行时多个 Agent 同时改写全局状态造成的 race condition。

## Checkpoint 保存状态，不意味着每步都问 LLM

完整 Runtime State 可以用于恢复、审计和调试；正常 LLM Context View 只包含当前 Objective、已验证 Artifact、未解决 Requirement 和真正需要模型决策的信息。Checkpoint 是 State persistence，而不是“每一步都重新调用大模型”。

## 当前未决问题

正式 `ArtifactRequirement` / `Artifact` / `AgentReport` schema、Requirement Matcher、State transition contract、plan versioning、checkpoint persistence，以及 Orchestrator 对各类 Report 的审阅规则仍需要在 Domain Modeling 与 spec 阶段定稿。

**来源：** S1、S5。本文更新内容来自 2026-09-07 至 2026-09-11 当前架构讨论。
