# Task Planner：任务之间传递什么，才能继续执行

一旦问题被拆成多个步骤，最容易丢失的就不再是原始文本，而是步骤之间的约定。上一步查到了哪些球员？年份和筛选条件是否已经固定？下一步真正依赖的是某个 task_id，还是某类已经得到的数据？一个任务显示“完成”时，究竟完成了什么？

> **2026-09-15 实现状态更新：** 本文最初记录的是 Architecture Freeze 前后的设计收敛。S6 对当前 GitHub 仓库的直接审计确认，下面大部分核心契约已经进入真实 Runtime：Objective/Requirement Definition-State 分离、Requirement Decomposer、immutable Initial Requirement、Planner PLAN/REPLAN/STOP、planner terminal、SourceMapping→Router、Checkpoint/Resume、Clarification/Permission/ConstraintRevision lifecycle 均已有实现与测试。最新工程落地见第 10 篇文章与 `current-state.md`。

## Objective 先于 Planner

Semantic Understanding Layer 负责把用户问题拆成 `AnalysisObjective`，Planner 不再重新解释用户到底想问什么。

例如用户问“分析某球员最近打击下滑、伤病影响和薪资性价比”，Semantic Layer 可以拆成：

- `player_performance`
- `injury_context`
- `salary_value`

`objective_type` 采用受控主类，允许开放 subtype 和 description。如果用户自己也不明确问题含义，Semantic Layer 不强行猜测，而是产生 `ClarificationRequest`。

当前实现已经支持：

```text
ambiguous query
→ ClarificationRequest
→ WAITING_FOR_USER checkpoint
→ user answer
→ USER_CONFIRMED constraint
→ same-run resume
```

## Definition 与 Runtime State 从一开始就并存

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

State Service 负责根据已经形成的事实更新状态，不再增加同职责 Sub-agent。

## Requirement Decomposer：先决定需要什么，再决定怎么做

Planner 前保留窄职责的 `Requirement Decomposer`：

```text
AnalysisObjective
      ↓
Requirement Decomposer
      ↓
Initial ArtifactRequirement[]
      ↓
Planning Agent
```

它回答“需要什么信息”，不选择 Tool，也不能因为当前 source 不方便就删掉用户明确要求。

Requirement 追求 **semantic atomicity**，而不是 field-level atomicity。例如“近期击球质量”可以是一个 Requirement，内部包含 EV、HardHit%、Barrel% 等 required/optional data。

## Initial Requirement 是不可修改的业务基线

```text
Requirement.origin
├── INITIAL
└── PLANNER_ADDED
```

Planner 可以增加支撑性 Requirement，但不能删除、改写或降低 Initial Requirement 的 `base_criticality`，也不能用新增 Requirement 偷偷提高原 Objective 的 Completion 门槛。

这条 invariant 已经被 Runtime audit 专门攻击和保护。

## Requirement 与 Artifact 使用同一套语义语言

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

`ArtifactRequirement` 表示“我要什么”，Artifact 表示“我现在有什么”。两者使用同一套 ArtifactType、canonical Entity、typed Constraint 和 semantic data key。

## Planner 负责完整 Planning Loop

Planner Context 至少包含：

```text
immutable Initial Requirements
Planner-added Requirements
RequirementStates
accepted Artifact index
ArtifactAssessment summaries
execution summary
round / budget
relevant Shared Context
```

Planner 默认不吞下所有 payload，需要时再通过 ContextService 获取 projection。

## Planner 自己决定 REPLAN 或停止

```text
PlanningDecision
├── PLAN
├── REPLAN
└── STOP_PLANNING
```

核心 Requirement 未满足且仍有合理路径时 REPLAN；达到最大轮次、无有效 source、policy 阻止、预算耗尽或需求已经充分时 STOP。

同时显式维护：

```text
planner_terminal = true
terminal_reason = ...
```

没有新的 Artifact、权限、source、clarification answer 或 constraint revision 时，Orchestrator 不得再次无意义调用 Planner。

## Router 与 Planner 是不同职责

```text
Planning Agent
“应该做什么？”

Routing Agent
“这个 Task 去哪里做？”
```

当前实现已经把 `SourceMappingResolver` 真正接入 Runtime。Router 不只看 artifact_type，也可以按 `data_keys` 检查 capability，避免一个泛化 Evidence source 冒充能提供 injury、salary 等不支持的数据。

优先级仍保持：

```text
SYSTEM_POLICY
>
USER_CONSTRAINT
>
SOURCE CAPABILITY / SOURCE MAPPING
>
PLANNER PREFERENCE
>
ROUTER OPTIMIZATION
```

## Orchestrator 是管理者

Orchestrator 负责调度、等待、权限、预算、checkpoint、cross-domain transition 与 Finalization，不重新做 Requirement decomposition、Routing 或 Judge 的专业判断。

核心原则：

```text
Local ownership + reviewed global transition
```

## Plan、Execution、Attempt 分离

```text
AgentTask
= Planner 想做什么

TaskExecution
= 任务总体执行情况

TaskAttempt
= 一次真实尝试
```

技术错误可由 Executor retry；业务缺口通过 ArtifactAssessment / RequirementState 回到 Planner。

## 多个 State Domain，而不是 giant AgentState

Runtime State 拆成 Query、Objective、Requirement、Planning、Routing、Execution、Artifact、Assessment、Interaction、Permission、Budget、Checkpoint 等独立域。State 保存 refs / version，而不是复制整个对象图。

## Checkpoint、Persistence 与 Context 分开

```text
System State ≠ LLM Context
```

Checkpoint 保存可恢复坐标；Artifact / Domain Result 独立持久化；ContextService 从持久状态、Accepted Artifacts、Completion Reports 与 Shared Knowledge 中投影调用者真正需要的信息。

当前 Runtime 已支持 `WAITING_FOR_USER`、Artifact reuse、terminal persistence 和 same-run resume。

## 从设计阶段进入实现阶段

本文形成时项目刚进入 Architecture Freeze。到 2026-09-15，这套契约已被 DeepSeek 实现、GPT-5.6 adversarial audit、Astra integration 再次收口。

下一阶段重点不再是继续发明 Task contract，而是：真实 PostgreSQL / Parquet / Web E2E、复杂 MLB query、final review 与 v0.1 release。

**来源：** S1、S5、S6。
