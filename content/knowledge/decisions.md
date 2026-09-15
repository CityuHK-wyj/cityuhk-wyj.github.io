# 决策与开放问题

整理日期：2026-09-15。ID 是本博客为后续引用新增的文档标识，不代表历史中已使用该编号。D001–D066 主要记录架构收敛；D067 起记录实现、审计与 v0.1 integration 阶段确认的新边界。实现状态优先依据 S6 的 GitHub 仓库直接审计。

| ID | 状态 | 内容 | 依据 / 后续工作 |
| --- | --- | --- | --- |
| D001 | 讨论明确 | 保留原问题 raw_query 和已确认约束 | S1/S5；实现已由 S6 核验 |
| D002 | 已实现 | 允许模型写 SQL，并由程序校验 | S1/S6；SQL AST/read-only guard 已实现并做 adversarial tests |
| D003 | 历史方案 | 热库、冷库、联网与姓名反查四工具 | S2；现 Runtime 已改为 capability/router/source-mapping 架构 |
| D004 | 已实现 | 实体歧义可向用户澄清，内部关联依赖 canonical ID | S5/S6；Clarification lifecycle 已持久化 |
| D005 | 已实现 | 任务参数与结果采用标准类型 | S5/S6；Domain contracts 已落地 |
| D006 | 已实现 | Plan 与 Execution 分离：AgentTask 不直接承载运行状态 | S5/S6 |
| D007 | 已实现 | 保存每一次 TaskAttempt 历史，用于 retry、debug、evaluation 与恢复 | S5/S6；正常 LLM context 不直接包含完整历史 |
| D008 | 已实现 | 技术性错误由 Executor 重试，语义性失败进入评估与 Planning Loop | S5/S6 |
| D009 | 已实现 | 0 rows 与 tool failure 分离 | S5/S6；NO_DATA 与 TECHNICAL_FAILURE 分开 |
| D010 | 已实现 | 数据及 ToolResult 记录来源 | S5/S6；Artifact/Evidence 保留 provenance |
| D011 | 已实现 | retryable 属于 Tool 层，recoverable 属于 Agent 层 | S5/S6 |
| D012 | 已实现 | 任务的数据依赖优先用结构化 ArtifactRequirement 表达 | S5/S6 |
| D013 | 用户约束 | 避免过细 artifact_id / 自由字符串命名体系 | S1/S5；继续作为维护约束 |
| D014 | 已实现 | ArtifactRequirement 的过滤条件复用 typed Constraint，而非自由 dict | S5/S6 |
| D015 | 已实现 | Planner 保持在 semantic level，physical schema 映射由 Registry / Schema 层处理 | S5/S6 |
| D016 | 已实现 | Web Router 只决定去哪里找；RawWebResult 由 Evidence Extractor 转结构化 Evidence | S5/S6 |
| D017 | 已实现 | AgentState 与 LLM Context View 分离 | S5/S6；Context projection 已有隔离测试 |
| D018 | 已实现 | collected data 不自动等于 approved data，应经过 validation / quality gate | S5/S6 |
| D019 | 已实现方向 | confidence 更接近 analysis sufficiency，不是模型正确概率 | S5/S6；仍保持离散/可解释结果 |
| D020 | 已实现 | Metric 层保持简单，核心为 MetricDefinition + SourceMapping | S5/S6 |
| D021 | 已实现 | SourceMapping 采用 DIRECT / CALCULATED / 无映射语义 | S5/S6；已进入 runtime routing |
| D022 | 已实现并修订表述 | Metric Registry 负责 execution correctness；Shared Knowledge/Retrieval 负责语义知识 | S5/S6；RAG/pgvector 尚未启用，不能把 Shared Knowledge 等同 RAG |
| D023 | 已实现 | Semantic Understanding Layer 负责拆 AnalysisObjective；Planner 不重复解释用户意图 | S5/S6 |
| D024 | 已实现 | Objective type 使用受控主类 + 开放 subtype/description | S5/S6 |
| D025 | 已实现方向 | Objective type 可提供 base priority，Planner 调整 execution priority | S5/S6 |
| D026 | 已实现 | Semantic Layer 可补充隐含 Constraint，但必须标记为系统推断 | S5/S6 |
| D027 | 已实现 | 独立 Judge / Critic 评审 collected data，但不接管 Planner | S5/S6 |
| D028 | 已实现 | Judge 使用 STRONG / ACCEPTABLE / WEAK / REJECT 等离散等级 | S5/S6 |
| D029 | 已实现方向 | sufficiency 分 Artifact 与 Objective 两级；最终循环按 Objective 计算 | S5/S6 |
| D030 | 已实现方向 | 已完成 Objective 可冻结和复用，未完成部分继续处理；Query 允许 partial/limited 结果 | S5/S6 |
| D031 | 已实现 | 总体架构分 Main Agent Flow、Shared Knowledge Services、Runtime & Governance | S5/S6 |
| D032 | 已实现 | Validation / Policy 是 cross-cutting governance | S5/S6 |
| D033 | 已实现 | 主流程为 Interaction、Normalization、Planning & Orchestration、Data & Tool、Evaluation & Sufficiency、Response 六层 | S5/S6 |
| D034 | 已实现 | Requirement Decomposer 在 Planner 前产生 semantic-atomic ArtifactRequirement | S5/S6 |
| D035 | 已实现 | Requirement 的 base_criticality 是稳定语义重要性 | S5/S6 |
| D036 | 已实现 | ArtifactRequirement 与 Artifact 共用统一 ArtifactDescriptor / semantic keys | S5/S6 |
| D037 | 已实现 | Feature Engine 的确定性结果进入统一 Artifact 体系并保留 lineage | S5/S6 |
| D038 | 已实现 | QualificationRule 与 SampleAdequacyRule 分离 | S5/S6 |
| D039 | 已实现方向 | official league progress 与 local ingestion coverage 分开 | S5/S6；live League State 仍可继续增强 |
| D040 | 已实现 | Planner 给 source preference；Router 负责实际 source/tool selection | S5/S6 |
| D041 | 已实现 | Orchestrator 是工作流管理者，不是领域专家 | S5/S6 |
| D042 | 已由 D061 修订 | 早期为 Orchestrator 决定 when to replan；现由 Planner 返回 PLAN / REPLAN / STOP_PLANNING | S5；保留演变历史 |
| D043 | 已实现 | Runtime State 拆成多个独立 State Domain，而不是 giant AgentState | S5/S6 |
| D044 | 已实现方向 | Local ownership + reviewed global transition | S5/S6 |
| D045 | 已实现 | Meaning ambiguity 必须 clarification，并提供少量选项 | S5/S6；支持 WAITING_FOR_USER checkpoint/resume |
| D046 | 已实现 | 免费允许的 source fallback 可自主进行；付费 / 高成本 source 需要用户授权 | S5/S6；Permission 已 scoped/expiring/single-use |
| D047 | 已实现并加固 | PostgreSQL、DuckDB / Parquet 是只读资源；用户不能对话授权写入 | S5/S6；SQL/DuckDB guard 已做 bypass hardening |
| D048 | 已实现 | Artifact quality 是绑定 Objective / Requirement 的 contextual ArtifactAssessment | S5/S6 |
| D049 | 已实现方向 | Objective Sufficiency 先做 Critical Requirement gate，再做 coverage | S5/S6；避免 optional 证据平均掉核心缺口 |
| D050 | 已实现 | Objective COMPLETE 可以保留 optional_gaps / limitations | S5/S6 |
| D051 | 已实现并审计 | Response Agent 只消费最终 accepted outputs | S5/S6；曾修复 cross-objective accepted-evidence leakage |
| D052 | 已实现 | Finalization 保留最终 Artifact、Evidence、provenance 与关键 Shared Knowledge | S5/S6 |
| D053 | 已实现 | CompletionReport 是内部 finalization record；ResponsePackage 是回答投影 | S5/S6 |
| D054 | 已实现 | Checkpoint 是一致恢复坐标，不复制全部 Artifact / attempts | S5/S6 |
| D055 | 部分 live 验证 | Agent Runtime 使用独立 Control Plane；已有 SQLite dev + PostgreSQL implementation | S5/S6；Operational PostgreSQL production path 尚待完整 live 验证 |
| D056 | 已实现方向 | 大型 Artifact payload 放 Local/Object Storage；Redis 非 v0.1 必需 | S5/S6 |
| D057 | 已实现 | Retrieval 不设独立业务 Sub-agent，而是 Shared Knowledge & Context 的内部能力 | S5/S6 |
| D058 | 已实现 | ObjectiveState 与 RequirementState 从 Definition 创建时即存在 | S5/S6 |
| D059 | 已实现 | ArtifactAssessment 保存 refs、deterministic/Judge/final result 与 summary，不复制 payload | S5/S6 |
| D060 | 已实现并加固 | Hard deterministic failure 不可被 Judge 覆盖；soft signals 可上下文解释 | S5/S6 |
| D061 | 已实现 | Planner 根据 RequirementState、Artifact、recoverability、round、budget、sources 决定 PLAN / REPLAN / STOP | S5/S6 |
| D062 | 已实现并审计 | Initial Requirements 不可修改；Planner 可加 supporting Requirement，但不能改 Completion semantics | S5/S6 |
| D063 | 已实现 | RequirementState 主要反馈 Planner；ObjectiveState 主要反馈 Orchestrator | S5/S6 |
| D064 | 已实现 | Planner 默认看 Artifact index + Assessment summary，并通过 ContextService 按需展开 | S5/S6 |
| D065 | 已实现并测试 | planner_terminal 在无外部变化时阻止 Orchestrator 重复调用 Planner | S5/S6 |
| D066 | 阶段完成 | 宏观架构 Architecture Freeze；后续 Domain Modeling → ADR → Spec → TDD / Implementation → Review | S5；该流程已实际进入 implementation/integration |
| D067 | 已实现 | Shared Knowledge 使用持久化 Knowledge Store，不是硬编码 prompt，也不是 Retrieval Agent | S6；dev `.runtime/knowledge.db`，production 方向为 PostgreSQL `knowledge` schema |
| D068 | 已实现 | `Collected Knowledge != Active Knowledge`；知识 refresh 采用 fetch → validate → stage → activate / supersede | S6；用于 rules/community/source freshness |
| D069 | 已确认并实现 | Shared Knowledge 的 truth source 是结构化 KnowledgeItem + provenance；RAG/embedding 只是未来可重建检索索引 | S6；pgvector 继续 deferred |
| D070 | 已实现 | EntityDictionary 与 MetricRegistry 可由 Shared Knowledge projection，减少双份 canonical truth | S6；Astra integration 已接入默认 composition |
| D071 | 已实现 | SyntheticDataTool 只允许显式 `--demo`，默认 Runtime 不得用 fake analytics 冒充真实 Evidence | S6；默认 pipeline integration tests 已覆盖 |
| D072 | 已实现 | Permission 必须 scoped、auditable、可过期且不可覆盖 SYSTEM_POLICY | S6；一个 paid tool 的批准不能授权其他 tool |
| D073 | 已实现 | USER_CONSTRAINT 的放宽通过 ConstraintRevisionRequest + WAITING_FOR_USER；接受后标为 USER_CONFIRMED | S6；SYSTEM_POLICY 不可协商 |
| D074 | 已实现 | Tool capability 不只按 artifact_type，还可按 `supported_data_keys` 限制，避免通用 Evidence source 抢走不支持的动态 Requirement | S6；Astra integration hardening |
| D075 | 已确认 | 当前产品整合线为 `astra/v0.1-integration`，由 hardened runtime 与 Shared Knowledge 真实 Git merge 合成 | S6；后续 final review 在此基础上继续 |
| D076 | 待 release 确认 | 安全实现 history 与旧 main 无普通共同 ancestry；最终发布倾向 reviewed v0.1 snapshot / explicit release integration，而非草率 fast-forward | S6；最终发布前再审计一次 Git ancestry 与 secret safety |
| P001 | 部分实现 | 为 plan / execution 增加版本或快照机制 | Checkpoint/state version refs 已存在；并发/version策略仍可继续加固 |
| P002 | 已实现方向 | 设置 retry / replan / total-step 上限 | Runtime 有 max_rounds / budget / terminal latch；具体生产参数仍可调 |
| P003 | 已实现方向 | RequirementState 表达 satisfied / partial / unsatisfied 类语义 | S6；实际 enum/状态以代码为准 |
| P004 | 已实现 | Evidence 保留 RawWebResult 与 structured Evidence 两层 | S6 |
| P005 | 已实现 | Sub-agent Report 使用共享 envelope，专业结果通过 result refs 表达 | S6；AgentReport 已落地 |
| O001 | 已解决 | Core Domain Contract 正式 schema | 已在 `app/models` 等落地并被测试覆盖 |
| O002 | 已解决/持续加固 | StateTransition、AgentReport、PlanningDecision、Checkpoint、ContextPackage 契约 | 已实现；并发/version semantics 仍可继续审计 |
| O003 | 已解决到 v0.1 | Requirement / Objective 状态更新与 sufficiency 算法 | deterministic services 已实现；未来可基于真实场景调整权重策略 |
| O004 | 已解决 | Planner / Router 与 Registry / Context Service 的正式接口 | 已进入 Runtime，SourceMapping 与 Context projection 已有 integration tests |
| O005 | 部分解决 | Persistence 表结构、版本、retention / compaction | SQLite/PostgreSQL OperationalStore 与 checkpoint 已实现；production retention/compaction 仍 deferred |
| O006 | 已解决到 v0.1 | Context retrieval / projection contract | 已有 ContextRequest/ContextPackage、run/objective isolation 与 bounded knowledge projection；semantic vector retrieval deferred |
| O007 | 已解决到 v0.1 | QualificationRule / SampleAdequacyRule / LeagueStateSnapshot 契约 | 已有实现；live league/context coverage 可继续增强 |
| O008 | 已解决到 v0.1 | Permission / Cost policy 与 Orchestrator escalation contract | scoped Permission + expiry + ConstraintRevision lifecycle 已实现 |
| O009 | Deferred | LangGraph 引入时机 | 当前自研可测试状态机已成形；无真实必要前不引入 |
| O010 | 待验证 | 真实 `baseball_analytics` PostgreSQL read-only E2E | 最近 probe 不可用；不能把 contract tests 当 live validation |
| O011 | 待验证 | 2015–2023 Parquet schema 与 SchemaRegistry / Feature Engine 的完整对齐 | bounded read 已成功，但复杂 high-zone query 暴露历史字段缺口 |
| O012 | 待验证 | WebEvidenceTool 的真实 provider E2E | MLB Stats API transport 曾成功，但网络 timeout 使完整链路仍为 partial |
| O013 | 待 release | v0.1 如何安全进入 main | 需处理 unrelated safe history，并在 final review 后选择 release integration 方式 |

变更时保留旧决策并标记被哪个新决策替代。不要把 fake-tested、contract-tested 或 partial live probe 写成 production verified。
