# 从 v0.1 的“安全可执行”到 Artifact-Driven Runtime：Baseball Agent 为什么再次重构

2026-09-17，Baseball Agent 经历了一次比 v0.1 发布更重要的认知变化：项目已经证明自己可以安全地执行真实 PostgreSQL / Parquet 分析，也已经把 LLM 放进语义理解、规划和回答链路，但真实 dogfooding 与独立 generalization audit 又证明，**“能安全执行一个被正确结构化的问题”并不等于“能作为开放世界 Baseball Agent 解决用户真正会问的问题”。**

这一轮没有推翻 v0.1 的安全基础，而是重新确定了 Runtime 的中心：从 `SemanticCandidate / Requirement -> Tool`，转向 **Goal -> Need -> Artifact -> Reference -> Action**。

> **状态说明：** v0.1.0 已发布到 `main`；`pi/v0.2-llm-first-runtime` 已实现并推送，但没有合并。本文后半部分的 Artifact-Driven General Analytical Runtime 是 2026-09-17 已确认的新架构方向，准备进入下一轮实现；不能把它写成已经落地。

## 1. v0.1 真正完成了什么

v0.1 最重要的成果不是“支持多少棒球问题”，而是建立了可信执行边界。

发布线最终采用 reviewed tree adoption，而不是把曾经存在 credential 风险的研发 ancestry 强行接回 `main`。当前 GitHub `main` 已指向 adoption commit `35b47c4...`，并存在 `v0.1.0` tag。

这一版本已经具备：

```text
Dual semantic extraction / review
→ deterministic semantic validation
→ Planner / Router
→ trusted field mapping
→ guarded SQL / DuckDB
→ read-only data sources
→ Artifact / Assessment
→ Response
```

真实 Statcast PostgreSQL 与历史 Parquet 已跑通；SQL AST guard、read-only role、DuckDB filesystem sandbox、checkpoint/resume、cross-run isolation 等安全边界也经过多轮 adversarial review。

换句话说，v0.1 回答了一个重要问题：

> **如果我们已经知道用户的问题应该怎样精确执行，Agent 能不能安全、可追溯地完成它？**

答案已经接近“可以”。

## 2. Dogfooding 暴露了另一个问题

真正开始像普通用户一样提问后，问题迅速暴露。

用户并不会总是说：

```text
2025 regular season
fastballs >= 95 mph
MAX exit velocity
minimum 20 BBE
```

更自然的问题往往是：

```text
谁最近打得更好？
为什么这个投手今年这么强？
某支球队最近哪些打者最有威胁？
这个中文棒球梗指什么？
2023 和 2025 的表现有什么变化？
```

这类问题包含：

- 模糊评价词；
- 未知实体与社区 slang；
- 多来源信息；
- 临时分析定义；
- 数据库没有直接列名的派生计算；
- 当前 roster / transaction / injury 等动态集合；
- 需要“先查出异常，再上网找解释，再回来重新计算”的循环。

如果系统要求所有含义一开始就完全压进封闭 schema，最常见的结果不是“更可靠”，而是：

```text
unknown
→ unresolved requirement
→ FAILED
```

这与真正 Agent 的目标相反。

## 3. 单纯扩大 LLM 权限仍然不够

v0.2 的第一步是把 cognition 放开：LLM 可以接收 raw query，产生自由文本的 `user_goal / semantic_brief / analysis_strategy`，Planner 可以做 Web research、batting/pitching tool 调用，CLI 也开始支持 conversation。

远端 `pi/v0.2-llm-first-runtime @ 7c3b6bd...` 已经真实存在，其 commit 明确实现了：

- application-level conversation service；
- LLM understanding / planning / composing；
- live Web research；
- batting / pitching stats；
- entity lookup；
- strict `SQLAnalysisRequest` boundary；
- CandidateKnowledge governance；
- interactive `chat` CLI。

