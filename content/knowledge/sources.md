# 来源与覆盖范围

首版整理日期：2026-09-07；最近更新：2026-09-15。本文说明哪些材料被实际读取，哪些仅来自摘要，哪些已通过 GitHub 仓库直接核验。

## 来源登记

| 来源 ID | 材料 | 获取层级 | 可以支持什么 |
| --- | --- | --- | --- |
| S1 | 当前对话提供的 baseball agent 项目记忆与历史讨论摘要 | 摘要，非完整聊天 | 用户目标、偏好、讨论方向与历史报告状态 |
| S2 | 粘贴的文本 (1).txt，文件日期 2026-06-20 | 全文读取，共 251 行 | 四工具原型、直接 SQL 执行、联网截取、提示词与循环逻辑 |
| S3 | lvyneko_agent_workflow.md，整理日期 2026-09-05 | 全文读取，共 220 行；已有二次整理 | 外部学习方法及向本项目迁移的建议 |
| S4 | GitHub Pages 官方文档 | 2026-09-07 查询 | 个人站命名、构建与发布配置 |
| S5 | 2026-09-07 至 2026-09-15 当前 Baseball Agent 架构与实现讨论 | 当前会话直接可见，非历史全量导出 | Requirement/Artifact/State、Planner/Router/Orchestrator、Judge/Assessment、Persistence/Checkpoint、Shared Knowledge、Response Finalization、Architecture Freeze 与后续实现计划 |
| S6 | `CityuHK-wyj/baseball_agent` GitHub 仓库直接审计 | 2026-09-15 直接读取分支、提交、关键代码、测试、README、handoff、audit 文档与 compare metadata | Codex/DeepSeek/GPT-5.6/Pi/Astra 的真实实现与整合状态、测试证据、Shared Knowledge 物理结构、Runtime wiring、安全修复、live probe 状态与 Git release ancestry 问题 |

S2 的原始材料含私人配置，本博客只转述项目逻辑，不附原脚本。S3 是模型生成的二次整理，其关于作者的叙述未在本次重新逐项核验；没有将它作为用户已经确认的项目决策。S5 只覆盖本轮当前会话中直接可见的讨论，不应被理解为完整项目聊天导出。

S6 是本轮状态更新的重要变化：博客不再只依赖 Agent 自己的 Stop Report，而是直接检查了 GitHub 上的分支、真实 merge parent、commit message、关键实现文件与 integration / E2E tests。S6 可以证明“代码与 wiring 存在”，但不能替代本地 live PostgreSQL / DuckDB / Web provider 的真实运行验证。

## S6 直接核验的关键开发线

- `codex/architecture-implementation`：安全 Domain foundation；该安全开发线从旧 main 之外重建实现历史，用于排除旧 credential-bearing ancestry。
- `agent/deepseek-implementation-safe`：完整 Runtime 主体，实现 semantic → requirement → planning → routing → execution → assessment → state → response，以及 persistence/context/LLM seams 等。
- `gpt56/runtime-audit-hardening`：独立 adversarial audit，修复跨 Objective Evidence 泄漏、DuckDB filesystem guard 绕过、SourceMapping wiring、Web Evidence、LLM schema、Clarification / Permission 等问题。
- `agent/shared-knowledge`：Persistent Shared Knowledge V1，包含 MLB rules、glossary、metrics、30 teams/ballparks、players、community/source registry、freshness/versioning 与 KnowledgeContextSource。
- `astra/v0.1-integration`：存在真实双亲 merge commit，将 GPT-5.6 hardened runtime 与 Shared Knowledge 合流，并继续实现 ConstraintRevision、permission expiry、default Composition Root、bounded context、persistent metrics 与部分 live probe。

## 可识别的讨论与工程线索

- 2026-06-20《2025 MLB 季后赛焦点》：复杂两好球、高区快速球问题，以及 SQL 权限、实体绰号与架构整合。
- 2026-07-28《数据科学转Agent路径》：任务命名、标准信息格式、参数类型、artifact_id 维护成本、fields 与数据库字段约束。
- 2026-08-06 相关开发讨论：项目目录骨架、WSL 项目位置、编码逻辑解释。摘要显示骨架主要是占位符。
- 2026-08-31 可检索片段：追问“先做一个能跑通的最小版本”的含义。
- 2026-09-03 至 09-04 环境讨论：WSL 自动激活与启动慢、Git 访问、Docker、Redis。
- 2026-09-07 至 09-14：集中收敛 Planner、ToolResult、attempt history、checkpoint、Artifact data dependency、Evidence Extractor、Metric Registry、Judge、Requirement/Objective State、Persistence、Context、Response 与 Architecture Freeze。
- 2026-09-14 至 09-15：进入实际工程实现。DeepSeek 完成主体 Runtime；GPT-5.6 做独立攻击与 hardening；Pi 建 Shared Knowledge V1；Astra 把两条成熟开发线合并成 v0.1 integration candidate。

## 当前已直接核验的实现证据

S6 已直接看到或通过 commit / tests 核验：

- default `AnalysisPipeline` / Composition Root；
- Clarification → WAITING_FOR_USER → checkpoint → same-run resume；
- scoped PermissionRequest 与 expiry/replay protection；
- ConstraintRevisionRequest；
- SourceMappingResolver 进入 Orchestrator / Router；
- Web RawResult → Evidence → Artifact；
- cross-run / cross-objective Context isolation tests；
- hard deterministic validation veto；
- DuckDB path/URI/dynamic filesystem guard tests；
- persisted checkpoint / resume / RunMetrics；
- Shared Knowledge → EntityDictionary / MetricRegistry / ContextService；
- `DFA是什么意思？`、`道奇属于哪个分区？` 等默认 pipeline integration tests；
- synthetic analytics 只能通过显式 `--demo` 使用。

## 仍需谨慎解释的范围

以下不能因为代码或测试存在就写成“真实生产环境已验证”：

- 最近一次本地 `baseball_analytics` PostgreSQL live probe 不可用，完整 read-only E2E 仍待验证；
- Parquet 已有真实 bounded read probe，但复杂 Statcast schema 仍发现字段缺口；
- MLB Stats API 曾真实成功返回 reference data，但网络随后出现 timeout，完整 WebEvidenceTool live E2E 仍是 partial；
- Operational PostgreSQL adapter 已实现，但 production live path 尚未完整验证；
- Community source directory 中仍存在未重新 live-verified 的 creator/source；
- RAG / pgvector 仍有意 deferred，不应把 Structured Shared Knowledge 描述成已完成向量 RAG。

## Git / Release 特殊状态

S6 的 compare 检查显示旧 `main` 与当前安全 `astra/v0.1-integration` history 不是普通线性共同 ancestry。这与此前为排除 credential-bearing history 而重建安全实现线有关。

因此“最终 merge 到 main”仍属于待完成的 release integration 工作，不能把当前 Astra branch 误写成已经发布到 main。

## 公开参考链接

- [Baseball Agent GitHub 仓库](https://github.com/CityuHK-wyj/baseball_agent)
- [GitHub Pages 快速入门](https://docs.github.com/en/pages/quickstart)
- [创建 GitHub Pages 站点](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [配置 GitHub Pages 发布源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source)
- [已有资料引用的 lvyneko 学习笔记索引](https://github.com/lvy010/X-Plore)（本次未重验）
