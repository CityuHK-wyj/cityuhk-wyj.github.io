# 来源与覆盖范围

首版整理日期：2026-09-07；最近更新：2026-09-18。本文说明哪些材料被实际读取，哪些来自当前讨论 / Stop Report，哪些已通过 GitHub 仓库直接核验。

## 来源登记

| 来源 ID | 材料 | 获取层级 | 可以支持什么 |
| --- | --- | --- | --- |
| S1 | 当前对话提供的 baseball agent 项目记忆与历史讨论摘要 | 摘要，非完整聊天 | 用户目标、偏好、讨论方向与历史报告状态 |
| S2 | 粘贴的文本 (1).txt，文件日期 2026-06-20 | 全文读取，共 251 行 | 四工具原型、直接 SQL 执行、联网截取、提示词与循环逻辑 |
| S3 | lvyneko_agent_workflow.md，整理日期 2026-09-05 | 全文读取，共 220 行；已有二次整理 | 外部学习方法及向本项目迁移的建议 |
| S4 | GitHub Pages 官方文档 | 2026-09-07 查询 | 个人站命名、构建与发布配置 |
| S5 | 2026-09-07 至 2026-09-15 Baseball Agent 架构与实现讨论 | 当前会话直接可见，非历史全量导出 | Requirement/Artifact/State、Planner/Router/Orchestrator、Judge/Assessment、Persistence/Checkpoint、Shared Knowledge、Response Finalization、Architecture Freeze 与 v0.1 implementation 计划 |
| S6 | `CityuHK-wyj/baseball_agent` GitHub 仓库直接审计（截至 2026-09-15） | 直接读取分支、提交、关键代码、测试、README、handoff、audit 文档与 compare metadata | Codex/DeepSeek/GPT-5.6/Pi/Astra 的真实实现与整合状态、Shared Knowledge V1、Runtime wiring、安全修复、当时 live probe 状态与 Git release ancestry 问题 |
| S7 | 2026-09-16 至 2026-09-17 当前讨论、用户真实 dogfooding 输出、Pi/Codex Stop Reports | 当前会话直接可见；Stop Report 属于 agent/reviewer 报告，不自动等同远端仓库已核验 | v0.1 release 过程、semantic architecture 演进、真实 CLI 失败、dual-LLM、LLM-first/open-world 讨论、anti-shortcut/generalization audit 报告、Artifact-Driven Runtime 与 Shared Knowledge Governance 新方向 |
| S8 | 2026-09-17 对 `CityuHK-wyj/baseball_agent` 与博客仓库的 GitHub 直接复核 | 直接核验 `main`、`v0.1.0` tag、`pi/v0.2-llm-first-runtime` branch/commit，以及博客当前内容 | v0.1.0 已发布事实、adoption commit、v0.2 远端实现 checkpoint、博客更新前状态；不能证明尚未推送/远端不可见的 Codex audit branch 或未来 v0.3 实现 |
| S9 | 2026-09-17 至 2026-09-18 当前讨论、v0.3–v0.10 实现/Stop Reports、developer-mode dogfooding trace 与本轮架构复盘 | 当前会话与用户提供的运行输出；最新 v0.10 远端分支本次未在 GitHub 观察到 | Artifact Runtime hardening、Evidence Routing、Partial Sufficiency、Sandboxed Python、Lossless Semantic、Planner/Executor 边界缺陷，以及下一轮大范围重写设计基线 |

S2 的原始材料含私人配置，本博客只转述项目逻辑，不附原脚本。S3 是模型生成的二次整理，其关于作者的叙述未在本次重新逐项核验；没有将它作为用户已经确认的项目决策。S5/S7 只覆盖本轮可见讨论，不应被理解为完整项目聊天导出。

## 状态表达规则

本博客继续区分：

```text
讨论已确认 / confirmed direction
实现存在 / implemented
仓库直接核验 / repository verified
真实来源已运行 / LIVE_VERIFIED
独立 review report
待实现 / implementation pending
```

Agent 自己的 Stop Report 可以作为工程线索，但不能自动替代独立 GitHub/live verification。

## S6 已直接核验的关键开发线

- `codex/architecture-implementation`：安全 Domain foundation；该安全开发线从旧 main 之外重建实现历史，用于排除旧 credential-bearing ancestry。
- `agent/deepseek-implementation-safe`：完整 Runtime 主体，实现 semantic → requirement → planning → routing → execution → assessment → state → response，以及 persistence/context/LLM seams 等。
- `gpt56/runtime-audit-hardening`：独立 adversarial audit，修复跨 Objective Evidence 泄漏、DuckDB filesystem guard 绕过、SourceMapping wiring、Web Evidence、LLM schema、Clarification / Permission 等问题。
- `agent/shared-knowledge`：Persistent Shared Knowledge V1，包含 MLB rules、glossary、metrics、30 teams/ballparks、players、community/source registry、freshness/versioning 与 KnowledgeContextSource。
- `astra/v0.1-integration`：真实双亲 merge commit，将 hardened runtime 与 Shared Knowledge 合流，并继续实现 ConstraintRevision、permission expiry、default Composition Root、bounded context、persistent metrics 与部分 live probe。

## S8 最新直接核验

2026-09-17 重新检查 GitHub：

### v0.1 release

`main` 当前指向：

```text
35b47c4174e98460ebdbcd2ace46adfba36225c4
Adopt Baseball Agent v0.1 dual semantic runtime
```

