# Baseball Agent 当前状态

更新时间：2026-09-17。此页是后续接手的首要上下文。当前状态同时区分：已发布基线、已实现未合并分支、独立审计报告，以及已经确认但尚未实现的新架构方向。

## 目标

构建一个可解释、可验证、能处理开放世界 MLB 问题的 Baseball Agent：保留原始用户意图，跨 PostgreSQL、Parquet/DuckDB、Web、Shared Knowledge 与计算能力获取证据，通过可追溯 Artifact / Reference 组织多步分析，在真正执行 SQL、文件、网络、权限与永久知识写入时进入严格 deterministic boundary，最终生成有来源、有范围、有假设和限制的自然回答。

## 当前阶段

项目已经完成 v0.1.0 发布，但真实 dogfooding 与 generalization audit 证明：v0.1 的“安全可执行”不等于“开放世界可用”。

当前阶段应理解为：

```text
Architecture Freeze
→ v0.1 implementation / hardening
→ real PostgreSQL + Parquet integration
→ dual semantic runtime
→ v0.1.0 release
→ real user dogfooding
→ LLM-first v0.2 experiment
→ independent generalization audit
→ Artifact-Driven General Analytical Runtime redesign
```

## 已发布基线：v0.1.0

GitHub 已直接核验：

```text
main @ 35b47c4174e98460ebdbcd2ace46adfba36225c4
commit: Adopt Baseball Agent v0.1 dual semantic runtime
tag: v0.1.0
```

发布采用 reviewed-tree adoption：adoption commit 的单一 parent 是旧 `main`，没有把旧 credential-risk development ancestry 通过 unrelated-history merge 接回发布线。

v0.1 已建立的重要能力包括：

- 真实 PostgreSQL / historical Parquet 分流；
- read-only PostgreSQL role / transaction；
- DuckDB filesystem restrictions；
- SQL AST / statement guard；
- typed semantic constraints 与 dual semantic review；
- persisted Artifact / Assessment / checkpoint / restart；
- context/run/objective isolation；
- Shared Knowledge V1；
- clarification / permission / constraint revision 生命周期；
- SyntheticDataTool 只能显式 demo 使用。

v0.1 的价值是：当分析问题已经能够正确收敛成执行语义后，系统可以安全、可验证地执行。

## v0.1 dogfooding 暴露的问题

真实用户输入很快证明，系统对自然问题仍过于封闭。

主要症状包括：

- 未知昵称/社区用语无法继续调查；
- 多年份中文表达曾在 LLM 之前被 deterministic parser 阻断；
- “谁打得更好”“为什么这么强”“谁最有威胁”等开放评价不能自然转成分析策略；
- team-level population 在本地 Statcast 没有直接字段时难以组合其它来源解决；
- FAILED / unresolved UUID 对用户不友好；
- Clarification resume 更像开发接口而不是正常对话；
- local data 不足时没有把 Web 当作正常 recovery tool。

这促使架构从“先完全结构化，再规划”转向“先理解和调查，到 action boundary 才严格收敛”。

## 已实现但未合并：LLM-first v0.2

远端 GitHub 已直接核验：

```text
pi/v0.2-llm-first-runtime
HEAD = 7c3b6bdd426147e5cc7780900678bede7def913c
```

该分支来自 open-world checkpoint，并实现：

- application-level `BaseballAgent` conversation service；
- raw message + partial understanding 进入 Planner；
- LLM understanding / planning / composing；
- semantic parse 不再是必过 gate；
- live Web research（DuckDuckGo Lite + bounded page fetch + SSRF guard）；
- batting / pitching stats tools；
- entity lookup（local → MLB StatsAPI）；
- local analytics 收敛到 strict `SQLAnalysisRequest`；
- CandidateKnowledge 管理员审核路径；
- interactive `chat` CLI；
- `WAITING_FOR_USER` conversation state。

这一分支没有合并到 `main`。

## 独立 generalization audit

本轮讨论中收到 Codex 独立审计结论：

```text
GENERALIZATION_AUDIT_BLOCKED
```

审计报告指出的核心问题包括：

### P1

- unrelated evidence 可以让 Objective 过早 COMPLETE；
- 请求 date range 的 batting question 可能执行/使用 season statistics；
- team filtering 可因 city matching 混淆同城球队；
- unsupported explicit constraint 可能被 default/drop。

### P2

- deterministic fallback 存在 known phrase-specific handling；
- Web snippet 缺少 claim-level grounding；
- analytics 更像 predefined metric lookup，而不是 general composition；
- provider fallback 可能改变用户原意；
- follow-up 缺少真正 reusable semantic state。

### P3

- 测试被已知 dogfooding examples 污染，部分 assertion 太弱。

