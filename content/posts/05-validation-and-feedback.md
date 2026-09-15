# 可靠的 Agent 循环：零行、错误与低置信度

项目偏好的工作顺序逐渐明确：先获取与 Objective 相关的数据，让程序和专门的质量评审节点判断这些数据是否足以进入主分析上下文；必要时补查其他来源，再根据 Requirement / Objective 状态决定继续、受限回答或停止。

> **2026-09-15 实现状态更新：** 本文最初是设计原则。S6 对当前仓库的直接审计确认，Validator、Judge、ArtifactAssessment、Requirement/Object State Service、ResponsePackage、Web Evidence、SQL/DuckDB guard 都已经进入 Runtime；GPT-5.6 还通过 adversarial audit 修复了跨 Objective Evidence 泄漏和 DuckDB filesystem bypass 等真实问题。最新工程过程见第 10 篇文章。

## Validation 是横切能力

Validation 不只是一层 SQL 检查，而是贯穿：

```text
User Input → input / policy validation
Semantic Output → entity / constraint validation
Planner Output → plan / invariant validation
SQL / Tool Call → execution validation
ToolResult → result validation
Artifact → quality validation
Final Report → claim / evidence boundary
```

因此 Validation / Policy 继续属于 cross-cutting governance。

## PostgreSQL / DuckDB 是只读分析资源

数据库修改权限属于系统管理员，不属于业务用户。

当前 guard 已专门测试并阻断：

- DML / DDL；
- CTE hidden mutation；
- multi-statement SQL；
- DuckDB ATTACH / COPY / extension loading；
- path traversal、URI 与动态文件路径绕过。

用户即使明确批准，也不能覆盖 `SYSTEM_POLICY` 打开写权限。

## 0 rows 不是 Tool failure

Runtime 区分执行是否成功与业务是否满足：

```text
SUCCESS
NO_DATA
POLICY_REJECTED
TECHNICAL_FAILURE
```

`retryable` 属于 Tool 层；`recoverable` 属于 Agent 层。成功执行但没有数据，不应伪装成技术错误，也不能自动代表 Objective FAILED。

## Qualification 与 Sample Adequacy 分开

`QualificationRule` 判断谁能进入候选池；`SampleAdequacyRule` 判断样本是否足以支撑当前结论。

这两类规则已经进入 Domain Model；official league progress 与 local ingestion coverage 仍然保持分离，避免用数据库最大日期冒充 MLB 实际赛季进度。

## Artifact 与 Assessment 分离

Artifact 保存数据事实和 provenance；质量由 contextual `ArtifactAssessment` 表达：

```text
ArtifactAssessment
├── artifact_ref
├── requirement_ref
├── objective_ref
├── deterministic_result
├── judge_result
├── final_assessment
├── assessment_summary
├── usable_for
└── limitations
```

同一个 Artifact 对不同 Requirement 可以有不同 Assessment。

## Deterministic facts + Judge contextual usability

```text
Artifact
   ↓
Deterministic Validator
   ├── Hard Validation
   └── Soft Validation Signals
            ↓
          Judge
            ↓
ArtifactAssessment
```

Hard failure 不能被 Judge 覆盖，例如：wrong entity、corrupted artifact、required structure missing、hard time-range mismatch、policy/integrity violation。

Soft signal 例如 temporal coverage、freshness、sample size、qualification、missing ratio，可以由 Judge 根据 Requirement 解释。

这条规则不仅存在 prompt 中，也在 AssessmentService / tests 中通过代码强制 hard veto。

## Judge 输出 Planner 可消费的 summary

Planner 不需要重新做 Judge 的工作，而是消费简短 Assessment summary、Artifact index 和 RequirementState；必要时再通过 ContextService 展开。

这保持：

```text
quality judgement
!=
planning judgement
```

## RequirementState 与 ObjectiveState 是运行时投影

```text
ArtifactAssessment
        ↓
Requirement State Service
        ↓
RequirementState
        ↓
Objective State Service
        ↓
ObjectiveState
```

State 不重新创造底层原因，而是引用 Assessment、Execution、Governance 中已经产生的 blocker / limitation。

## COMPLETE / LIMITED / FAILED

- `COMPLETE`：核心 Initial Requirements 足以回答；optional gaps 可存在。
- `LIMITED`：核心仍有缺口，但 Planner terminal 且已有可靠的受限结论。
- `FAILED`：无法形成可靠、可用的受限回答。

核心 Requirement 缺失不能被大量 optional Artifact 平均掉。

## Response 只消费 accepted products

最终 ResponsePackage 只允许：

```text
objective results
accepted Artifacts
accepted Evidence
critical Shared Knowledge
limitations
optional gaps
unresolved items
provenance
```

不会把 failed attempts、old plan、routing experiment、rejected Evidence、Judge internal reasoning 重新塞回最终模型。

GPT-5.6 曾在实际 Runtime 中发现 cross-objective accepted-evidence leakage；修复后 Response 必须按当前 Objective 的 Requirement/Assessment scope 过滤。这件事说明“结构边界必须被测试”，不能只写在架构文档中。

## Web Evidence 不直接等于网页文本

当前 Runtime 已实现：

```text
Web Tool
→ RawWebResult
→ EvidenceExtractor
→ Evidence
→ EVIDENCE Artifact
→ Validation / Judge
```

Raw provider text 不能直接被当作 approved Evidence。

## System State 与 LLM Context 分离

完整 Runtime 可以保存 retry、NO_DATA、failed attempt、rejected candidate、旧 Plan；LLM 只获得当前 caller 所需的 bounded Context projection。

Runtime audit 已专门覆盖 cross-run / cross-objective isolation。

## 现在的可靠性工作重点

Validation / Judge / Response boundary 已经从设计进入实现和攻击测试。下一阶段更重要的是：

- 用真实 `baseball_analytics` PostgreSQL 验证 read-only E2E；
- 用真实历史 Parquet 继续暴露 Schema 差异；
- 完成 live Web Evidence provider E2E；
- 在复杂 MLB query 中验证 COMPLETE / LIMITED / FAILED 是否符合真实业务语义。

**来源：** S1、S2、S3、S5、S6。
