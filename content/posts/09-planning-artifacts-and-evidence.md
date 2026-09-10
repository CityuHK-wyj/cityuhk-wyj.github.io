# Task Planner 再收敛：依赖数据，而不是依赖字符串

这一轮讨论把 Task Planner 从“让 LLM 排任务顺序”进一步收敛成了一个更可执行的方案：任务需要有依赖，但依赖不应主要绑死在某个 task_id 上，而应描述后续步骤真正需要的数据；工具返回执行事实，Planner 只在语义性问题出现时重新规划。

**记录性质：** 以下是 2026-09-10 前讨论确认的设计方向，尚不代表 Agent 仓库已经实现这些接口。

## 1. Plan 与 Execution 分离

`AgentTask` 只回答“计划要做什么”，运行状态不直接写回原计划。执行过程单独由 `TaskExecution` 保存，并保留每一次 `TaskAttempt`。

这样一次 PostgreSQL 查询可以经历 timeout、再次尝试、参数调整和最终成功，而不需要反复改写 Planner 最初生成的任务。技术性失败（例如 timeout、connection reset）由 Executor 在原参数上重试；`NO_DATA`、时间范围错误、数据源不覆盖、样本不足等语义性问题则交给 Result Analyzer 识别，再由 Planner re-plan。

这形成三层职责：

- `AgentTask`：Planner 想做什么；
- `TaskExecution`：这个任务整体执行到了哪里；
- `TaskAttempt`：某一次具体调用用了什么参数、得到什么 ToolResult。

完整 attempt history 用于 debug、evaluation 和恢复；正常 LLM 上下文不应直接吞入所有失败历史。

## 2. Checkpoint 是 AgentState 的持久化，而不是“每步都问一次 LLM”

任务完成后，结果先写入共享 `AgentState`。Checkpoint 保存某个时刻的运行状态，用于恢复和审计。

但这不意味着每个 Task 后都调用一次 LLM。更稳的流程是：ToolResult → deterministic state update → quality gate；只有遇到需要语义判断或重规划的检查点，才把压缩后的 Context View 交给模型。

因此必须区分：

- **System State**：包含完整执行历史、失败、候选数据、重试等；
- **LLM Context View**：只包含用户目标、当前计划摘要、已验证数据、未解决缺口和当前需要模型做的决定。

这可以降低上下文污染和意外循环。

## 3. 从 task dependency 转向 artifact requirement

单纯的 `depends_on=["t1"]` 太粗。后续任务真正依赖的往往不是“t1 这个任务”，而是 t1 产生的某类数据。

因此更合适的做法是让 Task 声明结构化的 `ArtifactRequirement`：需要什么数据类型、哪些实体、时间范围、Constraint、required data、optional data，以及质量要求。系统再到 Artifact Store 中寻找能够满足要求的数据。

这比维护大量 `tucker_recent_data`、`recent_tucker_stats` 之类的自由字符串稳定得多，也避免 artifact_id 分类无限膨胀。

`depends_on` 仍然可以保留，但更适合表示纯 workflow dependency，例如“必须先验证再格式化”；真正的数据依赖则由 Requirement 表达。

## 4. 实体和数据都要使用 canonical identity

球员不能靠显示名做机器关联。`Hernandez`、`Will`、`Kyle` 都可能产生歧义，即使完整姓名也可能重复。

Entity Resolver 应在 Planner 之前把用户输入解析成 canonical entity，例如 MLBAM ID；`display_name` 给用户和 LLM 看，`canonical_id` 才是内部关联依据。

同样，Artifact 不应靠自然语言名称匹配。Requirement 描述“我要满足哪些条件的数据”，Artifact Store 负责用结构化 metadata 判断已有数据是 `SATISFIED`、`PARTIAL` 还是 `MISSING`。

## 5. Constraint 继续作为统一查询约束语言

`ArtifactRequirement` 的过滤条件不使用自由 `dict`，而复用前面设计的 typed `Constraint`。

例如“95 mph 以上、高区”应表达成数值约束和类别约束，而不是让 Planner 在不同阶段生成 `speed`、`velocity`、`release_speed` 等漂移字段。

这样 Query Understanding → Planner → ArtifactRequirement → SQL/API generation → Validator 可以共享一套约束语义，减少字段漂移和信息损失。

