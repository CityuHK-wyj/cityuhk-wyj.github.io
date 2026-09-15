# 从 Architecture Freeze 到可运行 v0.1：Baseball Agent 的多 Agent 落地过程

2026-09-15，Baseball Agent 从“宏观架构已经冻结、准备进入 Domain Modeling”跨到了新的阶段：核心 Runtime、Shared Knowledge、交互式恢复、权限治理、证据边界和默认 Composition Root 已经有了实际代码与回归测试，项目开始从架构原型进入 **v0.1 integration**。

这篇文章不再主要记录“应该怎样设计”，而是记录设计怎样被不同 Agent 分工实现、审计、攻击和重新整合，以及目前距离真正可用还差什么。

## 1. 先建立安全的实现基线

最早的 Codex 实现分支没有直接沿用旧的本地历史，而是建立了经过审阅的安全 Domain foundation。这样做的原因不是代码风格，而是旧本地 Git ancestry 曾出现 credential；安全开发线因此采用重建过的干净历史，并把旧的 credential-bearing ancestry 留在本地，不再推送。

这一阶段主要冻结了几个后续不能轻易破坏的 Domain invariant：Definition 与 Runtime State 分离、Initial Requirement 不可被 Planner 改写、分析数据库只读、遗留不安全路径 fail closed，以及后续开发必须有测试和 secret scan。

## 2. DeepSeek 把架构变成完整 Runtime

在安全基线之上，Pi / DeepSeek 完成了主体工程实现。原先博客中的主流程：

```text
Semantic Normalization
→ AnalysisObjective
→ Requirement Decomposer
→ ArtifactRequirement
→ Planner
→ Router
→ Tool Execution
→ Artifact
→ Deterministic Validation
→ Judge
→ ArtifactAssessment
→ RequirementState
→ ObjectiveState
→ CompletionReport
→ ResponsePackage
```

开始对应到真实 Python 模块、持久化对象和测试。

这一阶段还加入了：

- Feature Engine 与 Artifact lineage；
- Metric Registry、Schema Registry 与 SourceMapping；
- PostgreSQL / DuckDB 只读执行器与 SQL guard；
- OperationalStore、ArtifactStorage、Checkpoint、Resume；
- ContextService 与按用途投影的 ContextPackage；
- LLM Planner / Judge / Response 的 provider-neutral Protocol；
- CLI、E2E、Observability、AgentReport 与使用文档。

到这一阶段结束时，项目已经不是目录骨架，而是一个可以用 deterministic / fake source 跑完整闭环的 Agent Runtime。

## 3. GPT-5.6 的任务不是继续堆功能，而是攻击已有实现

之后的 `gpt56/runtime-audit-hardening` 刻意把已有实现和已有测试都当成不可信对象。

这一轮最重要的价值是证明“测试全绿”并不等于“架构边界真的成立”。它发现并修复了多个真正影响可靠性的漏洞，其中包括：

### Cross-objective accepted-evidence leakage

一个 Objective 已接受的 Evidence 曾可能进入另一个 Objective 的 ResponsePackage。修复后，Evidence 必须通过当前 Objective 的 Requirement refs 和 Assessment scope 才能进入 Finalization。

### DuckDB filesystem guard bypass

原有只读策略仍可能被 URI、动态文件参数和某些文件读取形式绕过。加固后，危险路径、外部 URI、扩展加载、ATTACH/COPY 等能力在执行前 fail closed。

### SourceMapping 只存在 Contract、没有真正控制 Runtime

SourceMappingResolver 被真正接入 Orchestrator 与 Router，随后又进一步收紧：mapped tool 是 capability constraint，不能被 Planner preference 换成同 source_kind 的其他工具。

### Web Evidence 进入正式证据链

Web 路径从：

```text
RawWebResult
→ EvidenceExtractor
→ Evidence
→ EVIDENCE Artifact
→ Validation / Judge
```

进入实际 Runtime，而不是让网页文本直接成为最终证据。

### LLM 输出不再被默认信任

Planner / Evidence 等 LLM 输出使用关闭 schema 与 invariant validation；Judge 仍不能覆盖 deterministic hard failure。

## 4. Clarification、Permission 与 Constraint Revision 变成真正的生命周期

这一阶段最能体现 Agent 与普通问答程序差别的，是 `WAITING_FOR_USER` 不再只是一个 UI 概念。

### Clarification

```text
ambiguous query
→ ClarificationRequest
→ InteractionRecord
→ WAITING_FOR_USER checkpoint
→ user answer
→ USER_CONFIRMED constraint
→ same-run resume
```