该 commit 的 parent 是旧 `main @ c93953d...`；发布线没有使用 unrelated-history merge。

同时存在 annotated `v0.1.0` tag。

因此此前 S6 中“v0.1 尚未进入 main”的状态已经过时，应由 S8 覆盖。

### v0.2 LLM-first branch

远端存在：

```text
pi/v0.2-llm-first-runtime
HEAD 7c3b6bdd426147e5cc7780900678bede7def913c
```

commit message 直接记录了：conversation service、LLM cognition、live Web research、batting/pitching tools、entity lookup、strict SQLAnalysisRequest boundary、CandidateKnowledge governance 与 interactive chat CLI。

它仍未合并到 `main`。

### Codex generalization audit

当前讨论提供了 `GENERALIZATION_AUDIT_BLOCKED` Stop Report，包括 unrelated evidence / date scope / team population / dropped constraint 等 P1/P2 findings。

更新博客时，通过 GitHub connector 没有观察到报告中命名的远端 audit branch。因此审计结论在博客中标记为 **review report supplied in S7**，不伪称已由 S8 直接核验其 commit/tree。

### Artifact-Driven Runtime

`pi/v0.3-artifact-runtime` 是当前讨论已经确认的下一实现方向，但本次 GitHub 检查时尚未观察到远端分支。因此当前只能写成：

```text
confirmed architecture direction / implementation pending
```

不能写成 implemented。

## 当前讨论确认的新架构方向

S7 支持以下已经明确确认、但需要下一实现线落地的方向：

- Runtime 中心从 SemanticCandidate / fixed Requirement pipeline 转向 Goal / Need / Artifact / Reference / Action；
- 固定通信 Envelope + flexible payload + explicit references；
- Planner 成为 Artifact/Dataflow Planner，而不是一次性 Tool selector；
- Web / DB / Knowledge / Compute 可双向、多步组合；
- Tool output 需要 reusable exports / Artifact refs；
- requested_scope 与 actual_scope 分离；
- Sufficiency 以 Goal coverage 为核心，而不是“有 Evidence 即完成”；
- MetricRegistry 只定义 canonical reusable metrics，不限制 ad-hoc analysis；
- 数据库执行前使用 Safe Analytical IR + trusted Schema Catalog 收敛；
- LLM 不直接产生 trusted executable SQL；
- Shared Knowledge 分 Runtime Evidence / CandidateKnowledge / ACTIVE approved knowledge；
- runtime agent 可发现知识，但不能自行提升为 ACTIVE；
- contextual slang/community reference 与真正 alias 必须区分；
- Builder 已知 regression 与独立 holdout/generalization evaluation 分离。

## 仍需谨慎解释的范围

- `pi/v0.2-llm-first-runtime` 的存在和 commit 内容已由 S8 核验，但其 Stop Report 中全部 live 结果没有在本博客更新任务里逐项重新执行；
- Codex `GENERALIZATION_AUDIT_BLOCKED` 是 S7 中的独立 reviewer report；对应远端 audit branch 本次未观察到；
- Artifact-Driven Runtime / Safe Analytical IR / 新 Shared Knowledge lifecycle 尚未实现，不能写成代码现状；
- Operational PostgreSQL production control plane 仍不是本轮已重新 live 验证的事实；
- RAG / pgvector 仍无必要被描述为当前架构核心。

## 可识别的工程演进

- 2026-06 至 2026-09-07：从四工具脚本原型、数据源与直接 SQL 思路进入 Agent architecture。
- 2026-09-07 至 09-15：Requirement/Artifact/State、Planner/Router/Orchestrator、Judge、Persistence、Context、Shared Knowledge 收敛并实现。
- 2026-09-15 至 09-17：真实 PostgreSQL / Parquet、semantic hardening、dual semantic runtime 与 v0.1.0 release。
- 2026-09-17：真实 dogfooding 证明自然语言入口和 generalization 不足；v0.2 尝试 LLM-first/open-world runtime；独立 audit 又证明 linear Tool flow、弱 scope/sufficiency 与 predefined analytics 仍限制泛化；架构进一步转向 Artifact-Driven General Analytical Runtime。

## 公开参考链接

- [Baseball Agent GitHub 仓库](https://github.com/CityuHK-wyj/baseball_agent)
- [本博客 GitHub 仓库](https://github.com/CityuHK-wyj/cityuhk-wyj.github.io)
- [GitHub Pages 快速入门](https://docs.github.com/en/pages/quickstart)
- [创建 GitHub Pages 站点](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [配置 GitHub Pages 发布源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source)


## S9 当前架构重写基线

2026-09-18 的最新 developer-mode trace 证明，Lossless Semantic 已经能保留用户意图，但 Planner 仍在过早生成 physical schema / Safe IR，并出现 Need dependency 到 Artifact binding 断裂、pseudo export reference、重复 replan、criticality 漂移等问题。

因此当前准备冻结的新责任边界是：

~~~text
Semantic
→ preserve intent

Planner
→ decide Need / capability / dependency

Runtime Binder
→ resolve real Artifact exports

Tool Adapter / Compiler
→ perform strict execution narrowing

Judge / State
→ evaluate evidence sufficiency
~~~

该方向是下一次大范围代码重写的 design baseline。最新 v0.10 分支本次没有通过 GitHub connector 在远端观察到，因此实现状态仍按 implementation report / dogfood observed 记录，而非 repository verified。
