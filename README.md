# Yijie · Baseball Agent Notes

中文个人技术博客。当前 11 篇文章记录 Baseball Agent 从数据脚本原型、架构冻结、v0.1 工程落地与发布，到真实 dogfooding、LLM-first v0.2 与 Artifact-Driven General Analytical Runtime 的最新演进。它不是完整聊天导出；历史文章保留当时背景，当前状态以 `content/knowledge/current-state.md` 为准。

## 主页与发布

- 博客：https://cityuhk-wyj.github.io/
- LLM 索引：https://cityuhk-wyj.github.io/llms.txt
- 全文上下文：https://cityuhk-wyj.github.io/llms-full.txt
- 发布记录：https://github.com/CityuHK-wyj/cityuhk-wyj.github.io/actions

仓库使用 GitHub Actions 构建并部署 GitHub Pages。根目录包含首版生成网页，以兼容 Pages 分支发布配置；日常修改 Markdown 后，Publish blog 工作流会重新构建并部署 `dist`。请以 Actions 的实际部署结果判断最新上线状态。

维护时建议在 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**，使发布只由自定义工作流负责。

官方说明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 本地构建

需要 Node.js 22 或更新版本。

```bash
npm install
npm run build
npm run check
```

`dist/index.html` 可直接打开预览，文章和样式均为本地相对链接。正式发布由 GitHub Actions 将 dist 上传到 Pages。根目录网页是首版发布兼容快照，不是日常编辑源；正文以 `content` 中的 Markdown 为准。

## 更新一篇文章

正文放在 `content/posts/<stable-slug>.md`，在 `content/catalog.json` 增加 id、slug、title、description、category、published、updated、source_ids、file。构建会生成网页、Markdown 原文、RSS、sitemap、`llms.txt` 与 `llms-full.txt`。

提交 main 后工作流重新构建并部署。若仅修改旧文章，更新对应 updated 日期；不要为了排序改写真实首次发布日期。新决定同步到 `content/knowledge` 下的状态、决策、来源和 machine-readable project state。

聊天不会自动同步；下一次提供新讨论、Stop Report、审计结果或仓库变化，再更新文章和状态页。

## 当前项目摘要

截至 2026-09-17：

- Baseball Agent `v0.1.0` 已发布到 `main`；
- `pi/v0.2-llm-first-runtime` 已有远端实现 checkpoint，但未合并；
- 独立 generalization audit 报告指出 scope、team population、constraint dropping、weak web grounding 与 predefined analytics 等问题；
- 当前确认的新方向是 Artifact-Driven General Analytical Runtime：Goal / Need / Artifact / Reference、跨 Tool 数据流、Safe Analytical IR、trusted Schema Catalog、scope-aware Sufficiency 与 Shared Knowledge 管理员审核治理。

详见第 11 篇文章和 `content/knowledge/current-state.md`。

## 给 LLM

先读 `content/knowledge/current-state.md`，再读 `decisions.md` 与 `sources.md`，之后按需查文章。部署后同样提供 `/llms.txt`、`/llms-full.txt`、`/knowledge/project-state.json` 和每篇 Markdown 原文。

## 内容边界

不包含 API 密钥、数据库连接密码、无关个人信息或私人聊天原文。Stop Report、讨论方向、远端仓库直接核验与 live verification 会明确区分；“建议/confirmed direction”不等于“已实现”。没有自动授予第三方内容版权许可。
