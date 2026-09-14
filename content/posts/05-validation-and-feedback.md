# 可靠的 Agent 循环：零行、错误与低置信度

项目偏好的工作顺序逐渐明确：先获取与 Objective 相关的数据，让程序和专门的质量评审节点判断这些数据是否足以进入主分析上下文；必要时补查其他来源，再根据 Requirement / Objective 状态决定继续、受限回答或停止。

**记录性质：** 已讨论原则与当前工程设计方向；没有声称 Validator、Judge Agent 或 sufficiency engine 已实现。本文在 2026-09-14 根据后续讨论继续修订。

## Validation 是横切能力，而不是单独的一站

Validation 不应只被理解为“SQL 执行前的一层”。它贯穿整个 Agent：

```text
User Input → input / policy validation
Semantic Output → entity / constraint validation
Planner Output → plan validation
SQL / Tool Call → execution validation
ToolResult → result validation
Artifact → quality validation
Final Report → claim / evidence validation
```

因此 Validation / Policy 属于 cross-cutting governance。项目仍希望保留模型生成 SQL 的能力，但 SQL AST、只读权限、允许访问的表和路径、超时与结果规模必须由程序约束。

## PostgreSQL / DuckDB 是只读分析资源

数据库修改权限属于系统管理员，而不是业务用户。当前 Baseball Agent Runtime 中，PostgreSQL、DuckDB / Parquet 等本地分析资源应被视为 read-only resources。

用户不能通过对话授权 Agent 执行 `INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE` 等修改操作；这类请求属于 `BLOCKED_BY_POLICY`，而不是 `WAITING_FOR_USER`。

## 0 rows 只是一个执行观察

SQL 成功但 0 rows、赛季未加载、实体匹配失败、qualification 后无结果、查询本身报错，业务含义完全不同。因此 ToolResult 必须把“执行是否成功”和“结果是否足以回答问题”分开。`retryable` 属于 Tool 层；`recoverable` 属于 Agent 层。

## Qualification 与 Sample Adequacy 必须分开

`qualification_rule` 决定谁有资格进入查询或排行榜；`sample_adequacy_rule` 判断现有样本是否足以支撑某种分析结论。两者不能混成一个 `minimum_sample_size`。

赛季进行中的 qualification 还依赖动态 League State。数据库最大日期只能说明本地数据同步到了哪里，不等于 MLB 实际赛季进度；权威赛程进度与本地 coverage 应分开记录。

## Artifact 本身与 Assessment 分离

Artifact 尽量保存不可变的数据事实：descriptor、payload、provenance、lineage、created_at 等。质量不是 Artifact 的固有属性，因为同一份数据对不同 Requirement 的适用性可能不同。

`ArtifactAssessment` 更像针对某个 Artifact 的评估索引记录：

```text
ArtifactAssessment
├── assessment_id
├── artifact_ref
├── requirement_ref
├── objective_ref
├── deterministic_result
├── judge_result
├── final_assessment
├── assessment_summary
├── usable_for
├── limitations
└── assessed_at
```

它不重复存 Artifact payload，只通过 ref 关联。一个 Artifact 可以针对不同 Requirement 产生不同 Assessment。

## Deterministic Validation 是事实基线，Judge 做上下文解释

当前收敛不是“代码完全决定质量”，也不是“Judge 可以推翻一切”。更准确的分工是：

```text
Artifact
   ↓
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

Hard Validation 包括 artifact 损坏、实体错误、必需字段完全缺失、明确时间范围完全错位、policy/integrity failure 等。这类结果 Judge 不能覆盖。

Soft Validation Signal 包括时间覆盖比例、freshness、样本规模、qualification、缺失比例等。代码负责计算事实，Judge 根据当前 Requirement 判断这些事实意味着什么，并可以相当程度调整最终 assessment。

例如 requested 30 days、实际覆盖 27 days 时，代码只应报告 90% temporal coverage。对于“近期大致趋势”可能仍然 ACCEPTABLE；对于需要精确 30 天对比的问题则可能降级。12 BBE 对“有没有打出 105 mph 球”可能足够，对“真实能力是否下降”则可能很弱。

所以原则是：

> deterministic layer 提供不可争辩的可计算事实和 hard gates；Judge 负责 contextual usability。

## Judge 必须输出简短可消费的总结

Planner 后续需要根据 RequirementState 和已有 Artifact 判断是否 re-plan，因此 Judge 不能只返回一个等级。

Assessment 中应保留简短 `assessment_summary`，例如：

> Covers 27/30 requested days; sufficient for recent trend analysis, but sample is too small for strong true-talent inference.

Planner 默认看 Artifact index + Assessment summary，必要时再通过 Shared Context Service 展开 Artifact 本体。这样 Planner 不需要重新做 Judge 的工作，也不会只看到一个缺乏信息的 `PARTIAL` 状态。

## RequirementState 与 ObjectiveState 是运行时投影

它们不是质量判断本体，而是根据已有事实持续更新的 State。

```text
ArtifactAssessment
        ↓
