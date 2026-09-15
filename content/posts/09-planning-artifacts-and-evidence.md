# Task Planner 与证据质量：从数据依赖到分层 Agent 架构

最近几轮讨论把总体架构收敛到可以 Architecture Freeze 的程度。重点不再是增加新模块，而是明确 Definition / Runtime State、Requirement / Artifact、Planner / Router / Orchestrator、Assessment / Sufficiency、Persistence / Context 和最终 Response 之间的边界。

> **2026-09-15 实现状态更新：** 这套宏观架构已经从“冻结设计”进入真实 Runtime。DeepSeek 完成主体实现，GPT-5.6 做 adversarial hardening，Pi 建 Shared Knowledge V1，Astra 将 hardened runtime 与 knowledge branch 真实合流。本文保留架构解释；最新落地过程与未完成的 live integration 见第 10 篇文章和 `current-state.md`。

## 1. 六个主层 + 贯穿能力

```text
User
 ↓
① Interaction
 ↓
② Normalization
 ↓
③ Planning & Orchestration
 ↓
④ Data & Tool
 ↓
⑤ Evaluation & Sufficiency
 ↓
⑥ Response
```

贯穿能力包括：

- Shared Knowledge & Context；
- Runtime State；
- Governance / Validation / Permission / Observability；
- Persistence / Checkpoint / Resume。

Architecture Layer 不等于 Python Package，但目前这些职责已经分别对应到真实模块。

## 2. Definition、Produced Knowledge 与 Runtime State 分开

```text
AnalysisObjective ─────────────── ObjectiveState
        │                              ▲
        ▼                              │ aggregate
ArtifactRequirement ─────────── RequirementState
        │                              ▲
        ▼                              │ evaluate
AgentTask → TaskExecution → Artifact → ArtifactAssessment
```

可以分成：

```text
Definition
- AnalysisObjective
- ArtifactRequirement
- AgentTask

Produced Knowledge
- Artifact
- ArtifactAssessment

Runtime State
- ObjectiveState
- RequirementState
- TaskExecution / Attempt
```

这一分离已经进入代码和 persistence/resume 流程。

## 3. Initial Requirement 不可修改

Requirement Decomposer 先于 Planner，把 Objective 拆成 semantic-atomic Initial Requirements：

```text
Requirement.origin
├── INITIAL
└── PLANNER_ADDED
```

Planner 可以增加 supporting Requirement，但不能删除、改写或降低 Initial Requirement 的业务语义，也不能用新增需求抬高原问题的完成门槛。

这条 invariant 已经被独立 audit 覆盖。

## 4. Planner 同时看 State 与经过筛选的 Artifact 信息

Planner Context 现在实际包含：

```text
Initial / Planner-added Requirements
RequirementStates
accepted Artifact index
ArtifactAssessment summaries
execution summary
round / budget
relevant Shared Knowledge
```

但不会默认接收整个 Runtime State、其它 run 的 Artifact 或全部 attempt history。

Astra integration 继续收紧 bounded context，避免 Planner 和 Judge 因 Shared Knowledge 加入后获得无关材料。

## 5. Planner 自己决定 PLAN / REPLAN / STOP

```text
PlanningDecision
├── PLAN
├── REPLAN
└── STOP_PLANNING
```

`planner_terminal` 在无外部变化时阻止 Orchestrator 重复调用 Planner。新的 clarification answer、permission、constraint revision、source 或 Artifact 可以通过明确 external-change reason 重新打开。

## 6. Router、SourceMapping 与 Orchestrator

Planner 回答“应该做什么”；Router 回答“Task 去哪里做”；Orchestrator 负责调度和生命周期。

当前实现已经把：

```text
Requirement.data_keys
→ SourceMappingResolver
→ ExecutionRoute
→ Router capability check
```

接入 Runtime。

Router 还可使用 `supported_data_keys` 判断某 Tool 是否真的能提供某类数据，防止“能产 EVIDENCE”被误解成“能产所有 Evidence”。

## 7. ArtifactAssessment：程序事实与 Judge 解释分层

```text
Artifact
→ Deterministic Validator
   ├── Hard Validation
   └── Soft Signals
→ Judge
→ ArtifactAssessment
```

