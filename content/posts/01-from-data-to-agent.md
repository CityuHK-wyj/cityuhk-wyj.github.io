# 从棒球数据脚本，到能解释自己结论的 Agent

这份开发记录起于一个很具体的愿望：用自然语言问棒球问题，让系统找到数据、算出结果，再解释为什么值得相信。数据查询只是其中一环。真正困难的是，问题会跨越球员身份、统计口径、赛季、数据库和新闻，任何一环含糊，最终报告都可能看似专业却答错题。

**记录性质：** 项目讨论回顾；部分实现有历史代码可证，当前代码库未核验。本文最初整理于 2026-09-07，并在 2026-09-11 根据后续架构讨论修订。

## 一个贯穿设计的问题

项目反复使用的例子是：2025–2026 赛季，两好球之后，面对速度大于 95 mph、位于高区的快速球，击球初速最高的前五名打者是谁？再补充薪资，分析性价比。

这句话已经包含多个决策：两好球是投球前的 count 还是打席最终状态？高区如何定义？“最高”指单次最高还是平均最高？样本门槛按打席、击球事件还是具有有效 EV 的击球事件计算？薪资指哪个赛季的现金收入、合同年均值还是其他口径？

因此，目标逐渐从“让模型调用数据库”变成“让模型在明确约束下组织证据”。模型可以理解问题、提出计划、解释结果；可复现的计算和执行边界需要交给程序。

## 早期原型做到了什么

可访问的历史脚本注册了四个工具：`query_local_hot_db`、`query_local_cold_parquet`、`fetch_mlb_network_api` 和 `fetch_mlb_player_names`。它们分别查询 PostgreSQL、通过 DuckDB 读取 Parquet、获取联网赛季数据、把球员 ID 转成姓名。

主循环把工具清单交给模型，收到调用请求后执行，再把结果放回上下文。当模型不再发出工具调用时，程序直接输出最终回答。这证明当时已经存在多轮工具调用的原型代码，但不能证明每个查询都运行成功，也不能证明后续架构已落地。

原型暴露出的边界很清楚：业务规则大量堆在提示词里；SQL 直接送入执行器；联网结果提前截取前 15 行；停止条件主要由模型是否继续调用工具决定。这些问题不能仅靠再加一句“请严谨”解决。

## 当前架构不再被理解为一条超长流水线

后续讨论确认：有些模块是一次请求中的主流程节点，有些则应贯穿多个阶段。如果把 RAG、Registry、Validation、AgentState 都硬画成“第几步”，会错误暗示它们只在某一阶段发生一次。

因此当前架构分成三类。

### 1. 主执行链 Main Agent Flow

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

Semantic Understanding 负责把用户问题拆成 `AnalysisObjective`，例如球员表现、伤病背景、薪资价值、球队策略或社区舆论。Planner 不重新解释用户意图，而是围绕 Objective 设计 `ArtifactRequirement` 和 `AgentTask`。

### 2. Shared Knowledge Services

这些服务不是固定的一站，而是由多个模块按需调用：

- **Metric Registry**：保存 `MetricDefinition`、`SourceMapping` 等确定性执行知识；
- **Schema Registry / Schema RAG**：分别承担稳定 schema 映射与需要语义检索的 schema 说明；
- **RAG Knowledge Base**：保存指标解释、球探框架、战术趋势、caveat 和动态领域知识；
- **Entity Dictionary**：支持 canonical entity resolution，避免只靠球员姓名关联。

其中 Registry 追求 execution correctness，RAG 追求 semantic reasoning；两者不能互相替代。

### 3. Runtime & Governance

这部分贯穿整个 Agent 生命周期：

- `AgentState`：保存 objectives、plans、executions、attempt history、artifacts、gaps 和 budgets；
- `Artifact Store`：保存 Candidate、Approved、Limited、Rejected 等状态的结构化数据和证据；
- Checkpoint：持久化某一时刻的运行状态；
- Validation / Policy：横跨输入、计划、SQL、工具结果、Artifact 和最终回答；
- Logging / Observability / Retry / Budget：负责可恢复性、成本和调试。

因此 `AgentState`、Validation 和 RAG 都不再被画成线性“步骤”，而是共享或横切能力。

## 当前各层职责

| 区域 | 主要职责 | 典型对象 / 输出 |
| --- | --- | --- |
| Conversation | 保留原问题、多轮上下文与已确认约束 | raw_query, context |
| Semantic Understanding | 实体消歧、Constraint、Metric Concept、Objective 拆分 | QueryIntent, AnalysisObjective |
| Planning | 为 Objective 设计数据需求和可执行任务 | ArtifactRequirement, AgentTask |
| Execution | 依赖调度、工具调用、retry、checkpoint | TaskExecution, TaskAttempt, ToolResult |
| Evidence / Artifact | 将结构化数据和 Web 结果转成统一可评审资产 | DataArtifact, Evidence |
| Quality | Rule-first 校验 + Judge/Critic Agent 语义评审 | ArtifactAssessment |
| Analysis | 确定性计算、结果解释前的结构化分析 | FeatureResult, ObjectiveState |
| Response | 只消费筛选后的有效上下文并生成报告 | partial/full user report |

第一版仍可以是一个 Python 项目，不要求把这些边界部署成独立服务。

## 已形成的方向与尚未完成的工作

已形成的方向包括：保留 LLM 写 SQL 的能力但由程序验证；实体使用 canonical ID；Constraint 作为统一查询约束语言；Plan、Execution、Attempt 分离；技术错误自动 retry，语义问题 re-plan；Collected Data 不自动成为 Approved Data；Judge Agent 只评审证据质量，不接管 Planner；analysis sufficiency 按 Objective 计算，从而允许部分 Objective 已完成时生成 PARTIAL report。

正式的 Pydantic schema、checkpoint 持久化、Judge 评价接口、sufficiency 算法权重、Artifact Store 和 LangGraph 迁移仍未形成已实现证据。博客记录的是当前架构方向，不应把讨论中的类名或 JSON 示例视为最终接口。

接下来最有价值的进展，是把这套架构压缩成正式领域模型和状态迁移规则，再选择一个真实查询跑通最小闭环。

**来源：** S1、S2、S5。详见[来源与覆盖范围](../knowledge/sources.html)。