但随后独立 anti-shortcut / generalization audit 仍然报告 `GENERALIZATION_AUDIT_BLOCKED`。

关键问题不是模型不会说自然语言，而是 Runtime 内核仍保留了过多旧假设：

- 有 Evidence 就可能过早 COMPLETE；
- 用户要最近 30 天，却可能拿全季统计作答；
- team population 可能通过 city matching 近似，导致同城球队混淆；
- unsupported explicit constraint 可能被 drop/default；
- Web snippet 可能在 claim-level grounding 不足时进入回答；
- local analytics 仍偏向 predefined metric lookup；
- deterministic fallback 可能包含已知 phrase 的特殊处理；
- follow-up conversation 缺少真正可复用的 semantic state。

这说明：

> **把 LLM 放到 pipeline 前面，不会自动把线性 pipeline 变成 Agent。**

## 4. 新中心：Goal / Need / Artifact / Reference / Action

下一轮架构的中心不再是“解析出一个完整 Query Object”。

新的逻辑是：

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

表达用户真正想得到什么，可以保留相当自由的自然语言。

### Need

表达“为了回答 Goal，现在还缺什么信息”。Need 可以动态产生，而不是全部在最开始枚举。

### Artifact

任何 Tool 的可复用输出。它不只是 Response 的材料，也可以成为另一个 Tool 的输入。

### Reference

把用户原句、Web evidence span、SQL result、Artifact field、clarification answer 等串在一起，减少一次次 LLM summary 带来的信息损失。

### Action

真正要执行数据库、文件、网络或其他有权限/正确性风险的动作时，才进入严格 deterministic boundary。

## 5. 固定 Envelope，不固定思考内容

这一轮并不是“全部改成自由字符串”。

更合适的是：

> **Fixed envelope + flexible payload + explicit references.**

例如不同组件之间可以统一传递：

```text
id
kind
objective
structured
text
references
provenance
confidence
status
metadata
```

其中：

- `structured` 保存已经确定、适合程序处理的信息；
- `text` 保存 user goal、analysis strategy、task objective 等开放语义；
- `references` 保留信息来源；
- `provenance` 记录谁产生、从哪里获得。

这样接口保持稳定，但不会要求所有自然语言概念提前变成 enum。

## 6. References 是防止信息损失的关键

过去一个容易忽视的问题是：

```text
LLM A 理解用户
→ 总结给 Planner
→ Planner 再总结给 Tool
→ Tool 结果再总结给 Judge
→ Response 再总结一次
```

每一步都可能丢失限制条件。

新的方向是让信息携带引用。

例如用户明确说“至少 20 个 BBE”，后续计算可以保存：

```text
qualification = 20
source_ref = user-span-17
```

Web 根据数据库异常寻找解释时，也可以直接引用：

```text
artifact:recent-statcast-change
```

而不是重新用自然语言抄一遍结果。

最终重要 Claim 应尽量能够沿着：

```text
Response Claim
→ Derived Artifact
→ Source Artifact
→ Web evidence span / SQL result / KnowledgeItem
```

回溯。

## 7. Tool 不再有固定调用方向

Web 不只是 SQL 的 fallback，SQL 也不是永远的第一步。

工具之间应该通过 Artifact 接力：

```text
Web → SQL
SQL → Web
Knowledge → SQL
SQL → Compute → Web
Web → Entity Resolution → SQL
DB → anomaly → Web → DB re-analysis
```

例如一支球队的 current roster 不一定存在于 Statcast pitch table 中。

Planner 可以：

```text
Roster / Web
→ PLAYER_ID_SET Artifact
→ local Statcast
→ recent performance Artifact
→ ranking / interpretation
```

反过来，如果数据库先发现某打者最近对四缝线表现突然改善：

```text
SQL Artifact
→ Web research：近期是否有 stance / approach / injury recovery 报道？
→ Web Artifact
→ 如果报道给出调整日期
→ SQL 按日期前后重新计算
```

