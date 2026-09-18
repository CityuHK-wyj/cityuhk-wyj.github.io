# 重写前的架构收敛：Baseball Agent 为什么要把“理解、规划、执行”重新分开

2026-09-18，Baseball Agent 又到了一个需要停下来重画边界的节点。

从 v0.1 到后续 Artifact Runtime、Evidence Routing、Partial Sufficiency、Sandboxed Python Compute，再到 Late-Binding Semantic Runtime，我们已经解决了很多局部问题：安全执行、Artifact/Assessment 分离、动态事实、部分回答、开发者 trace、开放语义保存。但最新 developer-mode dogfooding 说明，系统仍然存在一个更根本的责任错位：

> Semantic 层已经能理解用户，Planner 却仍然在过早承担“怎么执行数据库”的工作。

这篇文章不是继续给旧 Runtime 加字段，而是记录下一次大范围重写前准备冻结的架构边界。

> **状态说明：** 本文依据 2026-09-17 至 09-18 的实现报告、当前讨论与 developer-mode trace 整理。最新 v0.10 分支/commit 在本次 GitHub 检查中没有出现在远端，因此本文把它们视为“当前实现报告 + 重写设计基线”，而不是伪称远端已经直接核验全部实现。

## 1. 最新 dogfooding 证明：Semantic 已经不是主要瓶颈

一个非常简单的问题：

~~~text
2025年季后赛大谷翔平表现如何
~~~

当前 SemanticMessage 已经能够正确保留：

- 大谷翔平 / Shohei Ohtani；
- 2025；
- postseason；
- “总体表现”这一开放分析目标；
- 打击、投球、关键比赛等可能需要的证据方向；
- raw query、source span 与 references。

这比早期 fixed Scope pipeline 已经进步很多。

过去真正严重的 bug 是：

~~~text
非 year constraint
→ 被 extract_obligations() 默认映射成 TIME
~~~

所以会出现：

~~~text
大谷翔平 → TIME
打者 → TIME
至少25个BBE → TIME
~~~

v0.10 的 Lossless Intent Flow 已经修掉这一类前置语义损失。

但最新 trace 又暴露了下一层问题：Planner 虽然拿到了正确用户意图，却直接生成 table、field、aggregate、filter、entity_set、Safe IR 细节，最后 local analytics 因 INVALID_IR 失败。

因此新的结论是：

> **Late binding 不能只做到 Semantic → Planner。它必须继续延伸到 Planner → Executor。**

## 2. 下一版的核心原则

准备冻结的总原则是：

> **Flexible cognition, explicit planning, SQL-specific convergence.**

更具体地说：

~~~text
Early cognition
= lossless / open-world / reference-rich

Planning
= objective / capability / dependency / expected product

Web / Knowledge / Dynamic Evidence
= keep semantic requests flexible
= enforce security / provenance / source policy

Database analytics
= narrow only when compiling analytical intent into Safe IR / SQL
~~~

这里要特别区分两件事：

> **安全边界不等于语义收敛。**

Web 当然仍然需要 SSRF、source policy、provenance、evidence span 等安全与证据治理，但它不需要像数据库一样先把用户问题压进一个封闭 DSL。真正需要强语义收敛的是 SQL，因为 SQL 会直接访问结构化数据并执行精确计算。

因此新的原则更准确地说是：

> **开放语义尽量保持开放，只有进入数据库查询时才把分析意图收敛成受信任的 SQL 表达。**

## 3. 新的主链路

下一次重写准备采用：

~~~text
User Message
    ↓
RuntimeContext
    ↓
SemanticMessage
    ↓
Goal
    ↓
User Requirements
    ↓
Planner
    ↓
Need Graph
    ↓
Capability Selection
    ↓
Runtime Binding
    ↓
Capability Execution
    ├── Web / Knowledge / Dynamic Fact
    │     keep flexible semantic request + refs
    │
    └── Database Analytics
          ↓
        SQL Compilation Boundary
          ↓
        Safe Analytical IR
          ↓
        SQL
    ↓
ToolOutcome
    ↓
Artifact
    ↓
Scope / Epistemic Verification
    ↓
Judge
    ↓
RequirementState
    ↓
AnswerProjection
    ↓
