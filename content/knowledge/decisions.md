# 决策与开放问题

整理日期：2026-09-10。ID 是本博客为后续引用新增的文档标识，不代表历史中已使用该编号。

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
| D018 | 讨论明确 | collected data 不自动等于 approved data，应经过 validation / quality gate | S5；候选、低置信、拒绝等状态待正式定义 |
| D019 | 讨论明确 | confidence 更接近 analysis sufficiency，不是模型正确概率 | S5；仍有 recoverable gap 时继续循环，无可恢复缺口时可 LIMITED 退出 |
| D020 | 讨论明确 | Metric 层保持简单，核心为 MetricDefinition + SourceMapping | S5；组合多个来源满足需求的工作交给 Planner |
| D021 | 讨论明确 | SourceMapping 采用 DIRECT / CALCULATED / 无映射的简化语义 | S5；CALCULATED 表示 Feature Engine 可确定性计算 |
| D022 | 讨论明确 | Metric Registry 负责 execution correctness，RAG 负责 semantic reasoning 与动态知识 | S5；不把确定性字段映射完全交给向量检索 |
| P001 | 编辑建议 | 为 plan / execution 增加版本或快照机制 | 便于 checkpoint 与审计，具体实现待定 |
| P002 | 编辑建议 | 设置 MAX_RETRIES、MAX_REPLANS、MAX_TOTAL_STEPS | 避免无限循环，同时保留 D019 |
| P003 | 编辑建议 | 为 Artifact Store 设计 SATISFIED / PARTIAL / MISSING 匹配结果 | 支持复用与部分覆盖 |
| P004 | 编辑建议 | Evidence 保留 raw source 与 structured extraction 两层 | 支持引用、debug 与幻觉检查 |
| O001 | 待决 | ArtifactRequirement / DataArtifact 正式 schema | data_type、entities、time_range、constraints、required/optional data、quality requirements |
| O002 | 待决 | checkpoint 持久化 | 存储、恢复、一致性、重复调用 |
| O003 | 待决 | analysis sufficiency 具体计算与阈值 | 数据完整度、样本可靠性、上下文覆盖、校准 |
| O004 | 待决 | Planner 如何消费 MetricDefinition / SourceMapping | 输入上下文大小、查询接口、工具选择边界 |
| O005 | 待决 | Evidence validation 与来源质量策略 | 结构化事实、报道、观点、冲突证据的处理 |
| O006 | 待决 | LangGraph 引入时机 | 先跑通手工状态机，再评估迁移价值 |

变更时保留旧决策并标记被哪个新决策替代。不要悄悄把讨论方案或编辑建议写成“当前已实现”。
