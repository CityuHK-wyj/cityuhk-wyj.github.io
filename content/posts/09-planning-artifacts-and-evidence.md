# Task Planner 与证据质量：从数据依赖到分层 Agent 架构

这一轮讨论最重要的变化，不是再增加更多模块，而是把已有模块重新放到正确的位置：哪些属于一次请求的主执行链，哪些应该作为多个阶段共享的知识服务，哪些必须贯穿整个 Agent 生命周期。这样可以保留原有功能，同时避免把 RAG、Validation、AgentState 等横向能力误画成只执行一次的线性步骤。

**记录性质：** 以下是截至 2026-09-11 当前讨论确认的设计方向，尚不代表 Agent 仓库已经实现这些接口。

## 1. 架构分成三类，而不是一条超长流水线

### Main Agent Flow

```text
Conversation
    ↓
Semantic Understanding
    ↓
Analysis Objectives
    ↓
Task Planner / Re-planner
    ↓
Execution / Orchestrator
    ↓
Tool Router → PostgreSQL / DuckDB / Web/API
    ↓
Artifact / Evidence Processing
    ↓
Quality Approval
    ↓
Feature Engine + Result Analyzer
    ↓
Objective Sufficiency
    ↓
Re-plan OR Response
```

这是一次用户请求真正推进的纵向流程。

### Shared Knowledge Services

这些能力由多个模块按需调用，不属于某一个固定步骤：

- RAG Knowledge Base
- Metric Registry
- Schema Registry / Schema RAG
- Source Mapping
- Entity Dictionary

Metric Registry 负责稳定、确定性的执行知识；RAG 负责需要语义检索、会随语境或时代变化的领域知识。

### Runtime & Governance

这些能力贯穿整个 Agent：

- AgentState
- Artifact Store
- Checkpoint Store
- Validation / Policy
- Logging / Observability
- Retry / Budget Control

因此 `AgentState` 不是“一个处理节点”，Validation 也不是“SQL 前的一层”，而是跨阶段共享和治理能力。

## 2. Semantic Layer 负责拆 Objective

当前职责边界进一步明确：Semantic Understanding Layer 负责理解用户问题，并拆成一个或多个 `AnalysisObjective`。

棒球问题领域相对有限，可以用受控 `objective_type` 给出稳定边界，例如球员表现、球员上下文、伤病、球队表现、球队策略、交易、公众舆论、社区讨论、比较分析等；同时保留开放的 subtype 和 description，避免 Enum 过度限制 Agent 自主性。

`objective_type` 可以提供默认 `base_priority`，Planner 再结合用户强调程度、证据状态和执行成本调整 `effective_priority`。

## 3. Planner 负责 Requirement 和 Task

Planner 不再重新决定“用户到底想问什么”，而是围绕每个 Objective 设计：

- `ArtifactRequirement`
- `AgentTask`
- 数据依赖 / workflow dependency
- source strategy
- effective priority

因此 Task 只是满足 Objective 的手段。某个 Task 失败，不等于 Objective 失败；只要其他 Task 或数据源能满足同一个 Requirement，下游分析仍可继续。

## 4. Requirement 描述数据条件，而不是维护大量 artifact_id

单纯的 `depends_on=["t1"]` 太粗，而自由字符串如 `tucker_recent_data` 又容易漂移。

因此当前倾向让 `ArtifactRequirement` 使用固定 schema 描述：

- data_type
- entities
- time_range
- typed constraints
- required_data
- optional_data
- quality_requirements

系统再根据 Artifact metadata 判断已有数据是否 `SATISFIED`、`PARTIAL` 或 `MISSING`。不要求手工维护无限细分的 artifact taxonomy。

`depends_on` 仍保留，但主要表达纯 workflow dependency；真正的数据依赖由 Requirement 表达。

## 5. Plan、Execution、Attempt 分离

`AgentTask` 只回答“Planner 想做什么”；运行状态不直接写回原计划。

```text
AgentTask
= 计划定义

TaskExecution
= 任务总体执行状态

TaskAttempt
= 某一次真实尝试
```

每次 attempt 保留参数快照和 ToolResult。这样 timeout、重试、参数调整和最终成功都可以被审计，而不需要反复改写 Planner 最初生成的任务。

技术性失败如 timeout、connection reset 由 Executor 在原语义请求上 retry；`NO_DATA`、时间范围错误、数据源不覆盖、样本不足等语义性问题交给 Result Analyzer，再由 Planner re-plan。

## 6. Checkpoint 是 State Persistence，不是“每步都问 LLM”

Task 结果写入 `AgentState` 后可以形成 checkpoint，但 checkpoint 不等于每完成一个 task 就调用一次 LLM。

完整 System State 可以保存失败 attempts、Candidate Artifact、旧计划和执行日志；LLM Context View 只暴露与当前决策相关的有效信息，例如用户目标、当前 Objective、已批准 Artifact、未解决 Requirement 和需要模型做出的决策。

因此：

```text
System State ≠ LLM Context
```

这是减少上下文污染和不必要模型调用的核心原则。

## 7. Entity 与 Constraint 保持统一语义

球员不能依赖显示名做机器关联。`Hernandez`、`Will`、`Kyle` 等名称存在天然歧义，因此 Entity Resolver 应在 Planner 前解析 canonical entity，内部关联依赖 MLBAM ID 或其他稳定 ID。

