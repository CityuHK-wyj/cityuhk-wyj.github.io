# Task Planner 与证据质量：从数据依赖到分层 Agent 架构

这一轮讨论继续收敛了总体架构：不仅要区分 Main Flow、Shared Knowledge 与 Runtime/Governance，还要避免把每个功能模块都当成一个“大层”。多个模块虽然名字不同，本质上都在完成信息的标准化、计划拆分、执行协调或质量评估，因此更适合从更高层的职责组织系统。

**记录性质：** 以下是截至 2026-09-11 当前讨论确认的设计方向，尚不代表 Agent 仓库已经实现这些接口。

## 1. 六个大层 + 三组贯穿能力

当前主架构可以进一步压缩为六个大层：

```text
User
 ↓
① Interaction Layer
   Conversation / Context / Clarification
 ↓
② Normalization Layer
   Semantic / Entity / Constraint / Objective
   Evidence / Artifact / Metric transformation
 ↓
③ Planning & Orchestration Layer
   Requirement Decomposer
   Planning Agent
   Routing Agent
   Orchestrator / Executor
 ↓
④ Data & Tool Layer
   PostgreSQL / DuckDB / API / Web
 ↓
⑤ Evaluation & Sufficiency Layer
   Validator / Judge / ArtifactAssessment
   Requirement status / ObjectiveAssessment
 ↓
⑥ Response Layer
   Context Builder / Formatter
```

同时三类能力贯穿多个阶段：

### Shared Knowledge Services

- RAG Knowledge Base
- Metric Registry
- Schema Registry / Schema RAG
- Source Mapping
- Entity Dictionary
- League / Reference Context

### Runtime State

- Query / Objective / Planning / Routing / Execution State
- Artifact Registry / Assessment State
- Interaction / Permission / Budget State
- Checkpoint Store

### Governance

- Validation / Policy
- Logging / Observability
- Retry / Budget Control
- Read-only execution policy
- Permission / escalation policy

Architecture Layer 不等于 Python Package。`semantic/`、`evidence/`、`features/` 等代码模块可以独立存在，但从总体信息流看，它们可能同属于更大的 Normalization 或 Evaluation 能力。

## 2. Normalization 是多个模块共同承担的大职责

Semantic Understanding、Objective decomposition、Evidence extraction、Artifact processing 和 Feature Engine 看起来不同，但都在把不稳定、异构或难以直接使用的信息转换成系统内部统一、可验证、可继续计算的表示。

可以区分三类标准化：

```text
Semantic Normalization
自然语言 → canonical objective / entity / constraint

Evidence Normalization
heterogeneous Web / structured source → canonical artifact / evidence

Analytical Transformation
raw measurements → canonical metrics / features
```

Feature Engine 不只是“格式转换”，它还负责 deterministic computation，但其输出仍应回到统一 Artifact 体系，而不是产生另一套私有数据格式。

## 3. Objective、State 和 Clarification

Semantic Layer 负责拆 `AnalysisObjective`。Objective 使用受控主类 + 开放 subtype/description，在棒球有限领域内提供稳定边界，同时保留 Agent 对新问题的适应能力。

Definition 与 State 分离：

```text
AnalysisObjective
= 用户想解决什么

ObjectiveState
= 目前解决到什么程度
```

ObjectiveState 倾向使用 `PENDING / IN_PROGRESS / COMPLETE / LIMITED / FAILED`。`COMPLETE` 表示核心 Requirement 已足够回答，不要求所有 optional information 都齐全；缺失的可选信息进入 `optional_gaps`，影响结论的因素进入 `limitations`。

如果用户自己也不清楚需求，系统应生成少量合理 `ClarificationRequest` 选项并允许推荐一个方案，但问题含义最终由用户确认。改变问题语义的模糊性属于 Semantic Clarification，不应由 Agent 偷偷替用户决定。

## 4. Requirement Decomposer 是独立的窄职责 Sub-agent

Objective 不直接交给一个超级 Planner。当前倾向先使用 `Requirement Decomposer`，利用 Shared Knowledge Services 判断“为了回答这个 Objective，需要哪些逻辑完整的数据需求单元”。

```text
AnalysisObjective
      ↓
Requirement Decomposer
      ↓
ArtifactRequirement[]
      ↓
Planning Agent
```

它追求 semantic atomicity，而不是一指标一 Requirement。例如“近期击球质量 snapshot”可以包含多个 required/optional metric。