## 6. Semantic requirement 与 physical schema 分离

Planner 不应直接要求 PostgreSQL 的 `launch_speed` 这种物理字段，而应描述系统内部统一的 semantic requirement，例如 `exit_velocity`、`hard_hit_rate`、`salary`、`injury_context`。

确定性的字段映射由 Registry 管理，例如 `exit_velocity` 在 Statcast 中映射到 `launch_speed`。Schema RAG 则更适合保存表关系、字段说明和需要按语义检索的上下文，不应该承担所有精确执行映射。

对于 Web，Router 只决定“去哪里找”，不负责把文章转成数据库字段。Web Tool 返回 `RawWebResult`，Evidence Extractor 再把可标准化事实转换成 structured evidence；不适合安全标准化的内容保留为带来源的 claim，而不是强行转成一个布尔字段。

## 7. ToolResult 记录工具事实，Result Analyzer 判断业务意义

`0 rows` 不等于工具失败。ToolResult 应区分 SQL 是否执行成功、结果状态、错误类型、是否可重试和来源。

`retryable` 属于工具层：同一个工具能否再次尝试；`recoverable` 属于 Agent 层：整个系统是否还能通过另一个数据源补齐缺口。

来源也分两层：ToolResult 记录本次用了哪个工具或入口，具体数据和 Evidence 自己记录更细的来源。这样既能优化 Tool Router，也能追溯每一条证据。

## 8. 不让低质量中间结果直接污染上下文

Collected data 不自动等于 Approved data。新结果先作为 Candidate Artifact，经过校验后才能成为主要分析输入；低样本、来源冲突或部分覆盖可以保留，但必须携带质量状态和限制。

这也是 confidence loop 能安全运行的前提。此前讨论中的 confidence 更接近 **analysis sufficiency**，不是模型“有多少概率正确”。当仍有 recoverable gap 时继续寻找；当缺口客观不可恢复时允许以 `LIMITED` 状态退出，并明确告诉用户原因，例如未达到 qualified threshold 或某年代根本不存在该指标。

## 9. Metric Registry 保持简单，组合工作交给 Planner

本轮进一步确认：不要让 Registry 变成一个替 Planner 做完全部决策的规则引擎。

Registry 重点保留两个对象：

- `MetricDefinition`：指标是什么、单位、定义、时间有效性；
- `SourceMapping`：某个 source 如何取得这个 metric，是 `DIRECT`、`CALCULATED` 还是没有映射。

其中 `CALCULATED` 比 `DERIVED` 更直观，表示 Feature Engine 可以根据底层数据确定性计算。若单个 source 无法满足组合需求，Planner 负责拆成多个 Task，例如 PostgreSQL 获取 Statcast、Feature Engine 计算 HardHit%、Web/Spotrac 补薪资，再综合分析。

这避免把“一个 source 能不能满足整个用户问题”错误地塞进单个 metric 的状态里。

## 10. Metric Registry 与 RAG 的边界

两者不是二选一。

**Metric Registry** 存系统必须稳定知道、程序可以直接执行的事实，例如 metric_id、计算定义、source mapping、时间有效范围。目标是 execution correctness。

**RAG Knowledge Base** 存需要按语义检索、可能随语境和时代变化的知识，例如“击球质量通常看哪些维度”、指标 caveat、球探框架、联盟战术趋势。目标是 semantic reasoning。

因此，“HardHit% 如何计算、在哪个 source 能拿”属于 Registry；“分析击球质量时为什么要同时看 EV、Barrel%、xwOBA，以及小样本下怎么解释”更适合 RAG。

## 当前收敛出的原则

这一轮最重要的变化不是增加更多模块，而是减少 LLM 不必要承担的职责：LLM 描述需求并做语义性决策，代码生成稳定标识、校验 Constraint、管理 retry/checkpoint、匹配 Artifact、执行计算；只有异常和真正需要重规划的地方才进入新的 LLM checkpoint。

接下来仍需继续讨论的核心问题包括 `ArtifactRequirement` 和 `DataArtifact` 的正式 schema、质量要求如何表达、Planner 如何消费 MetricDefinition/SourceMapping，以及 Result Analyzer 的 sufficiency 计算规则。

**来源：** S5，2026-09-07 至 2026-09-10 当前 Baseball Agent 架构讨论。