Hard failure 不可被 LLM Judge 推翻。Soft signals 则允许结合 Requirement 解释 contextual usability。

同一 Artifact 可以针对不同 Requirement 产生不同 Assessment。

## 8. RequirementState / ObjectiveState 是投影，不是新的 Judge

```text
ArtifactAssessment
        ↓
Requirement State Service
        ↓
RequirementState ─────→ Planner
        ↓
Objective State Service
        ↓
ObjectiveState ───────→ Orchestrator
```

State 保存当前投影和 refs，不重复发明 Assessment/Execution 已经给出的底层原因。

## 9. COMPLETE / LIMITED / FAILED

`COMPLETE` 代表核心需求足够回答，并不要求所有 optional information 完美存在。

`LIMITED` 代表核心仍有缺口，但 Planner 已 terminal，已有证据足以形成有价值的受限回答。

`FAILED` 代表无法形成可靠的受限回答。

这一逻辑已经进入 deterministic state services 和 E2E tests，未来仍需要真实复杂查询校验业务合理性。

## 10. Response 只看 accepted products

```text
ResponsePackage
├── objective results
├── accepted Artifacts
├── accepted Evidence
├── critical Shared Knowledge
├── limitations
├── optional gaps
├── unresolved items
└── provenance
```

failed attempt、old plan、routing experiment、rejected Evidence、Judge internal reasoning 不进入 Response。

这条边界曾被 runtime audit 实际打破过一次：cross-objective accepted-evidence leakage。修复后已增加 regression coverage。

## 11. Checkpoint / Resume 已经进入真实 Interaction lifecycle

Checkpoint 是恢复坐标，而不是 giant state dump。

当前已经支持：

```text
ClarificationRequest
PermissionRequest
ConstraintRevisionRequest
      ↓
WAITING_FOR_USER
      ↓
checkpoint
      ↓
answer
      ↓
same-run resume
```

并处理 duplicate answer、stale permission、scope leakage 与重复 execution。

## 12. Control Plane、Knowledge Plane 与 Data Plane

当前物理边界进一步清楚：

```text
Baseball analytics PostgreSQL / Parquet-DuckDB
→ Data Plane
→ READ ONLY

OperationalStore
→ Runtime Control Plane

Knowledge Store
→ Shared Knowledge Plane
```

Shared Knowledge dev 默认使用 `.runtime/knowledge.db`，production 方向是 PostgreSQL `knowledge` schema；它不进入 `baseball_analytics`。

## 13. Retrieval 仍不是独立 Agent

```text
Shared Knowledge & Context
├── Knowledge Store / Sources
├── Metric Registry
├── Schema Registry
├── Source Mapping
├── Entity Dictionary
├── League Context
└── Context Management
    ├── Retrieve
    ├── Filter
    ├── Rank
    ├── Freshness
    ├── Project
    └── Deliver
```

当前优先 exact / alias / structured / full-text retrieval；RAG / pgvector 继续 deferred，直到真实自然语言召回问题证明需要它。

## 14. Shared Knowledge 已真实进入默认 Runtime

Astra integration 把 Knowledge Store 接入：

```text
Knowledge Store
→ EntityDictionary / MetricRegistry projection
→ KnowledgeContextSource
→ ContextService
→ Planner / Judge / Response bounded context
```

默认 integration tests 已覆盖 `DFA是什么意思？` 和 `道奇属于哪个分区？` 等知识型问题。

## 15. Synthetic Analytics 只能显式 Demo

SyntheticDataTool 只用于测试闭环。正常模式没有真实数据时不能偷偷使用 fake analytics；只有显式 `--demo` 才允许 synthetic source。

这把“系统能跑”与“结果来自真实数据”明确分开。

## 16. 从 Architecture Freeze 进入 v0.1 Integration

截至 2026-09-15，宏观职责边界没有发生根本改写，但项目阶段已经变化：

```text
Architecture Freeze
→ Implementation
→ Adversarial Hardening
→ Shared Knowledge V1
→ Integration
→ Real Data Verification
→ Final Review
→ v0.1 Release
```

当前真正的剩余价值集中在真实 PostgreSQL、历史 Parquet schema、Web provider E2E、复杂 MLB query 与安全发布到 `main`，而不是继续横向增加 Agent。

**来源：** S5、S6。
