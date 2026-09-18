# Baseball Agent 当前状态

更新时间：2026-09-18。此页是下一轮大范围重写前的首要上下文。

## 目标

构建一个可解释、可验证、能处理开放世界 MLB 问题的 Baseball Agent：

- 原始用户意图尽量无损保存；
- Planner 可以自由决定下一步需要什么信息与能力；
- Web / Knowledge / Dynamic Evidence 保持开放语义请求，只施加安全、来源与 provenance 约束；
- 只有数据库分析在 SQL 边界把开放 analytical intent 收敛成 Safe IR / SQL；
- PostgreSQL、Parquet、Web、Dynamic Facts、Shared Knowledge 与 sandboxed compute 通过 Artifact/Reference 组合；
- 最终回答只来自可追溯、范围匹配的 accepted evidence；
- 证据不完整时优先 LIMITED，而不是无条件全拒绝。

## 当前阶段

项目已经从 v0.1 的“安全可执行”经历多轮后续 Runtime 重构讨论与实现报告，当前准备进入一次更大范围的责任边界重写。

演进可概括为：

~~~text
v0.1 safe execution baseline
→ LLM-first experiment
→ Artifact Runtime
→ runtime invariant hardening
→ Planner/runtime convergence
→ latency hardening
→ RuntimeContext / knowledge authority
→ Evidence Routing / Dynamic Facts
→ Partial Sufficiency / Sandboxed Python
→ Lossless Semantic / Developer Runtime
→ Planner / Executor boundary redesign
~~~

其中最后一步是当前准备冻结的下一轮重写基线。

## 远端核验与当前实现报告要分开

GitHub 远端可直接核验的历史基线仍包括 v0.1.0 等已推送状态。

当前讨论提供的 v0.8–v0.10 Stop Reports 与 developer-mode trace 记录了更晚的实现线，但本次 GitHub 检查没有观察到远端 codex/v0.10-late-binding-dev-runtime 分支。

因此当前文档采用以下状态表达：

~~~text
repository verified
implementation report supplied
dogfood observed
architecture decision
rewrite target
~~~

不能把 implementation report 自动写成 repository verified。

## 最新 dogfooding 的关键结论

SemanticMessage 已经能够较完整保留自然语言意图；早期“所有非 year constraint 默认映射为 TIME”的 root cause 已在当前实现报告中被确认并修复。

但 developer-mode trace 又显示：

1. Planner 仍会直接生成 physical table / field / aggregate / filter / Safe IR；
2. Need dependency 并没有稳定解析成真实 Artifact export binding；
3. Planner 会构造 pseudo export refs；
4. Replanner 可能重复生成等价 Needs，而不是修复现有 Need Graph；
5. Planner-added information 可能被升级成 CORE，反过来抬高用户 Goal 完成门槛；
6. provider/tool 的 declared capability 与 actual scope 仍可能不一致；
7. domain population（例如 postseason）仍可能被过早压成 calendar range。

因此当前主矛盾已经从：

~~~text
Semantic loss before Planner
~~~

转成：

~~~text
Planner / Runtime Binder / Executor responsibility boundary
~~~

## 当前冻结的核心架构原则

> **Flexible cognition, explicit planning, SQL-specific convergence.**

### Early cognition

- raw query；
- SemanticMessage；
- open Requirements；
- references；
- structured hints。

目标是 preservation，而不是填满 schema。

### Planning

Planner 只决定：

- 缺什么信息；
- 需要哪个 capability class；
- Need dependencies；
- desired output；
- evidence requirement；
- recover / replan strategy。

Planner 不直接拥有 physical schema、trusted SQL、Artifact ID 或 completion truth。

### Execution

不是所有 Tool 都做相同的语义收敛。

Web / Knowledge / Dynamic Evidence 保留开放 request，主要约束：

~~~text
security
source policy
provenance
references
budget
evidence grounding
~~~

数据库才进行严格 analytical narrowing：

~~~text
Analytical Need
→ AnalyticalIntent
→ SchemaCatalog
→ Safe Analytical IR
→ deterministic compiler
→ SQL guard
→ read-only execution
~~~

Dynamic Fact：

~~~text
canonical entity id
+ relation
+ as_of
→ provider-backed fact artifact
~~~

Python：

~~~text
explicit Artifact bindings
→ sandboxed compute
→ derived Artifact
~~~

Web / Knowledge 可以使用稳定 envelope 与 Artifact 返回，但其 semantic payload 不需要像 SQL 一样进入封闭 DSL。

## User Requirement 与 Planner Need

下一版必须严格区分：

~~~text
UserRequirement
≠ PlannerNeed
~~~

UserRequirement 表示用户真正要求什么，决定 Objective completion semantics。

PlannerNeed 是当前为了满足 Requirement 而创建的工作项。

Planner 可以添加 supporting Need，但不得：

- 改写用户 Requirement；
- 把 optional investigation 自动变成 CORE；
- 因自己新增的新闻/背景查询失败而宣布用户 Goal FAILED。

## Runtime Binding

Planner 只声明：

~~~text
Need B depends_on Need A
requires PLAYER_ID_SET
~~~