注意：博客更新时该 Codex audit branch 尚未通过 GitHub connector 在远端观察到，因此这里把审计结果记录为本轮 review report，而不是“远端 commit 已直接核验”。

## 新的架构原则

当前已经确认的新原则是：

> **Flexible cognition, composable evidence, deterministic actions.**

不再在 Semantic Layer 过早把所有自然语言压成封闭 enum，也不把所有内容都改成自由字符串。

采用：

> **Fixed envelope + flexible payload + explicit references + strict action compilation.**

## Runtime 新中心：Goal / Need / Artifact / Reference / Action

计划中的核心流程：

```text
Conversation
    ↓
Goal
    ↓
Need Graph
    ↓
Planner
    ↓
Tool / Compute
    ↓
Artifact
    ↓
References / Lineage
    ↓
Planner re-evaluation
    ↓
more Needs / more Tools
    ↓
Sufficiency Judge
    ↓
Response
```

### Goal

表达用户真正想得到什么，允许保留自由语言。

### Need

表达为了满足 Goal 仍缺少什么信息，可以动态生成。

### Artifact

Tool 的可复用输出；不仅能给 Response，也能成为其它 Tool 的输入。

### Reference

引用 user span、previous message、Artifact、Artifact field/row、Web evidence span、KnowledgeItem、SQL result、clarification answer 等，避免层层摘要造成信息损失。

### Action

真正进行 SQL、文件、网络、权限、持久知识写入时才进入严格 boundary。

## Tool 之间不再固定方向

新架构要求任何 Tool Artifact 都有机会成为另一个 Tool 的输入。

目标支持：

```text
Web → SQL
SQL → Web
Knowledge → SQL
SQL → Compute → Web
Web → Entity Resolution → SQL
DB → anomaly → Web research → DB re-analysis
```

例如 local Statcast 没有可靠 team membership，并不代表球队问题必须失败。

Planner 可以：

```text
roster / Web / MLB source
→ PLAYER_ID_SET Artifact
→ Statcast by canonical batter ids
→ recent performance Artifact
→ ranking / interpretation
```

反过来，数据库发现异常表现后也可以产生 Web research Need，再根据报道中的时间点回来重新计算。

## Artifact / Reference 新方向

Artifact 计划支持：

```text
artifact_id
kind
structured_data
text_content
exports
provenance
references
actual_scope
lineage
metadata
```

其中 `exports` 可以提供 Tool-to-Tool 可消费的结果，例如：

```text
PLAYER_ID_SET
TEAM_ROSTER
DATE_RANGE
ENTITY_MAPPING
STATISTICAL_RESULT
RANKED_ENTITY_SET
WEB_EVIDENCE
TRANSACTION_DATE
DERIVED_MEASURE
```

这不是要把所有 Artifact 类型固定死，而是给 Planner 一套可组合的数据流能力。

## Scope / Sufficiency 需要重写

独立 audit 证明“有 Evidence”不能代表“回答了 Goal”。

以后必须明确区分：

```text
requested_scope
actual_scope
```

Scope 至少要能表达：

- entity；
- population；
- time range；
- season/game type；
- team；
- measure；
- event population；
- source/data coverage。

Sufficiency 应基于 Goal coverage，而不是 Artifact 是否存在。

计划中的 CoverageAssessment 至少关注：

```text
entity coverage
temporal coverage
population coverage
measure coverage
evidence quality
supported claims
missing needs
core_goal_supported
```

`COMPLETE` = 核心 Goal 已被相关证据覆盖。

`LIMITED` = 有有用回答，但重要 gap 仍存在。

`WAITING_FOR_USER` = 必须由用户提供关键信息。

`FAILED` = 合理 recovery 已耗尽，仍无法形成有用受支持回答。

## Safe Analytical IR

数据库分析能力不能继续只由预注册 Metric 决定。

新的设计区分：

```text
Canonical Metric
→ MetricRegistry 负责长期标准定义

Ad-hoc Derived Analysis
→ 当前 Query 可以临时组合可信 DB 字段与安全操作
```

在 SQL action boundary 前，分析 Need 收敛成 Safe Analytical IR。

允许的能力方向包括：

```text
Source
Filter
Entity-set filter
Date filter
GroupBy
COUNT / COUNT_NON_NULL / COUNT_IF
AVG / SUM / MIN / MAX
DerivedExpression
Sort
Limit
Period comparison
显式建模的 safe lookup/join
```

派生表达式使用结构化 expression tree，不允许任意 SQL 字符串或 Python `eval`。

## Schema Catalog

真实数据库已经拥有字段名，因此新方向不再要求 cognition 层一直停留在人为抽象 metric 名称。

在 SQL boundary，分析计划可以收敛到 trusted Schema Catalog 中存在的：