Constraint 继续作为跨层统一的查询约束语言。`ArtifactRequirement` 的筛选条件不使用自由 dict，而复用 typed Constraint，使“95 mph 以上、高区、最近 30 天”等条件从 Semantic 到 SQL/API generation 保持一致。

Semantic Layer 可以根据上下文补充隐含 Constraint，但必须保留来源，区分用户明确要求与系统推断，便于后续覆盖或澄清。

## 8. Semantic Requirement 与 Physical Schema 分离

Planner 应描述 `exit_velocity`、`salary`、`injury_context` 等 semantic requirement，而不是直接依赖 PostgreSQL 的物理字段名。

确定性映射由 `MetricDefinition`、`SourceMapping`、Schema Registry 管理；Schema RAG 负责需要语义检索的字段说明、表关系和使用上下文。

Metric 层保持简单：

- `MetricDefinition`：指标是什么、单位、定义、时间有效性；
- `SourceMapping`：某个 source 如何提供该 metric，是 `DIRECT`、`CALCULATED` 或没有映射。

跨多个来源拼出完整答案的工作交给 Planner，而不是让 Metric Registry 变成另一个工作流引擎。

## 9. Web 保持宽松输入，Evidence Extractor 负责语义结构化

Web 无法像 PostgreSQL 一样预先声明完整 capability。Router 只决定“去哪里找”，不负责把文章转成数据库字段。

```text
Web Tool
  ↓
RawWebResult
  ↓
Evidence Extractor
  ↓
Structured Evidence
```

可安全标准化的内容可以映射到 semantic data；主观评价、报道和上下文则保留为带 provenance 的 Evidence / Claim，避免把一篇新闻强行压成一个布尔字段。

## 10. ToolResult 只描述工具事实

`0 rows` 不等于工具失败。ToolResult 应区分：

- execution success
- result status
- data / payload
- error type
- retryable
- source / provenance

`retryable` 属于工具层；`recoverable` 属于 Agent 层。某个本地 source 无法提供 salary，不代表 salary 整体不可恢复，因为 Planner 仍可换到 Spotrac 或 Web。

## 11. Collected Data 不自动等于 Approved Data

新结果首先进入 Candidate Artifact。低样本、来源冲突、部分时间覆盖和 Web claim 不应直接成为主 Agent 的事实输入。

当前质量链路为：

```text
Candidate Artifact
    ↓
Deterministic Validator
    ↓
Hard Gates
    ↓
Judge / Critic Agent
    ↓
ArtifactAssessment
    ↓
APPROVED / LIMITED / REJECTED
```

Code validation 负责硬规则；Judge Agent 负责语义质量评审，例如来源是否真正支持 claim、冲突是否显著、证据是否只适合描述性分析。

Judge 使用离散等级，例如 `STRONG / ACCEPTABLE / WEAK / REJECT`，而不是直接输出伪精确 confidence。Judge 不决定下一个 Tool，重规划仍属于 Planner。

## 12. Analysis Sufficiency 按 Objective 计算

单个 Artifact 达到质量要求，不代表整个用户问题已经完整。

Artifact 层评价 completeness、sample adequacy、temporal coverage、source reliability 等；Objective 层评价 requirement coverage、critical gaps、cross-artifact consistency 和 limitations。

因此之前的 confidence loop 收敛为 **Objective Sufficiency Loop**：

```text
O1 performance → COMPLETE
O2 injury      → LIMITED / recoverable
O3 salary      → IN_PROGRESS
```

Planner 只继续处理尚未满足且仍有 recoverable gap 的 Objective。已完成 Objective 可以冻结并复用。

如果某个缺口客观不可恢复，例如对应年代不存在指标、样本未达到 qualification threshold，则允许该 Objective 以 `LIMITED` 结束并向用户说明原因。

整个 Query 只需要粗粒度 `COMPLETE / PARTIAL / FAILED`。这使系统即使没解决所有子问题，也可以把已经可靠完成的部分呈现给用户。

## 13. Validation / Policy 贯穿始终

Validation 不应只存在于 SQL 前后。它横跨：

```text
Input → Semantic → Plan → Tool → Artifact → Report
```

包括用户输入边界、实体与 Constraint 合法性、Plan 检查、SQL 权限、ToolResult 校验、Artifact quality 和最终 claim/evidence consistency。

这也是为什么 Validation 属于 Runtime & Governance，而不是 Main Flow 中的一次性节点。

## 当前收敛出的原则

目前架构的核心不是“让更多步骤调用 LLM”，而是减少 LLM 不必要承担的职责：

- Semantic Layer 负责理解和拆 Objective；
- Planner 负责 Requirement、Task 与 source strategy；
- Executor 负责技术 retry；
- Tool 返回真实执行事实；
- Registry 提供确定性映射；
- RAG 提供可检索语义知识；
- Judge 只做数据 / 证据质量评审；
- Feature Engine 负责确定性计算；
- Result Analyzer + Sufficiency Engine 判断每个 Objective 是否足够；
- Context Builder 只把 Approved / 必要 Limited 信息送给主模型。

下一步应以这版结构作为总体架构基线，进入正式 Domain Modeling：明确 `AnalysisObjective → ObjectivePlan → ArtifactRequirement → AgentTask → TaskExecution → DataArtifact → ArtifactAssessment → ObjectiveState` 的所有权、状态迁移和数据契约，再进入 spec 与实现。

**来源：** S5，2026-09-07 至 2026-09-11 当前 Baseball Agent 架构讨论。
