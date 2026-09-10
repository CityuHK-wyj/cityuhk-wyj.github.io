# Baseball Agent 当前状态

更新时间：2026-09-10。此页是后续接手的首要上下文。范围为可访问讨论和资料，非当前 Agent 仓库审计。

## 目标

构建可解释、可验证的 MLB 数据分析 Agent：保留用户约束，跨 PostgreSQL、Parquet 与 Web 获取证据，通过程序计算指标，再生成带来源与限制的中文回答。

## 有证据的实现状态

- 历史脚本存在四工具注册与多轮调用循环：热库、冷库、联网赛季数据、姓名反查。未在本次执行这些代码。
- 用户曾报告已存入 2024–2026 Statcast 热数据，2015–2023 Parquet 历史数据，以及部分高阶指标。没有验证当前完整性与截止日。
- 2026-09 的项目讨论显示 Baseball Agent 已建立模块骨架与架构文档，但本博客仍未直接审计 Agent 仓库的当前业务实现。
- 博客仓库 `CityuHK-wyj/cityuhk-wyj.github.io` 已创建并获得写入授权；博客使用 Markdown 内容源、目录与机器可读状态，GitHub Pages 由仓库构建流程生成。

## 讨论中明确的方向

- 保留 `raw_query`，Intent 可多值，但 Intent 与 Tool 分离。
- Entity Resolver 在 Planner 前进行规范化，内部关联依赖 canonical ID，不依赖姓名唯一性。
- Constraint 作为跨 Query Understanding、Planner、ArtifactRequirement、SQL/API generation 的统一查询约束语言。
- Planner 尽量停留在 semantic level；确定性的 physical schema / metric mapping 交给 Registry，RAG 处理语义和动态知识。
- `AgentTask` 描述计划，`TaskExecution` 描述总体执行状态，`TaskAttempt` 保存每一次具体尝试；原始计划不因运行状态反复改写。
- timeout 等技术性失败由 Executor 按原参数 retry；`NO_DATA`、样本不足、数据源不覆盖等语义性问题交给 Result Analyzer，再由 Planner re-plan。
- Task 依赖优先表达为结构化 `ArtifactRequirement`，避免依赖自由字符串或维护过细 artifact_id 分类；`depends_on` 主要保留纯 workflow dependency。
- `0 rows` 不等于 Tool failure；`retryable` 属于工具层，`recoverable` 属于 Agent 全局层。
- ToolResult 记录工具级来源，具体数据 / Evidence 自己记录细粒度 provenance。
- Web Tool 可以返回宽松的 RawWebResult；Evidence Extractor 负责非结构化到结构化 Evidence，Router 只决定去哪里找。
- collected data 不自动进入主分析上下文；Candidate Artifact 经过 validation / quality gate 后再成为主要输入。
- `AgentState` 与 `LLM Context View` 分离，避免把失败尝试、低质量结果和已失效信息全部塞进模型上下文。
- confidence 更接近 analysis sufficiency，而非“模型正确概率”；仍有 recoverable gap 时继续循环，缺口客观不可恢复时允许 `LIMITED` 退出并解释原因。
- Metric 层保持简单：`MetricDefinition` 定义指标，`SourceMapping` 描述具体来源映射；状态优先使用 `DIRECT`、`CALCULATED` 与无映射。组合多个来源满足用户问题的工作由 Planner 完成。

不要求手工维护过细的 artifact_id 分类。博客中的 JSON / Pydantic 片段均是设计示例，不代表已批准应用接口。

## 尚未定稿

`ArtifactRequirement` / `DataArtifact` 正式 schema；quality requirements 的表达；Result Analyzer 的 analysis sufficiency 规则和阈值；Planner 如何消费 `MetricDefinition` 与 `SourceMapping`；checkpoint 的具体持久化实现；执行预算和最大 retry / replan / total step；Evidence validation；LangGraph 是否以及何时引入。

## 建议的下一步

继续先完成总体架构与领域模型，再落实现有讨论中的最小数据契约。优先把 Entity / Constraint / MetricDefinition / SourceMapping / AgentTask / TaskExecution / TaskAttempt / ToolResult / ArtifactRequirement 的职责边界定清，然后选择一个真实查询跑通最小闭环。不要为了框架完整性提前引入过多工作流基础设施。

## 本博客的状态

截至 2026-09-10 已登记 9 篇阶段性文章。第 9 篇记录 Task execution、artifact dependency、context pollution、Web Evidence、Metric Registry 与 RAG 的最新收敛结果。更新时继续同步本文、`decisions.md`、`project-state.json` 和来源登记。