例如实体 resolver 返回多个 Hernandez 候选时，系统不会静默猜测；用户选择后仍然恢复同一个 run / objective，并禁止重复 confirmation 产生第二次 execution。

### Permission

```text
paid / high-cost source
→ PermissionRequest
→ WAITING_FOR_USER
→ approval / rejection
→ same-run resume
```

授权是 scoped 的：批准一个 PAID tool 不能顺便授权另一个 tool；System Policy 禁止的能力不能通过用户同意重新开启。随后又增加了 stale / expired permission 的验证。

### Constraint Revision

如果用户的 hard source constraint 阻止有价值的合法路径，Agent 不能偷偷放宽约束，而是：

```text
USER_CONSTRAINT blocks useful source
→ ConstraintRevisionRequest
→ WAITING_FOR_USER
→ accept / reject
→ same-run resume
```

接受后新约束被标记为 `USER_CONFIRMED`；拒绝则保留原约束。System Policy 仍不可重新协商。

## 5. Shared Knowledge 从“架构名词”变成真实知识层

另一条独立分支 `agent/shared-knowledge` 专门实现长期 Baseball Domain Knowledge。

它没有把 Knowledge 做成第二个 Statcast 仓库，也没有新增 Retrieval Agent，而是建立：

```text
knowledge/sources + knowledge/seed
        ↓
ingestion / validation / staging
        ↓
Persistent Knowledge Store
        ↓
authority / freshness / effective dates
        ↓
KnowledgeContextSource
        ↓
ContextService
```

当前 V1 的覆盖包括：

- 2026 Official Baseball Rules 的主要结构和编号规则；
- roster / transaction / CBA-sensitive 基础规则；
- 常用统计、sabermetrics、Statcast、pitch、plate-discipline、qualification、scouting 概念；
- 30 支 MLB 球队、30 个主场、league/division、双语 aliases 与 franchise lineage；
- active / historical notable player identity；
- awards、历史 era 与 postseason / league context；
- trusted source registry 与 community creators / discussion sources。

每条 KnowledgeItem 都能记录 source、authority、effective_from/to、as_of、last_verified、verification status 与 version。原则仍然是：

```text
Collected Knowledge != Active Knowledge
```

Web 抓到的内容要经过 validate / stage / activate，而不是直接进入正式 Context。

开发环境知识库存于 `.runtime/knowledge.db`；生产设计使用独立 PostgreSQL `knowledge` schema。它与只读 `baseball_analytics` Data Plane 分离。

## 6. Shared Knowledge 不是 RAG 的同义词

当前项目没有为了“像一个 AI 项目”而强行把全部 JSON 向量化。

对于：

```text
LAD → Los Angeles Dodgers
道奇 → LAD
DFA → Designated for Assignment
wRC+ → canonical metric definition
```

结构化 lookup、alias lookup 与 full-text 比 embedding 更准确。

RAG / pgvector 仍然被有意推迟。只有当真实使用证明自然语言语义召回明显不足时，再增加 semantic/vector retrieval；Embedding 是可重建索引，不是知识真相源。

## 7. Astra 完成两条成熟开发线的真正 Git 合流

`astra/v0.1-integration` 并不是照着 Stop Report 重新写一遍，而是产生真实双亲 merge commit，把：

```text
gpt56/runtime-audit-hardening
        +
agent/shared-knowledge
```

合成同一条 integration branch。

合流以后又继续补了：

- ConstraintRevisionRequest lifecycle；
- permission expiry / scope tightening；
- bounded Planner / Judge knowledge context；
- persistent RunMetrics events；
- Shared Knowledge → EntityDictionary / MetricRegistry projection；
- default Composition Root；
- CLI `answer` 对 clarification / permission / revision 的 same-run resume；
- `--demo` 显式 SyntheticDataTool，防止 fake analytics 被误认为真实数据；
- ToolCapability `supported_data_keys`，防止 Shared Knowledge 这种通用 EVIDENCE source 抢走 injury / live-data requirement。

## 8. 默认 Runtime 已经开始像一个真正系统

现在默认 Composition Root 会组装：

```text
Knowledge Store
Entity Dictionary
Metric Registry
Schema Registry
SourceMappingResolver
ContextService
Operational Store
Artifact Storage
Router / Tools
Assessment / Judge
Planner
AnalysisPipeline
```

Shared Knowledge 不再只是旁边的一组 JSON。

例如 integration test 已经要求：

```text
“DFA是什么意思？”
→ COMPLETE
→ evidence source = shared-knowledge
→ 回答包含 40-man roster 语义
→ 不能出现 synthetic result
```