Response / Replan
~~~

这里最重要的变化不是增加新组件，而是重新规定每一层“不能做什么”。

## 4. SemanticMessage：保存用户意图，而不是完成执行编译

SemanticMessage 继续采用：

> **Fixed envelope + flexible payload + explicit references.**

它可以保存：

~~~text
raw_query
understanding
explicit_constraints[]
mentioned_entities[]
temporal_expressions[]
analysis_requests[]
evidence_requests[]
ambiguities[]
references[]
structured_hints{}
~~~

但 structured hints 只是高置信度提示，不是整个用户意图的唯一权威表示。

例如：

~~~text
“2024年打者中，面对左投和右投的平均EV差异最大的是谁，
左右两边至少25个BBE，并给出差异相对整体EV标准差有多大。”
~~~

Semantic 层不需要提前把它完全塞进：

~~~text
metric
aggregation
qualification
comparison_type
~~~

只需要完整保存这项分析目标及其来源。

## 5. Scope 降级为 execution / evidence metadata

Scope 仍然有价值，但它不再承担“完整描述一个棒球问题”的职责。

适合早期结构化的东西包括：

- canonical entity ID（如果已验证）；
- explicit season；
- explicit game type；
- absolute date；
- as-of；
- source/data coverage。

不适合把全部含义压进 Scope 的包括：

- “表现如何”；
- “为什么变强”；
- “差异最大”；
- “相对于标准差有多大”；
- “有没有机械调整报道”。

这些是 objective semantics，而不是 Scope。

Scope 更应该从真实 Evidence / Artifact 与数据库执行结果中逐步形成，而不是在所有 Tool 执行前强制完成。

## 6. User Requirement 与 Planner decomposition 必须分开

这次 trace 还暴露了另一个问题：Planner 会把自己认为“可能有帮助”的统计项扩写成新的 Requirement。

用户只问：

~~~text
2025年季后赛大谷翔平表现如何
~~~

真正的用户约束大致只有：

~~~text
ENTITY = Ohtani
SEASON = 2025
GAME POPULATION = postseason
ANALYSIS = overall performance
~~~

至于：

~~~text
AVG / HR / RBI / OPS
ERA / SO / W
关键比赛报道
~~~

应该属于 Planner 的分析 decomposition，而不是 immutable User Requirement。

否则会出现：

~~~text
Planner 自己想查新闻
→ 新闻源失败
→ 用户核心 Goal 被判失败
~~~

因此下一版必须明确：

~~~text
UserRequirement
≠ PlannerNeed
~~~

UserRequirement 决定完成语义。

PlannerNeed 决定当前为了回答它要做什么。

Planner 不得通过新增 Need 抬高用户原始问题的完成门槛。

## 7. Planner 的新职责：决定“要什么”，不是“怎么写数据库程序”

这是下一次重写最重要的边界。

Planner 应该输出：

~~~text
Need
  objective
  capability class
  dependencies
  desired output
  evidence requirement
  semantic constraints
  criticality
~~~

例如：

~~~text
Need:
  objective:
    分析 Ohtani 的 2025 postseason pitching performance

  capability:
    local_analytics

  depends_on:
    canonical player identity

  desired_output:
    pitching performance statistical artifact
~~~

Planner 不应该直接输出：

~~~text
POSTGRES
statcast_pitches
pitcher_id
release_speed
COUNT_NON_NULL
AVG(...)
SQL operator
~~~

更不应该自己猜 physical column 或 executable SQL。

## 8. 只有数据库层需要真正的语义收敛

当 Planner 选择 local analytics 后，才开始真正的数据库收敛：

~~~text
Analytical Need
    ↓
AnalyticalIntent
    ↓
relevant SchemaCatalog slice
    ↓
IR Builder
    ↓
Safe Analytical IR
    ↓
Schema validation
    ↓
deterministic SQL compiler
    ↓
SQL guard
    ↓
baseball_readonly
~~~

这里的“收敛”专指：

~~~text
开放分析语义
→ 真实数据库字段 / relation / operator
→ Safe IR
→ SQL
~~~

LLM 可以参与 AnalyticalIntent → IR candidate，但可信字段、operation、relation、join 和 SQL 必须由 SchemaCatalog + deterministic validation 约束。