真正的中心是 Planner + Artifact Graph，而不是某一个“主 Tool”。

## 8. 数据库不应该只能回答预定义 Metric

另一个需要修正的旧假设是：

```text
用户问题
→ MetricRegistry 有没有这个指标？
→ 没有就无法本地分析
```

但 Statcast 数据本身是 pitch-level raw data。很多用户问题应该通过已有字段临时组合出来。

因此新的原则是：

```text
MetricRegistry
→ 定义长期 canonical metric 的标准含义

Ad-hoc Analysis
→ 允许当前 Query 临时组合可信字段和安全运算
```

例如数据库没有一个叫 `best_at_high_fastballs` 的字段，但完全可以从：

```text
release_speed
pitch_type
plate_z / sz_top
launch_speed
batter_id
balls / strikes
game_date
```

组合出一个临时分析。

## 9. Safe Analytical IR：自由规划，严格执行

LLM 仍然不应该直接产生可信 SQL。

新的数据库边界应该是：

```text
Analysis Need
→ Safe Analytical IR
→ Schema Catalog validation
→ deterministic SQL compiler
→ SQL guard
→ baseball_readonly
```

IR 可以比旧的 `SQLAnalysisRequest` 更有表达力，但仍然是封闭的操作集合，例如：

```text
Filter
Entity-set filter
Date filter
GroupBy
COUNT / COUNT_IF / AVG / SUM / MIN / MAX
DerivedExpression
Sort
Limit
Period comparison
safe lookup / join（仅显式建模时）
```

派生指标也使用 expression tree，而不是字符串 SQL。

例如 hard-hit rate 可以表达为：

```text
count_if(launch_speed >= threshold)
/
count_non_null(launch_speed)
```

这让分析能力扩大，同时仍然禁止 arbitrary SQL、arbitrary Python expression 和 hallucinated column。

## 10. Schema Catalog 负责“收敛到真实数据库”

我们已经有真实数据库字段名，因此不需要在 cognition layer 里过早限制语言。

真正准备执行时，再把分析计划收敛到受信任的 `SchemaCatalog`：

- relation / table；
- field；
- type；
- grain；
- meaning；
- nullability；
- entity relationship；
- source coverage；
- allowed operations。

LLM 可以自由理解“球速”“击球质量”“高区”“最近表现”，但进入 SQL 边界后只能使用 catalog 中存在的字段和 operation。

这就是：

> **Flexible cognition, deterministic execution.**

## 11. Scope 必须变成 Artifact 的一等属性

Codex generalization audit 暴露的一个核心问题是：Evidence 相关，不代表 Evidence 回答了问题。

因此以后必须区分：

```text
requested_scope
vs
actual_scope
```

例如用户要最近 30 天，而 batting tool 只返回全季：

```text
requested = last_30_days
actual = full_season
```

这条 Artifact 仍可以提供背景，但不能自动满足核心 Need。

Sufficiency 应检查：

- entity coverage；
- temporal coverage；
- population coverage；
- measure coverage；
- evidence quality；
- missing needs。

`COMPLETE` 的含义重新回到：**核心 Goal 已被相关证据覆盖**，而不是“有一些 Evidence”。

## 12. Shared Knowledge 也要进入同一套 Artifact / Governance 模型

Shared Knowledge 不应该是 Web 搜索的自动缓存。

需要彻底分开：

```text
Runtime Evidence
Candidate Knowledge
Approved / ACTIVE Knowledge
```

读取路径：

```text
Planner / Semantic / Entity Resolver
→ ACTIVE KnowledgeStore
→ Knowledge Artifact
```

写入路径：

```text
Runtime discovery
→ CandidateKnowledge
→ Admin Review
→ APPROVED
→ ACTIVE
```

Agent 可以发现知识、当前 Query 可以使用 Web Evidence，但 Agent 没有权决定“以后系统都应该相信它”。

