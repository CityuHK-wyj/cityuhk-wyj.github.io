# 决策与开放问题

整理日期：2026-09-11。ID 是本博客为后续引用新增的文档标识，不代表历史中已使用该编号。

| ID | 状态 | 内容 | 依据 / 后续工作 |
| --- | --- | --- | --- |
| D001 | 讨论明确 | 保留原问题 raw_query 和已确认约束 | S1；防止多轮丢失条件 |
| D002 | 讨论明确 | 允许模型写 SQL，并由程序校验 | S1；验证器尚无实现证据 |
| D003 | 历史代码可见 | 热库、冷库、联网与姓名反查四工具 | S2；当前 Agent 仓库未核验 |
| D004 | 讨论明确 | 实体歧义可向用户澄清，内部关联依赖 canonical ID | S1/S5；姓名只作为显示与解析输入 |
| D005 | 讨论明确 | 任务参数与结果采用标准类型 | S1/S5；具体 schema 仍待定 |
| D006 | 讨论明确 | Plan 与 Execution 分离：AgentTask 不直接承载运行状态 | S5；TaskExecution / TaskAttempt 保存实际执行 |
| D007 | 讨论明确 | 保存每一次 TaskAttempt 历史，用于 retry、debug、evaluation 与恢复 | S5；正常 LLM context 不直接包含完整历史 |
| D008 | 讨论明确 | 技术性错误由 Executor 重试，语义性失败由 Result Analyzer + Planner re-plan | S5；需定义错误分类和预算 |
| D009 | 讨论明确 | 0 rows 与 tool failure 分离 | S1/S5；业务意义由 Result Analyzer 判断 |
| D010 | 讨论明确 | 数据及 ToolResult 记录来源 | S1/S5；工具级 provenance 与数据级 provenance 同时保留 |
| D011 | 讨论明确 | retryable 属于 Tool 层，recoverable 属于 Agent 层 | S5；避免把换源能力混进工具错误状态 |
| D012 | 讨论明确 | 任务的数据依赖优先用结构化 ArtifactRequirement 表达 | S5；depends_on 主要保留纯 workflow dependency |
| D013 | 用户约束 | 避免过细 artifact_id / 自由字符串命名体系 | S1/S5；schema 固定、实例动态 |
| D014 | 讨论明确 | ArtifactRequirement 的过滤条件复用 typed Constraint，而非自由 dict | S5；统一语义并减少字段漂移 |
| D015 | 讨论明确 | Planner 保持在 semantic level，physical schema 映射由 Registry / Schema 层处理 | S5；避免 Planner 与具体数据源耦合 |
| D016 | 讨论明确 | Web Router 只决定去哪里找；RawWebResult 由 Evidence Extractor 做非结构化到结构化转换 | S5；数据库事实与外部 claim 保持证据类型差异 |
| D017 | 讨论明确 | AgentState 与 LLM Context View 分离 | S5；只把经筛选的有效状态送入模型，降低上下文污染 |
| D018 | 讨论明确 | collected data 不自动等于 approved data，应经过 validation / quality gate | S5；Candidate → APPROVED / LIMITED / REJECTED |
| D019 | 讨论明确 | confidence 更接近 analysis sufficiency，不是模型正确概率 | S5；仍有 recoverable gap 时继续循环，无可恢复缺口时可 LIMITED 退出 |
| D020 | 讨论明确 | Metric 层保持简单，核心为 MetricDefinition + SourceMapping | S5；组合多个来源满足需求的工作交给 Planner |
| D021 | 讨论明确 | SourceMapping 采用 DIRECT / CALCULATED / 无映射的简化语义 | S5；CALCULATED 表示 Feature Engine 可确定性计算 |
| D022 | 讨论明确 | Metric Registry 负责 execution correctness，RAG 负责 semantic reasoning 与动态知识 | S5；不把确定性字段映射完全交给向量检索 |
| D023 | 讨论明确 | Semantic Understanding Layer 负责拆 AnalysisObjective；Planner 负责 Requirement 与 Task | S5；避免 Planner 重复解释用户意图 |
| D024 | 讨论明确 | Objective type 使用受控主类 + 开放 subtype/description | S5；既提供稳定边界，又避免 Enum 过度限制自主性 |
| D025 | 讨论明确 | Objective type 可提供 base priority，Planner 调整 effective priority | S5；Router 只据此调整执行策略，不改业务优先级 |
| D026 | 讨论明确 | Semantic Layer 可补充隐含 Constraint，但必须标记为系统推断 | S5；用户明确约束优先且可覆盖推断 |
| D027 | 讨论明确 | 增加独立 Judge / Critic Agent 评审 collected data，但不接管 Planner | S5；Rule first, LLM second |
| D028 | 讨论明确 | Judge 使用离散质量等级而非伪精确连续 confidence | S5；倾向 STRONG / ACCEPTABLE / WEAK / REJECT，并附理由 |
| D029 | 讨论明确 | sufficiency 分 Artifact 与 Objective 两级；最终循环按 Objective 计算 | S5；单个 Artifact 合格不代表整个问题充分 |
| D030 | 讨论明确 | 已完成 Objective 可冻结和复用，未完成部分继续 re-plan；Query 允许 PARTIAL 结果 | S5；支持部分问题先可靠回答 |
| D031 | 讨论明确 | 总体架构分 Main Agent Flow、Shared Knowledge Services、Runtime & Governance 三类 | S5；避免把 RAG、Registry、Validation、AgentState 误画成线性节点 |
| D032 | 讨论明确 | Validation / Policy 是 cross-cutting governance | S5；覆盖输入、语义、计划、SQL/tool、Artifact 与最终 claim |
| D033 | 讨论明确 | 从更高层将主流程压缩为 Interaction、Normalization、Planning & Orchestration、Data & Tool、Evaluation & Sufficiency、Response 六个大层 | S5；Architecture Layer 不等于 Python package |
| D034 | 讨论明确 | 增加 Requirement Decomposer 窄职责 Sub-agent，在 Planner 前利用 Shared Knowledge 把 Objective 拆成 semantic-atomic ArtifactRequirement | S5；不选 Tool，不因 source 不便删除用户需求 |
| D035 | 讨论明确 | Requirement 的 base_criticality 是语义重要性，原则上近似 immutable | S5；执行优先级可变，但不能通过降级关键 Requirement 伪造 COMPLETE |
| D036 | 讨论明确 | ArtifactRequirement 与实际 Artifact 共用统一 ArtifactDescriptor / ArtifactType / canonical semantic keys | S5；Requirement = what we need，Artifact = what we have |
| D037 | 讨论明确 | Feature Engine 的确定性计算结果也进入统一 Artifact 体系，并通过 derived_from 保留 data lineage | S5；避免每层产生私有结果格式 |
| D038 | 讨论明确 | QualificationRule 与 SampleAdequacyRule 分离 | S5；前者决定 eligibility，后者决定样本能否支撑结论 |
| D039 | 讨论明确 | 赛季中的 qualification 需要独立 League/Reference Context，official season progress 与 local ingestion coverage 分开 | S5；避免用数据库最大日期代替真实赛季进度 |
| D040 | 讨论明确 | Planner 可以给 source preference；Router 是并列但更窄的 Routing Agent，负责实际 source/tool selection | S5；Router 可推翻 preference，但不能绕过 constraint / policy |
| D041 | 讨论明确 | Orchestrator 是工作流管理者，不是领域专家 | S5；负责调度、状态、权限、预算、阻塞、用户升级和 replan timing |
| D042 | 讨论明确 | Re-planning 使用同一个 Planning Agent 的 REVISE_PLAN 模式，不单设第二个 Replanner | S5；Orchestrator 决定 when，Planner 决定 what，Router 决定 where/how |
| D043 | 讨论明确 | Runtime State 拆成多个独立 State Domain，而不是一个巨大 AgentState dict | S5；Query/Objective/Planning/Routing/Execution/Artifact/Interaction/Permission/Budget 等保持相同设计思想 |
| D044 | 讨论明确 | State 更新采用 Local ownership + reviewed global transition | S5；Sub-agent 可写自己的 Local State，跨 Domain 变化由 Orchestrator 审阅 |
| D045 | 讨论明确 | 用户需求本身不明确时必须 clarification，并优先提供少量选项供用户选择 | S5；模型可推荐但不能替用户决定问题含义 |
| D046 | 讨论明确 | 问题明确后，免费且允许的数据源 fallback 可自主进行；付费 / 高成本 source 才升级询问用户 | S5；减少不必要打断，同时保留成本授权 |
| D047 | 用户约束 | PostgreSQL、DuckDB / Parquet 在 Agent Runtime 中为只读资源；修改属于 System Administrator 权限，用户不能对话授权越界 | S5；应由 SQL AST + sandbox / read-only policy 强制 |
| D048 | 讨论明确 | Artifact quality 是绑定 Objective / Requirement 的 contextual ArtifactAssessment；Artifact Registry 管理但不充当质量裁判 | S5；同一 Artifact 对不同问题可有不同适用性 |
| D049 | 讨论明确 | Objective Sufficiency 先做 Critical Requirement hard gate，再做 weighted requirement coverage | S5；低重要性证据不能平均掉核心缺口 |
| D050 | 讨论明确 | Objective COMPLETE 可以保留 optional_gaps / limitations 并反馈用户 | S5；COMPLETE 表示核心问题可回答，不代表所有信息完美齐全 |
| P001 | 编辑建议 | 为 plan / execution 增加版本或快照机制 | 便于 checkpoint 与审计，具体实现待定 |
| P002 | 编辑建议 | 设置 MAX_RETRIES、MAX_REPLANS、MAX_TOTAL_STEPS | 避免无限循环，同时保留 D019 |
| P003 | 编辑建议 | Requirement Matcher 返回 SATISFIED / PARTIAL / MISSING 或等价状态 | 支持 Artifact 复用、组合满足与部分覆盖 |
| P004 | 编辑建议 | Evidence 保留 raw source 与 structured extraction 两层 | 支持引用、debug 与幻觉检查 |
| P005 | 编辑建议 | Sub-agent Report 使用共享 envelope，再由 PlannerReport / RoutingReport / JudgeReport 扩展 | 支持 Orchestrator 统一审阅 |
| O001 | 待决 | ArtifactDescriptor / ArtifactRequirement / Artifact / payload subtype 正式 schema | 进入 Domain Modeling 后定稿 |
| O002 | 待决 | checkpoint 持久化 | 存储、恢复、一致性、重复调用 |
| O003 | 待决 | Critical gate、weighted coverage 与 ObjectiveState transition 的具体算法 | code validation、Judge signal、required/optional requirement |
| O004 | 待决 | Planner / Router 如何消费 MetricDefinition、SourceMapping 与 available capabilities | 输入上下文、查询接口、模型/规则边界 |
| O005 | 待决 | Judge / Evidence validation 输入输出与来源质量策略 | 结构化事实、报道、观点、冲突证据的处理 |
| O006 | 待决 | LangGraph 引入时机 | 先跑通手工状态机，再评估迁移价值 |
| O007 | 待决 | QualificationRule / SampleAdequacyRule / LeagueStateSnapshot 正式契约 | 动态 threshold、sample unit、coverage、source freshness |
| O008 | 待决 | State Domain / StateTransition / AgentReport 统一契约 | ownership、version、transition reason、并发与审阅 |
| O009 | 待决 | Permission / Cost policy 的正式等级与 Orchestrator escalation contract | 免费、付费、高成本、system-admin-only |

变更时保留旧决策并标记被哪个新决策替代。不要悄悄把讨论方案或编辑建议写成“当前已实现”。