Web 不需要复制这套过程。Web Need 可以继续是开放语义：

~~~text
objective
query / search intent
entity/time hints
references
desired evidence
~~~

Web Tool 需要的是 SSRF、source allow/deny policy、fetch budget、provenance、evidence extraction 与 claim grounding，而不是一个类似 Safe IR 的“Web DSL”。

Dynamic Fact / Shared Knowledge 也可以保留各自必要的 lookup key 或 relation hint，但不应该为了统一接口而被迫模拟 SQL 式收敛。

因此：

> **严格的 semantic narrowing 是 database-specific；其它 Tool 需要的是安全和证据契约，而不是统一的封闭语义 schema。**

## 9. Runtime Binding：Need dependency 不等于字符串引用

最新 trace 还显示了一个具体 data-flow defect。

Planner 正确声明：

~~~text
Need B depends_on Need A
~~~

但实际 ToolRequest 里的 input_refs 为空，或者 Planner 自己写：

~~~text
n1-resolve-player:PLAYER_ID_SET
~~~

这种 pseudo-reference。

这必须重写。

正确路径是：

~~~text
Need A
    ↓
Tool execution
    ↓
Artifact A
    ↓
Export PLAYER_ID_SET
    ↓
Runtime compatibility check
    ↓
InputBinding
    ↓
Need B ToolRequest
~~~

Planner 只声明依赖和需要哪类数据。

Artifact ID、Export ID、版本、scope compatibility 都由 Runtime 负责解析。

Planner 不得自己构造 Artifact 引用。

## 10. Replanner 应该修图，不应该重建另一张图

现在 replan 还可能发生：

~~~text
n1–n5 部分失败
↓
重新生成 n6–n10
↓
identity / batting / pitching / web 全部重复
~~~

下一版应该把 Replanner 改成 graph repair：

~~~text
inspect existing Needs
inspect accepted Artifacts
inspect ToolOutcomes
inspect rejected bindings
inspect unresolved Requirements
    ↓
reuse
patch
replace failed edge
add genuinely new Need
close obsolete Need
~~~

默认禁止无理由复制一整套等价 Need。

已有 accepted Artifact 必须优先复用。

## 11. Criticality 不能由 Replanner 随意漂移

一个 Need 在第一轮是 OPTIONAL，第二轮不能因为 LLM 重新规划就自己变成 CORE。

Criticality 应来自：

- User Requirement；
- logical prerequisite；
- deterministic dependency semantics。

Planner 可以建议某项信息“有帮助”，但不能单方面改变 Objective completion semantics。

这也是：

> **Planner proposes; State/Judge own completion truth.**

的延伸。

## 12. Data Routing 与 Evidence Routing 继续保持正交

数据库年份规则只回答：

~~~text
统计数据去哪算？
~~~

例如：

~~~text
2015–2023 → Parquet
2024–2026 → PostgreSQL
~~~

它不能决定：

~~~text
是否要 Web
是否需要 transaction evidence
是否需要 roster evidence
是否需要新闻/采访
~~~

Evidence Routing 应根据：

~~~text
Requirement
→ required evidence
→ source capability
→ freshness / temporal fit
→ available Artifact
~~~

决定。

因此：

~~~text
2018 statistical analysis + trade explanation
→ Parquet + historical transaction/news evidence

2026 pure Statcast aggregation
→ PostgreSQL only
~~~

年份不是 Evidence Router。

## 13. Dynamic Fact：模型记忆只能是 hypothesis

当前动态事实继续使用：

~~~text
canonical entity ID
+
relation type
+
as_of
~~~

例如：

~~~text
TEAM_MEMBERSHIP
ROSTER_MEMBERSHIP
TRANSACTION
STATUS
~~~

核心 invariant 是：

> **LLM prior != Evidence.**

模型记得某球员在哪队，只能帮助提出 lookup，不得直接成为 VERIFIED_TRUE。

UserAssertion 同理：

~~~text
用户说“他已经被交易”
→ UNVERIFIED UserAssertion
→ Planner-visible verification Need
~~~

既不能自动相信，也不能被模型旧知识自动否定。

## 14. Baseball semantic population 不能被 calendar range 替代

