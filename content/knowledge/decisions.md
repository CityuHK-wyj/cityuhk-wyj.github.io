# 决策与开放问题

整理日期：2026-09-17。ID 是本博客为后续引用新增的文档标识，不代表历史中已使用该编号。D001–D066 主要记录架构收敛；D067–D076 记录 v0.1 implementation / Shared Knowledge / release 前后边界；D077 起记录 v0.1 release、dogfooding、LLM-first v0.2 与 Artifact-Driven Runtime 新方向。历史决策保留，即使后来被新决策修订。

| ID | 状态 | 内容 | 依据 / 后续工作 |
| --- | --- | --- | --- |
| D001 | 讨论明确 | 保留原问题 raw_query 和已确认约束 | S1/S5；实现已由 S6 核验 |
| D002 | 历史方案，已由 D083 修订 | 允许模型写 SQL，并由程序校验 | S1/S6；后续架构收紧为 LLM 只产 analysis intent/IR，trusted SQL 由 deterministic compiler 生成 |
| D003 | 历史方案 | 热库、冷库、联网与姓名反查四工具 | S2；现 Runtime 已改为 capability/router/source-mapping 架构 |
| D004 | 已实现 | 实体歧义可向用户澄清，内部关联依赖 canonical ID | S5/S6；Clarification lifecycle 已持久化 |
| D005 | 已实现并由 D079 扩展 | 任务参数与结果采用标准类型 | S5/S6；新方向允许固定 envelope 内同时存在 typed structured fields 与 free-form text |
| D006 | 已实现 | Plan 与 Execution 分离：AgentTask 不直接承载运行状态 | S5/S6 |
| D007 | 已实现 | 保存每一次 TaskAttempt 历史，用于 retry、debug、evaluation 与恢复 | S5/S6；正常 LLM context 不直接包含完整历史 |
| D008 | 已实现 | 技术性错误由 Executor 重试，语义性失败进入评估与 Planning Loop | S5/S6 |
| D009 | 已实现 | 0 rows 与 tool failure 分离 | S5/S6；NO_DATA 与 TECHNICAL_FAILURE 分开 |
| D010 | 已实现并由 D080 扩展 | 数据及 ToolResult 记录来源 | S5/S6；新方向要求跨 Tool 保留 explicit Reference / lineage |
| D011 | 已实现 | retryable 属于 Tool 层，recoverable 属于 Agent 层 | S5/S6 |
| D012 | v0.1 已实现，后续放宽 | 任务的数据依赖优先用结构化 ArtifactRequirement 表达 | S5/S6；D078/D079 将 Planner cognition 改为 Need + flexible payload，严格结构化推迟到 action boundary |
| D013 | 用户约束，已重新解释 | 避免过细 artifact_id / 自由字符串命名体系 | S1/S5；保留稳定 envelope/refs，但允许 bounded free-form semantic payload |
| D014 | v0.1 已实现，后续放宽 | ArtifactRequirement 的过滤条件复用 typed Constraint，而非自由 dict | S5/S6；数据库执行仍严格，开放世界 Need 不再要求全部先变 typed Constraint |
| D015 | 已由 D082/D083 修订 | Planner 保持在 semantic level，physical schema 映射由 Registry / Schema 层处理 | 新方向允许 action compilation 阶段基于 trusted SchemaCatalog 收敛到真实字段名，但 LLM 仍不能生成 trusted arbitrary identifiers/SQL |
| D016 | 已实现并由 D081 扩展 | Web Router 只决定去哪里找；RawWebResult 由 Evidence Extractor 转结构化 Evidence | 新方向 Web Artifact 还需 claim-level grounding / evidence spans / refs，并可成为其它 Tool 输入 |
| D017 | 已实现 | AgentState 与 LLM Context View 分离 | S5/S6；Context projection 已有隔离测试 |
| D018 | 已实现并由 D088 扩展 | collected data 不自动等于 approved data，应经过 validation / quality gate | 同样适用于 runtime evidence 与 Shared Knowledge promotion |
| D019 | 已实现方向 | confidence 更接近 analysis sufficiency，不是模型正确概率 | S5/S6；新方向更强调 Goal coverage |
| D020 | 已实现，职责由 D084 修订 | Metric 层保持简单，核心为 MetricDefinition + SourceMapping | MetricRegistry 继续定义 canonical metric，但不能限制 ad-hoc derived analysis |
| D021 | 已实现 | SourceMapping 采用 DIRECT / CALCULATED / 无映射语义 | S5/S6；已进入 runtime routing |
| D022 | 已实现并修订表述 | Metric Registry 负责 execution correctness；Shared Knowledge/Retrieval 负责语义知识 | S5/S6；RAG/pgvector 尚未启用，不能把 Shared Knowledge 等同 RAG |
| D023 | v0.1 已实现，已由 D077 修订 | Semantic Understanding Layer 负责拆 AnalysisObjective；Planner 不重复解释用户意图 | Dogfooding 证明 semantic layer 不能成为 lossy terminal gate；Planner 后续应保留 raw query + partial understanding |
| D024 | 已实现 | Objective type 使用受控主类 + 开放 subtype/description | S5/S6 |
| D025 | 已实现方向 | Objective type 可提供 base priority，Planner 调整 execution priority | S5/S6 |
| D026 | 已实现 | Semantic Layer 可补充隐含 Constraint，但必须标记为系统推断 | S5/S6 |
| D027 | 已实现并由 D085 扩展 | 独立 Judge / Critic 评审 collected data，但不接管 Planner | 新方向 Judge 还需比较 requested_scope 与 actual_scope / Goal coverage |
| D028 | 已实现 | Judge 使用 STRONG / ACCEPTABLE / WEAK / REJECT 等离散等级 | S5/S6 |
| D029 | 已实现方向并由 D085 修订 | sufficiency 分 Artifact 与 Objective 两级；最终循环按 Objective 计算 | 新审计证明不能用“存在 Evidence”近似 Objective completion |
| D030 | 已实现方向 | 已完成 Objective 可冻结和复用，未完成部分继续处理；Query 允许 partial/limited 结果 | S5/S6 |
| D031 | 已实现 | 总体架构分 Main Agent Flow、Shared Knowledge Services、Runtime & Governance | S5/S6 |
| D032 | 已实现 | Validation / Policy 是 cross-cutting governance | S5/S6 |
| D033 | v0.1 已实现，后续演进 | 主流程为 Interaction、Normalization、Planning & Orchestration、Data & Tool、Evaluation & Sufficiency、Response 六层 | 新方向保留职责但 Runtime center 转向 Goal/Need/Artifact/Reference/Action |
| D034 | v0.1 已实现，后续弱化为兼容层 | Requirement Decomposer 在 Planner 前产生 semantic-atomic ArtifactRequirement | 新方向允许 Planner 动态建立 Need Graph，不要求所有 Needs 在规划前冻结 |
| D035 | 已实现 | Requirement 的 base_criticality 是稳定语义重要性 | S5/S6 |
| D036 | 已实现并由 D080 扩展 | ArtifactRequirement 与 Artifact 共用统一 ArtifactDescriptor / semantic keys | 新方向 Artifact 增加 reusable exports / refs / actual_scope |
| D037 | 已实现 | Feature Engine 的确定性结果进入统一 Artifact 体系并保留 lineage | S5/S6 |
| D038 | 已实现 | QualificationRule 与 SampleAdequacyRule 分离 | S5/S6 |
| D039 | 已实现方向 | official league progress 与 local ingestion coverage 分开 | S5/S6；live League State 仍可继续增强 |
| D040 | 已实现，后续由 D086 扩展 | Planner 给 source preference；Router 负责实际 source/tool selection | 新 Planner 不只是 Tool selector，而是 Artifact/Dataflow Planner |
| D041 | 已实现 | Orchestrator 是工作流管理者，不是领域专家 | S5/S6 |
| D042 | 已由 D061 修订 | 早期为 Orchestrator 决定 when to replan；现由 Planner 返回 PLAN / REPLAN / STOP_PLANNING | S5；保留演变历史 |
| D043 | 已实现 | Runtime State 拆成多个独立 State Domain，而不是 giant AgentState | S5/S6 |
| D044 | 已实现方向 | Local ownership + reviewed global transition | S5/S6 |
| D045 | 已实现并由 D087 修订 | Meaning ambiguity 必须 clarification，并提供少量选项 | 新方向只在 material ambiguity 且其它 evidence/tool 无法解决时才 WAITING_FOR_USER |
| D046 | 已实现 | 免费允许的 source fallback 可自主进行；付费 / 高成本 source 需要用户授权 | S5/S6；Permission 已 scoped/expiring/single-use |
| D047 | 已实现并加固 | PostgreSQL、DuckDB / Parquet 是只读资源；用户不能对话授权写入 | S5/S6；SQL/DuckDB guard 已做 bypass hardening |
| D048 | 已实现并由 D085 扩展 | Artifact quality 是绑定 Objective / Requirement 的 contextual ArtifactAssessment | 新方向还必须包含 scope/coverage 与 Claim support refs |
| D049 | 已实现方向并由 D085 扩展 | Objective Sufficiency 先做 Critical Requirement gate，再做 coverage | Generalization audit 证明 coverage 需要显式 requested_scope/actual_scope |
| D050 | 已实现 | Objective COMPLETE 可以保留 optional_gaps / limitations | S5/S6 |
| D051 | 已实现并审计 | Response Agent 只消费最终 accepted outputs | S5/S6；曾修复 cross-objective accepted-evidence leakage |
| D052 | 已实现并由 D080/D085 扩展 | Finalization 保留最终 Artifact、Evidence、provenance 与关键 Shared Knowledge | 新方向保留 Reference/lineage/Claim support graph |
| D053 | 已实现 | CompletionReport 是内部 finalization record；ResponsePackage 是回答投影 | S5/S6 |
| D054 | 已实现 | Checkpoint 是一致恢复坐标，不复制全部 Artifact / attempts | S5/S6 |
| D055 | 部分 live 验证 | Agent Runtime 使用独立 Control Plane；已有 SQLite dev + PostgreSQL implementation | Operational PostgreSQL production path 仍待完整 live 验证 |
| D056 | 已实现方向 | 大型 Artifact payload 放 Local/Object Storage；Redis 非 v0.1 必需 | S5/S6 |
| D057 | 已实现 | Retrieval 不设独立业务 Sub-agent，而是 Shared Knowledge & Context 的内部能力 | S5/S6 |
| D058 | 已实现 | ObjectiveState 与 RequirementState 从 Definition 创建时即存在 | S5/S6 |
| D059 | 已实现 | ArtifactAssessment 保存 refs、deterministic/Judge/final result 与 summary，不复制 payload | S5/S6 |
| D060 | 已实现并加固 | Hard deterministic failure 不可被 Judge 覆盖；soft signals 可上下文解释 | S5/S6 |
| D061 | 已实现并由 D086 扩展 | Planner 根据 RequirementState、Artifact、recoverability、round、budget、sources 决定 PLAN / REPLAN / STOP | 新方向 Planner 还要围绕 Need Graph 与 Artifact Graph 迭代 |
| D062 | v0.1 已实现，下一架构需重新界定 | Initial Requirements 不可修改；Planner 可加 supporting Requirement，但不能改 Completion semantics | 新 Need Graph 仍需保护 user Goal / explicit constraints，不要求所有 Need 初始冻结 |
| D063 | 已实现 | RequirementState 主要反馈 Planner；ObjectiveState 主要反馈 Orchestrator | S5/S6 |
| D064 | 已实现并由 D080 扩展 | Planner 默认看 Artifact index + Assessment summary，并通过 ContextService 按需展开 | 新方向优先 Artifact refs / exports / coverage，而不是只看 summary |
| D065 | 已实现并测试 | planner_terminal 在无外部变化时阻止 Orchestrator 重复调用 Planner | S5/S6 |
| D066 | 阶段完成 | 宏观架构 Architecture Freeze；后续 Domain Modeling → ADR → Spec → TDD / Implementation → Review | v0.1 已完成，但 dogfooding 触发新一轮 architecture revision |
| D067 | 已实现 | Shared Knowledge 使用持久化 Knowledge Store，不是硬编码 prompt，也不是 Retrieval Agent | S6；dev `.runtime/knowledge.db`，production 方向为 PostgreSQL `knowledge` schema |
| D068 | 已实现基础，治理由 D088–D091 扩展 | `Collected Knowledge != Active Knowledge`；知识 refresh 采用 fetch → validate → stage → activate / supersede | 新方向把 Runtime Evidence / CandidateKnowledge / ACTIVE Knowledge 明确分层 |
| D069 | 已确认并实现 | Shared Knowledge 的 truth source 是结构化 KnowledgeItem + provenance；RAG/embedding 只是未来可重建检索索引 | S6；pgvector 继续 deferred |
| D070 | 已实现 | EntityDictionary 与 MetricRegistry 可由 Shared Knowledge projection，减少双份 canonical truth | S6；Astra integration 已接入默认 composition |
| D071 | 已实现 | SyntheticDataTool 只允许显式 `--demo`，默认 Runtime 不得用 fake analytics 冒充真实 Evidence | S6；默认 pipeline integration tests 已覆盖 |
| D072 | 已实现 | Permission 必须 scoped、auditable、可过期且不可覆盖 SYSTEM_POLICY | S6 |
| D073 | 已实现 | USER_CONSTRAINT 的放宽通过 ConstraintRevisionRequest + WAITING_FOR_USER；接受后标为 USER_CONFIRMED | S6；SYSTEM_POLICY 不可协商 |
| D074 | 已实现 | Tool capability 不只按 artifact_type，还可按 `supported_data_keys` 限制 | S6；后续由 Artifact exports/accepts-provides capability 扩展 |
| D075 | 历史整合状态 | 产品整合线曾为 `astra/v0.1-integration` | S6；已由 D077 的 v0.1 release 状态覆盖 |
| D076 | 已解决 | 安全实现 history 与旧 main 无普通共同 ancestry；发布采用 reviewed-tree adoption 而非 unrelated-history merge | S7/S8；`main @ 35b47c4...`，`v0.1.0` 已存在 |
| D077 | 已发布/已核验 | v0.1.0 已通过单 parent adoption commit 安全进入 main；发布基线为 dual semantic runtime | S7/S8；main `35b47c4...`，tag `v0.1.0` |
| D078 | 已确认新方向，待实现 | Runtime center 从 SemanticCandidate / fixed Requirement pipeline 转为 Goal / Need / Artifact / Reference / Action | S7；下一实现线目标 |
| D079 | 已确认新方向，待实现 | 跨组件采用 fixed envelope + flexible payload + explicit references，不再要求所有 cognition 内容提前 enum 化 | S7；严格结构化推迟到 privileged action boundary |
| D080 | 已确认新方向，待实现 | Artifact 是 Tool-to-Tool 可复用的数据产品，带 structured_data/text/exports/provenance/references/actual_scope/lineage | S7；用于 Web↔DB↔Knowledge↔Compute dataflow |
| D081 | 已确认新方向，待实现 | Tool 没有固定方向；Web→SQL、SQL→Web、Knowledge→SQL、DB→Web→DB 等均由 Planner 基于 Artifact refs 动态组合 | S7；禁止 query-specific workflow hardcode |
| D082 | 已确认新方向，待实现 | Local analytics 引入 trusted SchemaCatalog，在执行前允许收敛到真实存在字段名、grain、type、relationship 与 allowed operations | S7 |
| D083 | 已确认新方向，待实现 | LLM 不直接产 trusted executable SQL；Analysis Need 先编译为 Safe Analytical IR，再由 deterministic compiler + guard + read-only DB 执行 | S7；修订 D002 |
| D084 | 已确认新方向，待实现 | MetricRegistry 只负责 canonical reusable metric，不限制 ad-hoc derived analysis；临时分析可组合 SchemaCatalog 字段和安全 expression tree | S7 |
| D085 | 已确认新方向，待实现 | requested_scope 与 actual_scope 必须分离；Sufficiency/COMPLETE 依据 Goal coverage，不得以“存在 Evidence”替代 | S7；直接回应 generalization audit P1 |
| D086 | 已确认新方向，待实现 | Planner 从 Tool selector 升级为 Artifact/Dataflow Planner，围绕 Need Graph 反复判断缺口、选 Tool、消费 Artifact、re-plan | S7 |
| D087 | 已确认新方向，待实现 | Clarification 是最后手段：低风险歧义可做 disclosed assumption；能通过其它 Tool/evidence 解决则先调查；material ambiguity 才 WAITING_FOR_USER | S7 |
| D088 | 已确认新方向，部分已有 v0.2 seam | Shared Knowledge 明确区分 Runtime Evidence、CandidateKnowledge、ACTIVE Approved Knowledge；Agent 不得直接把发现提升为 ACTIVE | S7；v0.2 已有 CandidateKnowledge CLI seam，下一架构需统一治理 |
| D089 | 已确认新方向，待实现 | Shared Knowledge 类型区分 canonical fact / alias / definition / historical event / rule / community reference / opinion / scouting 等 | S7；避免 contextual slang 污染全局 alias |
| D090 | 已确认新方向，待实现 | KnowledgeItem/CandidateKnowledge 需要 domain/language/locale-community/effective dates/authority/source refs/verification/conflict scope | S7 |
| D091 | 已确认新方向，待实现 | Shared Knowledge retrieval 产生普通 Knowledge Artifact 进入 Artifact Graph；Candidate promotion 走独立 admin review/write path | S7 |
| D092 | 已确认新方向，待实现 | 重要 Response Claim 应能引用 supporting Artifact / evidence span / structured field，Web search hit 不等于 supported claim | S7；回应 Web grounding audit |
| D093 | 已确认新方向，待实现 | Conversation 持久化 reusable semantic state / Goal / entity refs / scope selections / clarification / Artifact refs，follow-up 不靠已知短语特殊处理 | S7 |
| D094 | 已确认测试策略 | Known regression、independent holdout/substitution/paraphrase、real dogfooding 三层分离；Builder 不提前看到主要泛化验收题 | S7；防 evaluation leakage / shortcut |
| D095 | 已确认开发策略 | 下一大版本先产 `ARTIFACT_RUNTIME_IMPLEMENTED` checkpoint，再由独立 Codex generalization audit；不以旧 dogfooding examples 全绿作为 release 条件 | S7 |
| P001 | 部分实现 | 为 plan / execution 增加版本或快照机制 | Checkpoint/state version refs 已存在；并发/version策略仍可继续加固 |
| P002 | 已实现方向 | 设置 retry / replan / total-step 上限 | Runtime 有 max_rounds / budget / terminal latch；具体生产参数仍可调 |
| P003 | 已实现方向 | RequirementState 表达 satisfied / partial / unsatisfied 类语义 | 实际 enum/状态以代码为准；后续将被 Goal/Need coverage 体系吸收/适配 |
| P004 | 已实现 | Evidence 保留 RawWebResult 与 structured Evidence 两层 | S6；下一架构需增加 claim grounding / evidence span refs |
| P005 | 已实现 | Sub-agent Report 使用共享 envelope，专业结果通过 result refs 表达 | S6；可作为 fixed envelope/refactor 的历史基础 |
| O001 | 已解决 | Core Domain Contract 正式 schema | 已在 `app/models` 等落地并被测试覆盖 |
| O002 | 已解决/持续加固 | StateTransition、AgentReport、PlanningDecision、Checkpoint、ContextPackage 契约 | 已实现；新 runtime 会增加 Goal/Need/Reference/Artifact 契约 |
| O003 | 重新打开 | Requirement / Objective sufficiency 算法 | v0.1 已实现，但 generalization audit 证明完成判定仍需 scope-aware Goal coverage 重构 |
| O004 | 重新打开 | Planner / Router 与 Tool capability 的正式接口 | v0.1 已实现；下一阶段需升级 Artifact accepts/produces 与 dataflow planning |
| O005 | 部分解决 | Persistence 表结构、版本、retention / compaction | SQLite/PostgreSQL OperationalStore 与 checkpoint 已实现；conversation/Artifact Graph persistence 需扩展 |
| O006 | 已解决到 v0.1 / 继续演进 | Context retrieval / projection contract | bounded context 已有；新架构强调 refs 而非层层摘要 |
| O007 | 已解决到 v0.1 | QualificationRule / SampleAdequacyRule / LeagueStateSnapshot 契约 | 可继续复用 |
| O008 | 已解决到 v0.1 | Permission / Cost policy 与 Orchestrator escalation contract | scoped Permission + expiry + ConstraintRevision 已实现 |
| O009 | Deferred | LangGraph 引入时机 | 无真实必要前继续不引入 |
| O010 | 已在 v0.1 后续实现线 live 验证 | `baseball_analytics` PostgreSQL read-only E2E | S7 Stop Reports + S8 release state；具体 live 数据本次博客任务未重跑 |
| O011 | 已在 v0.1 后续实现线推进 | 2015–2023 Parquet schema 对齐与真实分析 | S7 Stop Reports；本次不重新执行数据任务 |
| O012 | v0.2 已实现 live Web seam，泛化/grounding 仍待重构 | Web research provider E2E | S8 核验 v0.2 commit；Codex report 指出 snippet grounding 问题 |
| O013 | 已解决 | v0.1 如何安全进入 main | reviewed-tree adoption 已完成，见 D076/D077 |
| O014 | Open | Safe Analytical IR 与 SchemaCatalog 的具体 schema / compiler contract | D082–D084；下一实现线 formalize |
| O015 | Open | Need Graph / Artifact Graph persistence、resume 与 cycle/budget semantics | D078/D080/D086 |
| O016 | Open | Shared Knowledge 新 lifecycle / conflict resolution / admin review 数据模型 | D088–D091 |

变更时保留旧决策并标记被哪个新决策替代。不要把 discussion direction、fake-tested、contract-tested、Stop Report claim 或 partial live probe 写成 repository/live verified，除非已有直接证据。
