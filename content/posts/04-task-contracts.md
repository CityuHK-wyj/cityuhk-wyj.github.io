# Task Planner：任务之间传递什么，才能继续执行

一旦问题被拆成多个步骤，最容易丢失的就不再是原始文本，而是步骤之间的约定。上一步查到了哪些球员？年份和筛选条件是否已经固定？下一步真正依赖的是某个 task_id，还是某类已经得到的数据？一个任务显示“完成”时，究竟完成了什么？

**记录性质：** 设计讨论整理；下面的对象名和字段是当前收敛方向，不代表已落地接口。本文在 2026-09-11 根据后续讨论修订。

## Objective 先于 Planner

当前职责边界进一步明确：Semantic Understanding Layer 负责把用户问题拆成 `AnalysisObjective`，Planner 不再重新解释用户到底想问什么。

例如用户问“分析某球员最近打击下滑、伤病影响和薪资性价比”，Semantic Layer 可以拆成：

- `player_performance`
- `injury_context`
- `salary_value`

`objective_type` 采用受控主类，允许开放的 subtype 和 description。这样既能给系统稳定边界，又不会把棒球问题限制成僵硬菜单。

每个 Objective 可以有默认 `base_priority`，Planner 再根据用户强调程度、当前证据和执行成本得到 `effective_priority`。Router 可以据此调整执行策略，但不应擅自改变 Objective 的业务重要性。

## Planner 负责 Requirement 和 Task

Planner 围绕每个 Objective 设计两类对象：

- `ArtifactRequirement`：为了回答这个 Objective，需要哪些数据或证据；
- `AgentTask`：为了满足这些 Requirement，系统准备执行什么动作。

因此关系更接近：

```text
AnalysisObjective
      ↓
ArtifactRequirement
      ↓
AgentTask(s)
      ↓
DataArtifact / Evidence
```

Task 只是实现 Objective 的手段，某个 Task 失败不应直接等价于 Objective 失败，因为同一 Requirement 可能由其他 Task 或数据源满足。

## Requirement 描述条件，而不是维护大量名字

项目明确不希望手工维护细碎的 `artifact_id` 分类。更稳定的方式是规定统一的信息格式，由系统填充实际值。

`ArtifactRequirement` 当前倾向包含：

- `data_type`
- `entities`
- `time_range`
- typed `constraints`
- `required_data`
- `optional_data`
- `quality_requirements`

其中筛选条件复用之前设计的 `Constraint`，而不是自由 `dict`。这样用户的“95 mph 以上、高区、最近 30 天”等条件可以跨 Semantic、Planner、SQL/API generation 和 Validator 保持一致语义。

Requirement 描述的是“我要满足哪些条件的数据”，不是“我要某个固定 artifact_id”。Artifact Matcher 再根据已有 Artifact metadata 判断 `SATISFIED`、`PARTIAL` 或 `MISSING`。

## 数据依赖与 workflow dependency 分开

早期的 `depends_on=["t1"]` 过于粗糙。后续任务真正依赖的通常是某种数据，而不是某个任务编号。

因此：

- `requires` / `ArtifactRequirement` 表示数据依赖；
- `depends_on` 只保留纯流程依赖，例如必须先校验再格式化。

这样即使 PostgreSQL 任务失败，只要另一个 API 任务产生了同样满足 Requirement 的 Artifact，下游任务仍可继续，不需要重写整条 DAG。

## Plan 与 Execution 分离

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

技术性错误如 timeout、connection reset 可以由 Executor 在不改变语义计划的情况下直接 retry；`NO_DATA`、数据源不覆盖、样本不足或结果无法满足 Requirement 等语义性问题则交给 Result Analyzer 识别，再由 Planner re-plan。

## Re-plan 应尽量局部化

当某条路径失效时，Planner 不应无条件重建所有任务。独立 Objective 或已经完成且仍有效的 Artifact 可以保留；只有依赖失效前提的后续计划需要重构。

由于依赖优先绑定到 Requirement，而不是自由字符串 task 输出，新数据源只要能够满足相同 Requirement，就可以复用已经存在的后续计算和分析任务。

## ToolResult 由真实执行器产生

不能让模型凭印象填写查询耗时、返回行数或成功状态。Tool Adapter 应记录真实执行结果，包括成功状态、result status、payload、错误类型、`retryable`、来源和必要的执行元数据。

`0 rows` 不等于 Tool failure。SQL 成功执行但没有匹配记录，应该被记录为成功执行 + `NO_DATA`，再由 Result Analyzer 判断这是否符合业务条件。

`retryable` 表示当前工具能否在相同语义请求上重试；`recoverable` 则是 Agent 层判断整个系统是否还能通过其他数据源或新计划补齐缺口。

## Checkpoint 保存状态，不意味着每步都问 LLM

Task 结果进入 `AgentState` 后可以形成 checkpoint，但正常执行不应把每次 attempt 都直接送给 LLM。

完整 System State 用于恢复、审计和调试；LLM 只看到压缩后的 Context View，例如当前 Objective、已验证 Artifact、未解决 Requirement 和需要做出的语义决策。这样可以减少上下文污染与不必要的模型调用。

## 当前未决问题

正式 `ArtifactRequirement` / `DataArtifact` schema、Planner 的输入输出契约、Requirement Matcher、plan versioning 和 checkpoint persistence 仍需要在 Domain Modeling 与 spec 阶段定稿。

**来源：** S1、S5。本文更新内容来自 2026-09-07 至 2026-09-11 当前架构讨论。