## 13. Alias、事实、社区梗不能混在一起

Shared Knowledge 还需要更明确的类型和 scope，例如：

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

尤其要区分：

```text
真正 alias
```

和：

```text
特定语言 / 社群 / 时代下的 meme、讽刺和 cultural reference
```

知识条目还应携带：

```text
domain
language
locale/community
effective dates
authority
source refs
verification state
```

这样某个中文棒球社区用语不会污染其它语境下的实体解析。

## 14. CandidateKnowledge 必须管理员审核

这一条已经从“建议”升级为明确方向：

> **Runtime agents may discover knowledge, but may not promote discovered knowledge into authoritative Shared Knowledge.**

Candidate 可以保存：

- proposed type；
- proposed meaning/relation；
- scope；
- evidence Artifact refs；
- evidence spans；
- confidence；
- originating run/query；
- conflicts with existing knowledge。

管理员再执行 Approve / Edit & Approve / Reject / Merge / Supersede。

“当前回答可以引用”与“永久知识可以激活”是两个不同判断。

## 15. 独立审计还改变了测试策略

另一个教训是 evaluation leakage。

如果 Builder 一开始就看到全部验收 Query 和预期答案，很容易无意中形成：

- phrase-specific regex；
- known entity shortcut；
- canned search；
- 弱 assertion；
- 为固定例子适配的 fallback。

因此后续测试分成：

```text
Known regression tests
→ 防止历史 bug 回归

Independent holdout / substitution tests
→ Builder 不提前看到

Real dogfooding
→ 用户自然提出的问题
```

Codex 的角色不再只是重复跑已有 suite，而是主动检查：

> 如果把所有熟悉的球员、年份、球队、表达方式换掉，这个系统是否仍然工作？

## 16. 当前真实状态

截至 2026-09-17：

### 已发布

```text
main @ 35b47c4...
v0.1.0
```

v0.1 是安全、可执行、真实数据路径已经验证的基线。

### 已实现但未合并

```text
pi/v0.2-llm-first-runtime @ 7c3b6bd...
```

它已经扩展 Web、conversation、batting/pitching tools、CandidateKnowledge 和 LLM-first cognition，但 generalization audit 证明不能直接把它当成下一版产品。

### 独立审计报告

本轮讨论中收到 Codex `GENERALIZATION_AUDIT_BLOCKED` 报告，指出 P1/P2 generalization 问题。博客更新时对应远端 audit branch 尚未通过 GitHub connector 观察到，因此这里把审计结论记录为“本轮 review report”，而不是伪称已直接核验其远端 commit。

### 已确认、待实现的新方向

```text
Artifact-Driven General Analytical Runtime
```

核心为：

```text
Goal / Need Graph
Artifact / Reference
Artifact-to-Artifact composition
Safe Analytical IR
Schema Catalog
scope-aware Sufficiency
Claim grounding
Shared Knowledge governance
```

下一步应先实现稳定 checkpoint，再让独立 reviewer 生成 Builder 未见过的 holdout cases。

## 17. 这轮重构真正改变的是什么

v0.1 的设计问题是“如何不让 LLM 做危险的事”。

下一阶段的问题变成：

> **如何让 LLM 有足够自由解决开放问题，同时让证据、计算和真实动作始终可追溯、可约束？**

最终的边界不应该画在“自然语言能不能进入 enum”这里，而应该画在：

```text
理解 / 规划 / 研究
→ 可以开放

证据引用 / scope / lineage
→ 必须保留

SQL / 文件 / 网络 / 权限 / 永久知识写入
→ 必须经过明确 deterministic / governance boundary
```

这比单纯增加更多 Agent 或更多 prompt rule 更接近项目最终需要的形态：一个能跨数据源调查、计算、验证和解释的 **general Baseball analytical agent**。

**来源：** S7、S8；历史背景参见 S5、S6。