Requirement State Service
        ↓
RequirementState
        ↓
Objective State Service
        ↓
ObjectiveState
```

`Requirement State Service` 和 `Objective State Service` 都是状态更新服务，不是新的 Sub-agent。前者汇总当前 Requirement 被满足到什么程度；后者根据 RequirementStates 更新 Objective 的整体状态。

`RequirementState` 主要反馈给 Planner，用于判断还缺什么、是否可恢复以及是否需要继续规划。`ObjectiveState` 主要提供给 Orchestrator，用于判断当前 Objective 是否已经 COMPLETE、LIMITED、FAILED 或仍需继续协调。

## RequirementState 不重新创造底层原因

低样本、qualification failure、evidence rejected 等信息来自 ArtifactAssessment；source unavailable 来自 Routing / Execution；budget exhausted、policy blocked 来自 Governance State。RequirementState 应保存相关 refs 和当前投影，而不是再发明一套重复原因系统。

这样可以沿引用链解释：

```text
RequirementState
   ↓ assessment_ref / blocking_ref
ArtifactAssessment / Execution / Governance State
   ↓
真实原因
```

## COMPLETE、LIMITED 与 Planner terminal

ObjectiveState 当前倾向使用 `PENDING / IN_PROGRESS / COMPLETE / LIMITED / FAILED`。

`COMPLETE` 表示核心 Initial Requirement 已足够支撑回答，不代表所有 optional information 都存在。`LIMITED` 表示核心需求仍有缺口，但 Planner 已确认在当前约束、权限、轮次和数据源条件下没有合理继续路径，而现有结果仍足以形成有价值的受限回答。

Planner 因此需要明确返回：

```text
PLAN / REPLAN / STOP_PLANNING
```

并在无法继续时设置 `planner_terminal = true` 与 terminal reason，防止 Orchestrator 因 Objective 仍不完整而重复调用 Planner 形成死循环。

## Response Agent 只消费最终采用的结果

最终生成回答的 Agent 不应该看到上游 Sub-agent 的尝试过程。它只看到经 Orchestrator finalization 后真正需要暴露的内容：

```text
ResponsePackage
├── objective_results
├── final accepted Artifacts
├── final accepted Evidence
├── critical Shared Knowledge
├── limitations
├── optional gaps
├── unresolved items
└── provenance
```

TaskAttempt、失败 route、旧 Plan、被拒绝 Evidence、Judge 的内部工作过程等保留在 System State / Trace 中，不进入 ResponsePackage。

失败过程如果产生了真正影响结论的限制，应先被上游提炼成 user-relevant limitation，再交给 Response Agent，而不是把 attempts 原样塞进去。

## Final Evidence 与关键 Shared Knowledge 需要保留

最终回答必须能追溯真正支持结论的 Accepted Artifact / Evidence。Feature Engine 产生的计算结果可以作为最终 Artifact，并通过 lineage 指向底层输入。

Shared Knowledge 只有在实质影响回答时才需要暴露，例如 qualification rule、metric definition、league baseline。Entity Dictionary 的内部 ID 映射、Schema Registry 的物理字段映射、unused RAG chunks 等通常不需要呈现给用户。

核心原则是：

> 只有实际支持最终回答的内容才能进入 ResponsePackage。

## System State 与 LLM Context 必须分离

完整 Runtime State 可以保存 timeout、0 rows、失败 attempts、Candidate Artifact、Assessment 和旧计划，但这些内容不应全部进入模型上下文。

Shared Context Service 根据调用者和当前任务，从 Persistent State、Accepted Artifacts、Completion Reports 和 Shared Knowledge 中按需 Retrieve / Filter / Rank / Project / Deliver。Retrieval 只是 Shared Knowledge & Context 的内部子能力，不是独立业务 Sub-agent。

**来源：** S1、S2、S3、S5。本文更新内容来自 2026-09-07 至 2026-09-14 当前架构讨论。