“2025 postseason”首先是比赛集合语义，不只是：

~~~text
2025-10-01 .. 2025-11-30
~~~

日期可以辅助查询，但不能替代：

~~~text
season = 2025
game population = POSTSEASON
~~~

同理，Spring Training、regular season、postseason、World Series、before/after transaction 都必须保留业务 population semantics。

TemporalResolver 可以产生日期窗口，但不能偷偷改变用户要求。

## 15. RequirementState / AnswerProjection 保持 v0.9 的方向

下一次重写不应该回到 all-or-nothing。

继续保留：

~~~text
SATISFIED
PARTIAL
UNSATISFIED
BLOCKED
~~~

以及：

~~~text
COMPLETE
LIMITED
FAILED
WAITING_FOR_USER
~~~

核心规则：

> **Incomplete evidence should reduce answer scope, not erase supported conclusions.**

只要存在 material grounded claims，就应该考虑 LIMITED，而不是因为另一个独立 Requirement 失败就全部拒绝。

但是 indispensable prerequisite 仍然有效：如果用户问“交易前后”，交易日期没有验证，就不能把任意两个时间段假装成交易前后。

## 16. Ephemeral Python Compute 保留，但必须位于 Artifact 层

Sandboxed Python 的角色不是数据库 escape hatch。

推荐顺序：

~~~text
source filtering / grouping
→ Safe IR / SQL

bounded Artifact post-processing
→ Ephemeral Python Compute
~~~

Python 只能消费显式 Artifact bindings，并继续禁止默认访问 host environment、arbitrary filesystem、network、subprocess、database credentials 与 package install。

适合它的任务包括 multi-Artifact alignment、bootstrap / CI、rolling calculation、temporary normalization、statistical test 与 ad-hoc ranking/comparison。

如果一种操作重复出现，再提升成 deterministic operator 或 IR capability。

## 17. 数据库输出可以标准化，但不需要变成僵硬结果类型

数据库输入在 SQL 边界必须严格；数据库输出则可以采用“标准化 envelope + 灵活 payload”。

推荐数据库 Artifact 至少稳定提供：

~~~text
artifact_id
source / relation
columns / schema
rows or structured_data
row_count
measure / grouping hints
requested_scope
actual_scope
provenance
query / IR reference
lineage
exports
~~~

其中 envelope、schema、scope、provenance、lineage 应该标准化，便于 Judge、Planner 和下游 Python/Web 消费；具体查询返回哪些列、哪些聚合、哪些派生值则允许随分析变化。

也就是说：

> **Database input is strictly compiled; database output is structurally standardized but semantically extensible.**

这样不会为了支持每一种临时分析就新增固定 Result 类型。

## 18. Artifact / Assessment / State 继续分离

这部分不是下一轮要推翻的东西。

仍然坚持：

~~~text
ToolResult != ArtifactAssessment
Artifact != Answer
Planner != Judge
Planner != terminal truth
RequestedScope != DeclaredScope != VerifiedScope
CandidateKnowledge != ACTIVE Knowledge
~~~

Artifact 继续保存 structured_data、text、exports、provenance、references、actual_scope、lineage 与 metadata。

Judge/Verification 再判断这个 Artifact 是否能支持某个 Requirement。

## 19. Shared Knowledge 继续采用 authority governance

Stable identity、domain definition、rule、historical knowledge 与 dynamic operational state 继续分开。

共享知识读取：

~~~text
ACTIVE Knowledge
→ Knowledge Artifact
→ Runtime
~~~

写入：

~~~text
Runtime discovery
→ CandidateKnowledge
→ review
→ APPROVED
→ ACTIVE
~~~

当前球队、roster、injury、transaction、current statistics 不能作为 timeless player profile 长期写死。

## 20. Developer Mode 应成为重写期间的标准 dogfood 入口

下一版继续保留：

~~~text
python3 -m app.cli dev --trace-level verbose
~~~

Developer Mode 必须与正常 chat 使用同一 Runtime，只增加观察。

重点观察 Raw Query、SemanticMessage、User Requirements、Planner proposals、Need graph、rejected proposal/reason、Runtime bindings、Tool request/ToolOutcome、Artifact/Export、Scope verification、Judge、AnswerProjection、state delta 与 latency。