每个 Requirement 可带 `base_criticality`。它是 Requirement 对原始 Objective 的语义重要性，原则上近似 immutable。后续执行优先级可以因 round、budget、failure history 改变，但不能为了更容易结束而把 CRITICAL requirement 偷偷降级。

## 5. Requirement 和 Artifact 共用 ArtifactDescriptor

Requirement 表示“我要什么”，Artifact 表示“我已经有什么”。两者必须共享相同的 semantic contract，而不是各自使用不同 data_type 和字段命名。

当前倾向抽出：

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

`ArtifactType`、canonical Entity、typed Constraint 与 semantic data key 都在系统中共享。Requirement Matcher 可以因此做结构化比较，而不是依赖自由字符串 artifact name。

Artifact 本体尽量不可变，保存 descriptor、payload、provenance、lineage、created_at 等。Feature Engine 计算出来的 `Avg EV`、`HardHit%` 等结果也应成为新的 Metric/Feature Artifact，并通过 `derived_from` 指向原始 Artifact，形成 data lineage。

## 6. Qualification 与 Sample Adequacy 是不同问题

`qualification_rule` 决定谁能进入候选池；`sample_adequacy_rule` 决定现有样本是否足够支撑某类结论。

`ALL_PLAYERS` 可以允许极小样本球员进入排名，但 Judge / Result Analyzer 仍应把它标记为 low sample。`MLB_QUALIFIED` 的实际 threshold 不应由 Planner 随手填入，而应由领域规则结合动态 League State 解析。

赛季进行中的 qualification 依赖 MLB 实际进度，而数据库最新日期只代表 local data coverage。因此 League/Reference Context 需要区分 official season progress 与 ingestion coverage；二者不一致时应形成 temporal coverage limitation，而不是把本地数据截止日误当成联盟真实进度。

## 7. Planner 和 Router 是并列决策单元

Planning Agent 回答“这些 Requirement 应怎样转化成逻辑执行任务”；Routing Agent 回答“这个 Task 现在具体应该去哪里执行”。

Planner 可以给 source preference，例如优先本地、结构化、官方来源，但一般不硬绑定 Tool。Router 结合 SourceMapping、Schema Registry、freshness、cost、previous failures 和 available tools 产生 `RoutingDecision`。

```text
Planning Agent
“应该做什么？”

Routing Agent
“应该去哪做？”
```

Router 可以是 hybrid decision system：确定性规则能唯一决策时直接返回；多个来源都可行时再调用轻量模型。Preference 可以被 Router 因 freshness / availability 推翻，用户明确的 source constraint 与 Governance hard policy 不能被绕过。

## 8. Orchestrator 是办公室管理者

Orchestrator 不应成为另一个超级 Agent。它更像办公室管理者，只需要看到当前 Sub-agent、Task、Objective、权限、预算和阻塞状态，并及时协调工作。

它负责：

- 调度 ready work；
- 管理并行 / waiting / blocked；
- 分配执行权限与预算；
- 接收 Sub-agent Report / Decision；
- 审阅跨 Domain 状态变化；
- 判断何时调用 Planner revise mode；
- 判断何时询问用户；
- 判断何时结束。

它不指导 Sub-agent 具体怎样完成领域任务。

Re-planning 因此不是独立第二个 Agent。同一个 Planner 支持 `INITIAL_PLAN` 与 `REVISE_PLAN`；Orchestrator 判断 **when to replan**，Planner 判断 **what should change**，Router 判断 **where/how to execute**。

## 9. State 拆成多个 Domain，并保持统一设计思想

运行时不再倾向于一个巨大 `AgentState` dict，而是多个独立 State Domain：

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

这些 State Domain 应尽量遵守相同模式：Definition 与 State 分开；保存 ID / ref 而不是复制对象；记录 version、created_at、updated_at 和 transition reason；每个 Domain 只管理自己的职责。

Sub-agent 类似提交报告的员工：可以更新自己所属的 Local State，但不能直接修改其他 Domain 或全局状态。

```text
Sub-agent
   ↓
Local State update
   ↓
Report / Decision
   ↓
Orchestrator review
   ↓
Cross-domain State Transition
```

这形成 **Local ownership + reviewed global transition**，也更适合并行执行、checkpoint、恢复和未来可能的多 worker / LangGraph 实现。

## 10. Artifact Quality 是上下文相关的 Assessment

Artifact 本身不是 `quality = 0.8`。同一份最近 7 天、12 BBE 的数据可能足以回答“有没有打出 100 mph 球”，却不足以证明真实击球能力下降。