Runtime 负责：

~~~text
Need A
→ Artifact
→ typed Export
→ compatibility check
→ InputBinding
→ Need B ToolRequest
~~~

Planner 不应生成 pseudo reference，也不应把自己记忆中的 canonical ID 直接当 authoritative input。

## Replanning

Replanner 的默认行为应是修复现有图：

~~~text
reuse Artifact
patch failed edge
replace invalid Tool choice
add genuinely missing Need
close obsolete Need
~~~

而不是每轮重新创建一套近似重复的 Need。

## Data Routing 与 Evidence Routing

两者继续正交。

Data Routing：

~~~text
2015–2023 → Parquet
2024–2026 → PostgreSQL
~~~

只回答统计数据在哪里算。

Evidence Routing 根据 Requirement / evidence class / freshness / source authority 选择 Dynamic Fact、Web、Knowledge 或本地数据。

历史问题仍可能需要 Web；当前问题也可能完全不需要 Web。

## 数据库输出契约

数据库输入必须严格编译；数据库输出只需要一定程度标准化。

建议统一：

~~~text
columns/schema
rows/structured_data
row_count
requested_scope
actual_scope
provenance
IR/query ref
lineage
exports
~~~

具体查询结果的列、聚合与派生值可以保持灵活。

原则：

> **strict SQL input, standardized envelope, flexible analytical payload.**

## Dynamic Facts

动态事实继续坚持：

~~~text
canonical id
+ relation
+ as_of
~~~

LLM prior 只能是 hypothesis，不是 Evidence。

UserAssertion 默认 UNVERIFIED，可以驱动 verification Need，但不能自动成为 truth。

## Scope

Scope 保留为 execution / evidence metadata，而不是完整语义 schema。

尤其要区分：

~~~text
game population
≠ calendar range
~~~

例如 postseason 是业务比赛集合；日期窗口只能是辅助解析，不得替代它。

## Partial Sufficiency

RequirementState / AnswerProjection 继续保留。

~~~text
SATISFIED
PARTIAL
UNSATISFIED
BLOCKED
~~~

Goal：

~~~text
COMPLETE
LIMITED
FAILED
WAITING_FOR_USER
~~~

核心原则：

> **Incomplete evidence should reduce answer scope, not erase supported conclusions.**

## Ephemeral Python

Sandboxed Python 继续只用于 bounded Artifact-level ad-hoc computation。

它不能直接访问 PostgreSQL、Web、host env、arbitrary filesystem 或 subprocess。

Source-level filtering/grouping 仍优先 Safe IR。

## Shared Knowledge

继续区分：

~~~text
Runtime Evidence
CandidateKnowledge
ACTIVE Approved Knowledge
~~~

current team / roster / injury / transaction / current stats 不应写成 timeless identity truth。

## Developer Runtime

开发者模式继续作为标准 dogfood 入口：

~~~text
python3 -m app.cli dev --trace-level verbose
~~~

重点观察 SemanticMessage、User Requirements、Planner proposal、Need graph、rejected proposal、Artifact binding、Tool request/outcome、scope verification、Judge、AnswerProjection、state delta 与 latency。

Developer mode 必须和正常 chat 走同一 production runtime。

## 下一次重写的责任图

~~~text
Conversation
    ↓
Semantic Interpreter
    ↓
Goal + User Requirements
    ↓
Planner
    ↓
Need Graph
    ↓
Runtime Binder / Scheduler
    ↓
Capability Execution
    ├── Web/Knowledge/Dynamic: flexible semantic request
    └── DB: SchemaCatalog → Safe IR → SQL
    ↓
ToolOutcome + Artifact
    ↓
Verification / Judge
    ↓
RequirementState
    ↓
AnswerProjection
    ↓
Response
~~~

## 保留的成熟 invariant

下一次大改不应推翻：

- read-only database；
- SQL/DuckDB guards；
- Safe Analytical IR；
- SchemaCatalog authority；
- Artifact lineage；
- independent Judge；
- Requested/Declared/Verified Scope；
- RequirementState / AnswerProjection；
- RuntimeContext / SystemClock；
- UserAssertion epistemic state；
- Data/Evidence Routing 分离；
- Candidate Knowledge governance；
- SSRF；
- Python sandbox；
- persistence/event journal；
- developer trace；
- known regression / holdout / real dogfood 三层测试。

## 当前结论

第 11 篇文章确立了 Goal / Need / Artifact 作为 Runtime 新中心。

第 12 篇进一步冻结了下一轮重写的责任边界：

> **Semantic 负责保留“用户要什么”；Planner 负责决定“下一步需要什么能力”；Runtime 负责把依赖绑定到真实 Artifact；Web 保持开放语义；数据库只在生成 SQL 前严格收敛；Judge/State 负责判断“证据是否足够”。**

当前优先级不是继续扩大 Scope 或给 Planner 更多 SQL 字段，而是依据这一边界重写 Planner → Binder → Executor 数据流。

历史文章保留当时背景；本页、decisions.md 与第 12 篇文章作为下一轮大改的优先设计来源。
