# 可靠的 Agent 循环：零行、错误与低置信度

项目偏好的工作顺序逐渐明确：先获取与 Objective 相关的数据，让程序和专门的质量评审节点判断这些数据是否足以进入主分析上下文；必要时补查其他来源，再根据 Objective 级别的证据充分度决定继续、部分回答或停止。

**记录性质：** 已讨论原则与当前工程设计方向；没有声称 Validator、Judge Agent 或 sufficiency engine 已实现。本文在 2026-09-11 根据后续讨论继续修订。

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

因此 Validation / Policy 属于 cross-cutting governance。它既防止用户越界，也防止模型越界，还负责检查 schema、权限、统计口径和结果质量。

项目仍希望保留模型生成 SQL 的能力，因为固定模板难以覆盖复杂投球条件；相应地，SQL AST、只读权限、允许访问的表和路径、超时与结果规模必须由程序约束。

## PostgreSQL / DuckDB 是只读分析资源

数据库修改权限属于系统管理员，而不是业务用户。当前 Baseball Agent Runtime 中，PostgreSQL、DuckDB / Parquet 等本地分析资源应被视为 read-only resources。

用户不能通过对话授权 Agent 执行 `INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE` 等修改操作；这类请求属于 `BLOCKED_BY_POLICY`，而不是 `WAITING_FOR_USER`。DuckDB 还需要额外限制文件写入、任意 ATTACH、extension loading 等能力，不能只检查是否出现 DELETE 关键字。

因此需要明确区分：

```text
Question Authority → User
Execution Permission → User + Orchestrator policy
System Authority → System Administrator only
```

## 0 rows 只是一个执行观察

| 观察 | 可能原因 | 下一步 |
| --- | --- | --- |
| SQL 成功但 0 rows | 条件确实无匹配 | 核对覆盖与业务条件 |
| 对应赛季未加载 | 数据缺失 | 换源或标记 limitation |
| 球员匹配失败 | entity / canonical ID 错误 | 回到实体解析 |
| 资格门槛后无球员 | 样本不足或 qualification 不满足 | 明确规则与样本 |
| 查询报错 | SQL、权限或接口失败 | 按错误类型 retry / stop |

所以 ToolResult 必须把“执行是否成功”和“结果是否足以回答问题”分开。`retryable` 属于 Tool 层；`recoverable` 属于 Agent 层。

## Qualification 与 Sample Adequacy 必须分开

`qualification_rule` 决定谁有资格进入查询或排行榜；`sample_adequacy_rule` 判断现有样本是否足以支撑某种分析结论。两者不能混成一个 `minimum_sample_size`。

例如用户明确要求 `ALL_PLAYERS` 时，小样本球员可以合法进入结果，但 Validator / Judge 仍可把其样本标记为 LOW，并要求 Formatter 提醒用户不要把极小样本解释成稳定能力。

如果用户要求 MLB qualified players，则实际门槛应由 `QualificationRule` 和当前赛季上下文解析，而不是由 Planner 随手填写一个数字。

赛季进行中的 qualification 还依赖动态 League State。数据库最大日期只能说明本地数据同步到了哪里，不等于 MLB 实际赛季进度；权威赛程进度与本地 coverage 应分开记录。如果官方进度晚于本地数据，系统应识别为 ingestion lag，并在 temporal coverage / limitation 中反映。

## Artifact 本身与 Quality Assessment 分离

Artifact 尽量保存不可变的数据事实：descriptor、payload、provenance、lineage、created_at 等。质量不是 Artifact 的固有属性，因为同一份数据对不同 Objective / Requirement 的适用性可能不同。

因此：

```text
Artifact
= 数据事实

ArtifactAssessment
= 在特定 Objective / Requirement 下，这份数据是否可用

Artifact Registry
= 管理 Artifact、索引、lineage、lifecycle 和 assessment 引用
```

Artifact Registry 是管理者，不是裁判员。真正的质量判断由代码规则和 Judge Agent 完成，再把 Assessment 回写 Registry 的管理状态。

## Collected Data 不自动等于 Approved Data

新结果首先只是 Candidate Artifact。低样本、时间范围不完整、来源冲突、字段缺失或 Web claim 都不能因为“已经拿到了”就直接进入主 Agent 的事实上下文。

当前质量链路收敛为：

```text
Collected / Candidate Artifact
        ↓
Deterministic Validator
        ↓
Task / Requirement-specific Hard Gates
        ↓
Judge / Critic Agent
        ↓
ArtifactAssessment
        ↓
SATISFIED / PARTIAL / REJECTED
```

硬规则优先由代码执行，例如 schema validity、required data、时间覆盖、qualification rule、sample adequacy、null ratio 和确定性的 source policy。Judge Agent 不应覆盖硬规则。

ArtifactAssessment 应绑定 `artifact_id + requirement_id + objective_id`，因为同一个 Artifact 可能对一个 Requirement 足够，对另一个 Requirement 只适合弱结论。

## Judge Agent 只做语义质量评审

为了避免 Planner 一边规划一边给自己的数据打分，当前讨论倾向增加一个独立的 Data Quality Judge / Evidence Critic 子 Agent。

