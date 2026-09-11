# 可靠的 Agent 循环：零行、错误与低置信度

项目偏好的工作顺序逐渐明确：先获取与 Objective 相关的数据，让程序和专门的质量评审节点判断这些数据是否足以进入主分析上下文；必要时补查其他来源，再根据 Objective 级别的证据充分度决定继续、部分回答或停止。

**记录性质：** 已讨论原则与当前工程设计方向；没有声称 Validator、Judge Agent 或 sufficiency engine 已实现。本文在 2026-09-11 根据后续讨论修订。

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

## 0 rows 只是一个执行观察

| 观察 | 可能原因 | 下一步 |
| --- | --- | --- |
| SQL 成功但 0 rows | 条件确实无匹配 | 核对覆盖与业务条件 |
| 对应赛季未加载 | 数据缺失 | 换源或标记 limitation |
| 球员匹配失败 | entity / canonical ID 错误 | 回到实体解析 |
| 资格门槛后无球员 | 样本不足 | 明确 qualification 规则 |
| 查询报错 | SQL、权限或接口失败 | 按错误类型 retry / stop |

所以 ToolResult 必须把“执行是否成功”和“结果是否足以回答问题”分开。`retryable` 属于 Tool 层；`recoverable` 属于 Agent 层。

## Collected Data 不自动等于 Approved Data

新结果首先只是 Candidate Artifact。低样本、时间范围不完整、来源冲突、字段缺失或 Web claim 都不能因为“已经拿到了”就直接进入主 Agent 的事实上下文。

当前质量链路收敛为：

```text
Collected / Candidate Artifact
        ↓
Deterministic Validator
        ↓
Hard Quality Gates
        ↓
Judge / Critic Agent
        ↓
ArtifactAssessment
        ↓
APPROVED / LIMITED / REJECTED
```

硬规则优先由代码执行，例如 schema validity、required field、时间覆盖、qualified threshold、null ratio 和确定性的 source policy。Judge Agent 不应覆盖硬规则。

## Judge Agent 只做语义质量评审

为了避免 Planner 一边规划一边给自己的数据打分，当前讨论倾向增加一个独立的 Data Quality Judge / Evidence Critic 子 Agent。

它只负责评价 collected data，例如：

- Web 报道是否真的支持某个 claim；
- 两个来源是否存在语义冲突；
- 某个小样本是否只能用于描述而不能用于强结论；
- 一篇文章是在报道事实，还是作者推测；
- 证据是否与当前 Objective 相关。

Judge 输出使用离散等级，而不是让模型随手给出 `0.73` 之类的伪精确分数。当前倾向为 `STRONG / ACCEPTABLE / WEAK / REJECT`，并附带 limitations、usable_for、rejection reason 等结构化说明。

Judge 不负责决定下一步调用哪个 Tool；它提供评审结果，是否继续搜、去哪里搜仍由 Planner / Re-planner 决定。

## Artifact Quality 与 Analysis Sufficiency 分层

单个 Artifact 质量高，不代表整个用户问题已经证据充分。

Artifact 层关注：

- completeness
- sample adequacy
- temporal coverage
- source reliability
- schema validity
- semantic relevance

而 Objective 层关注：

- requirement coverage
- critical gaps
- cross-artifact consistency
- evidence balance
- limitations
- recoverable gaps

因此 `analysis_sufficiency` 不再被理解为一个全局“模型正确概率”，而是每个 Objective 当前证据是否足以支持回答。

## Confidence Loop 收敛为 Objective Sufficiency Loop

用户问题可以被 Semantic Layer 拆成多个 Objective，例如：

```text
O1 performance_analysis
O2 injury_context
O3 salary_value
```

每个 Objective 独立得到：

```text
COMPLETE
LIMITED
IN_PROGRESS
FAILED
```

如果 O1 已经完整，而 O2 仍有可恢复缺口，Planner 只需要继续解决 O2；不应重新查询已经稳定完成的 O1。

如果某个缺口客观不可恢复，例如对应年代不存在某指标、样本始终未达到 qualification threshold，则允许 Objective 以 `LIMITED` 结束并明确原因，而不是因为 sufficiency 永远达不到阈值而无限循环。

整个 Query 只需要粗粒度的 `COMPLETE / PARTIAL / FAILED` 状态。即使某些 Objective 尚未解决，已经充分完成的部分也可以进入最终 PARTIAL report。

## Sufficiency 由代码计算，Judge 作为高权重语义信号

当前讨论倾向：Judge 使用离散质量等级，代码根据不同 Artifact 类型和 Objective Requirement 计算最终 sufficiency。

结构化统计数据可以让 code validation 权重更高；非结构化 Web Evidence 可以让 Judge 的语义质量判断占更大权重。但任何 hard gate 都不能被 Judge 的高评价抵消。

这使最终分数可以解释为“证据充分度”，而不是“LLM 自称有多少把握”。

## AgentState 与 LLM Context 必须分离

完整 AgentState 可以保存 timeout、0 rows、失败 attempts、Candidate Artifact 和旧计划，但这些内容不应全部进入主 LLM context。

Context Builder 只投影：

- validated / approved artifacts；
- 必要的 limited evidence；
- objective status；
- unresolved gaps；
- 当前需要模型做出的决定。

这样可以减少低质量中间结果对 Planner 和 Formatter 的上下文污染。

## Formatter 只消费已经验证的分析结果

核心指标由查询或 Feature Engine 确定性计算。Formatter 负责说明结果、来源与限制，不在写作阶段临时重算另一套统计。

一份可信报告应能告诉用户：哪些 Objective 已完成、哪些只能 limited、缺失原因是什么，以及结论依赖哪些已批准证据。

**来源：** S1、S2、S3、S5。本文更新内容来自 2026-09-07 至 2026-09-11 当前架构讨论。