因此 ArtifactAssessment 应绑定具体 `artifact_id + requirement_id + objective_id`，由两部分共同形成：

```text
Deterministic Validation
        +
Judge / Critic Agent
        ↓
ArtifactAssessment
```

Artifact Registry 管理 Artifact、索引、lineage、lifecycle 和 assessment ref，但不自己充当质量裁判。

Judge 使用离散语义等级，例如 `STRONG / ACCEPTABLE / WEAK / REJECT`；Hard Gate 由代码控制，不能被 Judge 的高评价覆盖。

## 11. Objective Sufficiency = Critical Gate + Weighted Coverage

所有相关 Artifact / Requirement 完成一轮处理后，系统再做 Objective 级评估。

不能简单平均所有证据质量。核心表现数据缺失而背景新闻完整时，平均分可能仍很高，却没有回答核心问题。

因此当前倾向：

```text
Requirement Assessments
        ↓
Critical Requirement Hard Gate
        ↓
Weighted Requirement Coverage
        ↓
ObjectiveAssessment
```

不同 Requirement 因 `base_criticality` 不同，对整体完整度有不同贡献。Hard Gate 决定“是否足够回答核心问题”；加权覆盖决定“整体完成得多完整”。

`COMPLETE` 可以保留 optional gaps / limitations；`LIMITED` 表示核心问题证据仍不足且不可恢复，但存在可报告的受限信息；`FAILED` 表示无法形成可靠分析。

## 12. Selective Re-plan 考虑轮数与边际收益

剩余 gap 不会自动触发无限搜索。Orchestrator / Objective Evaluator 应综合：

```text
gap criticality
recoverability
current round
attempt history
remaining budget
expected benefit
```

早期 CRITICAL + recoverable gap 值得 re-plan；LOW gap 经多轮尝试仍缺失时可以转成 optional gap。已完成 Objective / Requirement 与有效 Artifact 应冻结和复用，不应因为局部失败重新跑整个计划。

因此之前的 confidence loop 已收敛为：

```text
Artifact Assessment
        ↓
Requirement Satisfaction
        ↓
Objective Sufficiency
        ↓
Selective Re-planning
```

## 13. 权限与升级：问题含义优先问用户，执行手段尽量自主

当前边界明确为三类：

```text
Semantic Clarification
→ 必须询问用户

Execution Escalation
→ 免费、允许的数据源可自主 fallback
→ 付费 / 高成本时询问用户

System Permission Boundary
→ 系统管理员权限，用户也不能授权
```

用户自己不明确需求时，模型应提供可选择的解释，而不是强行决定。问题明确后，如果免费本地或公开来源不足，Router 可以自主使用其他允许来源补充论点；只有付费 API、高成本调用或用户级特殊授权才需要 Orchestrator 升级给用户。

PostgreSQL、DuckDB / Parquet 在当前 Runtime 中是只读分析资源。写数据库、改 Parquet、危险文件操作等属于 System Administrator 权限，不因用户一句“允许”而开放。

## 14. System State 仍然不等于 LLM Context

完整 Runtime State 可以保存所有 attempt、routing decision、candidate artifact、assessment、permission request 和旧计划；LLM Context Builder 只投影当前决策真正需要的信息。

因此：

```text
System State ≠ LLM Context
```

这是避免上下文污染、降低模型成本并保持恢复能力的重要原则。

## 当前总体原则

目前架构越来越接近一个“多个窄职责员工 + 管理者 + 共享知识/治理”的系统，而不是一个无所不能的超级 Planner：

- Semantic / Requirement Decomposer 负责理解与需求拆分；
- Planner 负责逻辑执行策略；
- Router 负责 source/tool routing；
- Executor 负责确定性执行与技术 retry；
- Normalization 把异构结果统一成 Artifact；
- Validator + Judge 负责上下文相关的 ArtifactAssessment；
- Objective Evaluator 负责 critical gate、weighted sufficiency 与 gaps；
- Orchestrator 负责状态协调、权限、replan timing 和用户升级；
- Shared Knowledge 为多个 Sub-agent 提供 Registry / RAG / Reference Context；
- Governance 负责不可绕过的安全与只读边界。

下一步 Domain Modeling 应继续围绕统一 `ArtifactDescriptor`、`ArtifactRequirement`、`Artifact`、`ArtifactAssessment`、多个 State Domain、Sub-agent Report / Decision Contract 和 Orchestrator transition policy 收敛，而不是再增加新的大层。

**来源：** S5，2026-09-07 至 2026-09-11 当前 Baseball Agent 架构讨论。