它只负责评价 collected data，例如：

- Web 报道是否真的支持某个 claim；
- 两个来源是否存在语义冲突；
- 某个小样本是否只能用于描述而不能用于强结论；
- 一篇文章是在报道事实，还是作者推测；
- 证据是否与当前 Objective / Requirement 相关。

Judge 输出使用离散等级，例如 `STRONG / ACCEPTABLE / WEAK / REJECT`，并附带 limitations、usable_for、rejection reason 等结构化说明。Judge 不决定下一步调用哪个 Tool，也不能直接把 Objective 标记 COMPLETE。

## Requirement 重要性来自语义，不由 Judge 决定

Artifact 的业务重要性来自它服务的 Requirement，而不是 Judge 自己决定。Requirement Decomposer 给出 `base_criticality`，表示该信息对于原始 Objective 的语义重要性；后续执行调度可以变化，但不能为了更容易完成任务而降低这个语义重要性。

因此同一个 Assessment 会和 Requirement criticality 一起进入 Objective 级别评估。

## Objective Sufficiency 先做 Hard Gate，再做加权覆盖

多个 Artifact 处理完后，系统应先对每个 Requirement 做满足度判断，再聚合成 ObjectiveAssessment。

不能简单平均所有数据质量。例如核心表现数据完全缺失，而球迷讨论、新闻背景都完整，简单平均可能看起来很高，但用户最重要的问题并没有回答。

更合理的方式是：

```text
Critical Requirement Hard Gate
        ↓
Weighted Requirement Coverage
        ↓
ObjectiveAssessment
```

CRITICAL Requirement 缺失时，Objective 不能因为大量 LOW/MEDIUM Requirement 已满足而直接 COMPLETE。在 hard gate 通过后，不同 Requirement 再根据重要性贡献不同权重，用于描述“完成得有多完整”。

`ObjectiveAssessment` 可以保存 requirement assessments、critical gaps、optional gaps、limitations、recoverable gaps 与 weighted coverage。

## COMPLETE 不等于所有信息完美齐全

ObjectiveState 当前倾向使用 `PENDING / IN_PROGRESS / COMPLETE / LIMITED / FAILED`。

`COMPLETE` 表示核心 Requirement 已经足够支撑回答，不代表所有 optional information 都存在。无法取得的可选信息放入 `optional_gaps`，会限制解释的因素放入 `limitations`，最终 Formatter 仍应反馈给用户。

`LIMITED` 表示核心问题没有充分满足、剩余缺口又不可恢复，但仍有有价值的受限信息可以报告；`FAILED` 则意味着连可靠的受限分析都无法形成。

## Re-plan 是选择性的，不是看到缺口就继续搜索

剩余 Requirement 是否需要新一轮 Planner，应综合：

- gap criticality；
- recoverability；
- current round / replan count；
- attempt history；
- remaining budget；
- 继续执行的 expected benefit。

例如 CRITICAL 且 recoverable 的缺口在早期轮次值得继续；LOW priority 缺口经过多轮换源仍未满足，则可以转成 optional gap，而不是无限循环。

Re-planning 不需要独立的第二个 Planner。Orchestrator 判断 **何时**进入 revise；同一个 Planning Agent 根据当前已完成内容、缺口和预算产生局部修改。

## Semantic Clarification 与 Execution Escalation 分开

如果不确定的是“用户到底想问什么”，应优先询问用户。用户自己也可能尚未形成明确需求，此时模型应给出少量合理选项和推荐项，让用户选择，而不是擅自固定问题含义。

如果问题已经明确，只是某个免费数据源不可用，Router 可以自主尝试其他允许的公开来源补充论点，不必频繁打断用户。只有剩余方案涉及付费 API、高成本执行或用户级特殊授权时，才进入 `WAITING_FOR_USER`。

因此可区分：

```text
Semantic Clarification → 必须询问用户
Free permitted source fallback → Agent 自主处理
Paid / high-cost source → 询问用户
System-admin-only action → BLOCKED_BY_POLICY
```

Sub-agent 不能自行升级权限，只能提交 permission request 给 Orchestrator。

## AgentState 与 LLM Context 必须分离

完整 Runtime State 可以保存 timeout、0 rows、失败 attempts、Candidate Artifact、Assessment 和旧计划，但这些内容不应全部进入主 LLM context。

Context Builder 只投影 validated artifacts、必要的 limited evidence、objective status、unresolved gaps 和当前需要模型做出的决定。这样可以减少低质量中间结果对 Planner 和 Formatter 的上下文污染。

## Formatter 只消费已经验证的分析结果

核心指标由查询或 Feature Engine 确定性计算。Formatter 负责说明结果、来源与限制，不在写作阶段临时重算另一套统计。

一份可信报告应能告诉用户：哪些 Objective 已完成、哪些只能 limited、哪些 optional gap 没有解决、缺失原因是什么，以及结论依赖哪些已批准证据。

**来源：** S1、S2、S3、S5。本文更新内容来自 2026-09-07 至 2026-09-11 当前架构讨论。