以及：

```text
“道奇属于哪个分区？”
→ alias “道奇”
→ canonical entity LAD
→ National League West
```

反过来，`Judge injury` 这类动态问题不能被 Shared Knowledge 静态身份资料冒充完成；如果只有受限的 paid injury provider，则 Runtime 应产生 PermissionRequest。

## 9. Synthetic Data 被降级为显式 Demo

SyntheticDataTool 仍然保留，因为它非常适合测试完整 Agent loop。但默认使用时不能偷偷以假数据回答真实棒球问题。

因此正常：

```bash
python -m app.cli ask "Judge最近30天表现怎么样？"
```

不应自动使用 synthetic analytics。

只有显式：

```bash
python -m app.cli ask "Judge最近30天表现怎么样？" --demo
```

才允许测试数据源进入执行。

这条边界很重要：**Demo 可以模拟执行，不能伪装成 Evidence。**

## 10. 当前真实验证情况

“架构实现完成”和“所有真实来源验证完成”仍然是两件事。

截至 2026-09-15：

- 单元 / integration / adversarial suite 已经从最早 15 个测试增长到 300+ 级别，开发分支持续保持全绿 checkpoint；
- 真实 Parquet 已成功进行 bounded read probe，但复杂 high-zone 查询暴露出历史 schema 缺少 `sz_bot / sz_top` 一类字段，需要 SchemaRegistry / Feature logic 适配；
- MLB Stats API 曾成功取得 30 队 reference 数据，但后续网络请求存在 timeout，因此 WebEvidenceTool live E2E 仍不能算完整验证；
- 本地 `baseball_analytics` PostgreSQL 在最近一次 integration probe 时连接不可用，因此仍需真实 read-only E2E；
- Operational PostgreSQL adapter 已有 contract-level 实现，但 production live path 仍需验证。

所以当前状态更准确地叫：

> **architecture-complete / heavily-tested v0.1 integration candidate**

而不是 production-ready Agent。

## 11. 一个新的 Git 发布问题：安全开发线与 main 历史不相连

在审计仓库时发现：当前安全实现线是为排除旧 credential ancestry 而重建的 history，因此 `main` 与 `astra/v0.1-integration` 不能简单理解成“main 落后若干 commits”；它们目前没有普通共同祖先。

这意味着最终发布到 `main` 不能草率使用普通 fast-forward 思维。

更安全的发布策略是：完成最后 review 后，在 `main` 上生成一个明确的 **v0.1 reviewed snapshot / release commit**，让 main 保留稳定发布线；完整研发历史继续由各安全开发分支保留。是否采用这种 snapshot 发布方式，将在最终 release integration 阶段确认。

## 12. 现在真正剩下的工作

当前最有价值的工作已经不是继续增加新的 Agent 或复杂基础设施，而是验证真实世界路径：

1. 接通并验证 `baseball_analytics` PostgreSQL 的只读 E2E；
2. 对齐 2015–2023 Parquet 的真实 schema、SchemaRegistry 与 Feature Engine；
3. 跑通“两好球后 >95 mph 高区快速球 EV Top 5 + salary value”这种跨本地数据和外部 Evidence 的复杂问题；
4. 完成 WebEvidenceTool 的真实 provider E2E；
5. 清理 README / handoff / development-status 中已经过时的历史状态；
6. 最终 architecture / security / integration review；
7. 采用安全方式发布到 `main` 并标记 v0.1。

## 13. 这次多 Agent 协作真正带来的价值

不同 Agent 没有只做重复的“继续开发”：

```text
Codex
→ safe domain foundation

DeepSeek
→ broad architecture implementation

GPT-5.6
→ adversarial runtime audit / hardening

Pi Shared Knowledge
→ MLB domain knowledge layer

GPT-6 Astra
→ integration / composition / remaining lifecycle
```

这种分工最有价值的地方不是“模型越多越好”，而是实现者和审计者相互独立。DeepSeek 的绿色测试没有阻止 GPT-5.6 找到 evidence leakage 和 filesystem bypass；Shared Knowledge 独立开发后再由 Astra 合流，也减少了同时修改 Runtime 核心的冲突。

项目下一阶段因此从：

```text
Architecture Freeze
→ Domain Modeling
→ Implementation
```

正式进入：

```text
Integration
→ Real Data Verification
→ Final Review
→ v0.1 Release
```

**来源：** S5、S6。S6 为 2026-09-15 对 `CityuHK-wyj/baseball_agent` GitHub 仓库、分支、提交、关键代码、测试与 handoff 文档的直接审计。