```text
relation/table
field
type
grain
meaning
nullability
entity relationships
source coverage
allowed operations
```

不存在的 field 不能进入 SQL。

LLM 仍然不能直接提供 executable SQL。

执行路径保持：

```text
Analysis Need
→ Safe Analytical IR
→ SchemaCatalog validation
→ deterministic compiler
→ SQL guard
→ read-only execution
```

## Shared Knowledge 新治理方向

Shared Knowledge 不再被看成“Agent 搜到什么就缓存什么”。

必须分开：

```text
Runtime Evidence
Candidate Knowledge
ACTIVE / Approved Knowledge
```

读取路径：

```text
Planner / Entity Resolver / Semantic
→ ACTIVE KnowledgeStore
→ Knowledge Artifact
```

写入路径：

```text
Runtime discovery
→ CandidateKnowledge
→ Review Queue
→ Administrator Review
→ APPROVED
→ ACTIVE
```

Runtime Agent 没有直接提升为 ACTIVE 的权限。

## Knowledge 类型与 Scope

为了避免污染，Shared Knowledge 应区分：

```text
CANONICAL_FACT
ENTITY_ALIAS
DEFINITION
HISTORICAL_EVENT
RULE
COMMUNITY_REFERENCE
COMMUNITY_OPINION
SCOUTING_NOTE
TACTICAL_CONCEPT
```

特别是 contextual slang / meme / cultural reference 不能被当成全局 entity alias。

KnowledgeItem 计划携带：

```text
domain
language
locale/community
effective_from/to
authority
source refs
verification state
confidence
```

Candidate 冲突时不允许自动覆盖 existing ACTIVE knowledge。

## Shared Knowledge 与 Artifact Graph

Knowledge retrieval 也应该产生正常 Artifact，并带 provenance / refs。

这样：

```text
Knowledge → Planner
Knowledge → SQL
Knowledge → Web
```

都可以走同一套 Artifact Graph，而不是作为旁路 prompt context。

## Conversation 新方向

Follow-up 不应该靠固定短语特殊处理。

Conversation/session 需要保留：

```text
messages
active Goal
previous Goals
entity refs
scope selections
clarification decisions
reusable Artifact refs
current-run assumptions
```

这样“那去年呢？”、“换成季后赛呢？”、“只看左投呢？”等 follow-up 才是对已有 Goal/Artifact 的修改，而不是重新猜一遍完整意图。

## 测试策略变化

后续不能再把 Builder 提前见过的 Query 当主要泛化证据。

测试分三层：

```text
Known regression tests
Independent holdout / substitution / paraphrase tests
Real dogfooding
```

Independent reviewer 应在实现完成后再生成 holdout cases，并检查：

- 未见过的球员/球队；
- 不同年份；
- 中英不同表达；
- 新的 derived calculation；
- 新的 cross-tool workflow；
- follow-up 改写；
- unknown concept；
- scope mismatch；
- irrelevant evidence。

## 当前 Git 状态

### main

```text
35b47c4174e98460ebdbcd2ace46adfba36225c4
v0.1.0 released
```

### v0.2 development

```text
pi/v0.2-llm-first-runtime
7c3b6bdd426147e5cc7780900678bede7def913c
```

GitHub 已直接核验该远端分支存在，且没有合并到 main。

### 下一实现线

建议的新实现线：

```text
pi/v0.3-artifact-runtime
```

博客更新时尚未在远端观察到该分支，因此 Artifact-Driven Runtime 应标记为 **confirmed architecture direction / implementation pending**。

## 下一阶段

优先级已经从“再加一个 Semantic rule / 再加一个 Tool”改为：

1. 引入 Goal / Need / Reference / reusable Artifact；
2. 把 Planner 改成 Artifact/Dataflow Planner；
3. 支持 Artifact-to-Artifact Tool composition；
4. 建 Safe Analytical IR + trusted Schema Catalog；
5. 允许 ad-hoc derived calculations；
6. 重写 scope-aware Sufficiency / Objective terminal state；
7. 把 Web grounding / Claim support refs 纳入 Evidence Graph；
8. 重构 Shared Knowledge lifecycle / Candidate review / scope；
9. conversation persistence 与 reusable semantic state；
10. 完成稳定 checkpoint 后交给独立 Codex 生成未见过的 holdout tests。

## 本博客状态

截至 2026-09-17，博客增加第 11 篇文章，记录：v0.1.0 发布、真实 dogfooding、LLM-first v0.2、generalization audit，以及 Artifact-Driven General Analytical Runtime / Shared Knowledge Governance 的新方向。

历史文章保留当时设计背景；本页和 `decisions.md` 作为当前认知优先来源。