尤其需要新增或强化：

~~~text
Need dependency
→ resolved Artifact binding
~~~

以及：

~~~text
Planner proposed Need
→ accepted / rejected / repaired
~~~

的完整可见性。

## 21. 下一次大范围重写的模块责任

准备冻结成下面这张图：

~~~text
Conversation / Interaction
        │
        ▼
Semantic Interpreter
- preserve intent
- preserve refs
- identify ambiguity
        │
        ▼
Goal + User Requirements
- user-owned completion semantics
        │
        ▼
Planner
- decide missing information
- choose capability class
- create/repair Need Graph
- no physical DB plan
        │
        ▼
Runtime Binder / Scheduler
- resolve Need dependencies
- bind accepted Artifact exports
- enforce budgets/lifecycle
        │
        ├── Web Research
        │     open semantic request + evidence governance
        │
        ├── Dynamic Fact / Knowledge
        │     lookup semantics + provenance
        │
        ├── Local Analytics
        │        ↓
        │     SchemaCatalog
        │        ↓
        │     Safe Analytical IR
        │        ↓
        │     SQL
        │
        └── Python Compute Sandbox
              bounded Artifact computation
        │
        ▼
ToolOutcome + Artifact
        │
        ▼
Verification / Judge
        │
        ▼
RequirementState
        │
        ▼
AnswerProjection
        │
        ▼
Response
~~~

## 22. 哪些旧代码值得大范围重写

下一轮不应该继续在这些地方打补丁：

- giant Scope semantic projection；
- Planner-generated full Safe IR；
- Planner-generated pseudo Artifact refs；
- duplicated Requirement / Need extraction；
- replan 时重新生成整套 plan；
- Planner 自由修改 CORE / OPTIONAL；
- Tool capability 与真实 provider scope 不一致；
- calendar window 替代 domain population；
- generic fallback 抹掉具体 Tool failure；
- legacy pipeline 与 Artifact Runtime 双 authority。

优先目标是让同一条 data flow 只存在一个权威 owner。

## 23. 哪些东西不要重写掉

大改不意味着推翻所有积累。

应该保留的成熟 invariant 包括：

- read-only PostgreSQL；
- DuckDB filesystem restriction；
- SQL guard；
- Safe Analytical IR 思想；
- SchemaCatalog authority；
- Artifact lineage；
- independent Judge；
- RequirementState / AnswerProjection；
- RuntimeContext / SystemClock；
- UserAssertion epistemic state；
- Evidence Routing；
- Candidate Knowledge governance；
- SSRF boundary；
- sandboxed Python；
- persistence / event journal；
- developer trace；
- holdout / metamorphic / dogfood 分层测试。

## 24. 重写后的成功标准

下一版是否成功，不再看“加了多少字段”或“某几个熟悉问题能不能过”。

更重要的是：

~~~text
用户表达是否完整保留？
Planner 是否只规划目标/能力/依赖？
Runtime 是否能把依赖解析成真实 Artifact binding？
Executor 是否在自己的 boundary 内完成安全收敛？
Tool capability 是否诚实？
Replanner 是否复用已有 Artifact？
部分证据是否能产生 LIMITED answer？
所有最终 Claim 是否可回溯？
换球员、年份、语言、统计定义后是否仍然工作？
~~~

只有这些成立，Baseball Agent 才真正从“复杂 pipeline”开始变成一个可泛化的 analytical agent。

## 25. 当前阶段结论

第 11 篇文章把 Runtime 的中心从 fixed semantic pipeline 转向 Goal / Need / Artifact。

这一轮又进一步把责任边界收紧：

> **Goal / Requirement 保存用户想要什么。Planner 决定需要什么能力。Runtime 负责绑定真实数据产品。Web 保持开放检索语义；只有数据库分析在 SQL 边界收敛。Judge / State 决定证据是否够。**

这将作为下一次大范围代码重写的设计基线。

我们不再试图通过“更大的 Scope schema”解决开放世界问题。

真正要做的是：

> **让开放语义一直保持开放；只有当分析真正要变成 SQL 时，才把它收敛到数据库能够安全、确定执行的形式。**

**来源：** S9；历史背景参见 S5–S8。