# Yijie · Baseball Agent Notes

中文个人技术博客。首批 8 篇文章整理可访问的 baseball agent 项目讨论、历史原型和相关资料。不是完整聊天导出，也不代表当前 Agent 全部实现。

## 主页与发布

- 博客：https://cityuhk-wyj.github.io/
- LLM 索引：https://cityuhk-wyj.github.io/llms.txt
- 全文上下文：https://cityuhk-wyj.github.io/llms-full.txt
- 发布记录：https://github.com/CityuHK-wyj/cityuhk-wyj.github.io/actions

仓库已经写入首批博客；2026-09-07 的 Publish blog 工作流完成构建、检查与 GitHub Pages 部署。

根目录包含首版生成网页，以兼容 Pages 分支发布配置；日常修改 Markdown 后，Publish blog 工作流将重新构建并部署 dist。请以 Actions 的实际部署结果判断最新上线状态。

维护时建议在 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**，使发布只由自定义工作流负责。

官方说明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 本地构建

需要 Node.js 22 或更新版本。

```bash
npm install
npm run build
npm run check
```

`dist/index.html` 可直接打开预览，文章和样式均为本地相对链接。正式发布由 GitHub Actions 将 dist 上传到 Pages。根目录网页是首版发布兼容快照，不是日常编辑源；正文以 content 中的 Markdown 为准。

## 更新一篇文章

正文放在 `content/posts/<stable-slug>.md`，在 `content/catalog.json` 增加 id、slug、title、description、category、published、updated、source_ids、file。构建会生成网页、Markdown 原文、RSS、sitemap、llms.txt 与 llms-full.txt。

提交 main 后工作流重新构建并部署。若仅修改旧文章，更新对应 updated 日期；不要为了排序改写真实首次发布日期。新决定同步到 content/knowledge 下的状态与决策记录。

GitHub 网页编辑 Markdown 也会触发这个流程。聊天不会自动同步；下一次提供新讨论或导出，再更新文章。

## 给 LLM

先读 content/knowledge/current-state.md，再读 decisions.md 与 sources.md，之后按需查文章。部署后同样提供 `/llms.txt`、`/llms-full.txt`、`/knowledge/project-state.json` 和每篇 Markdown 原文。

## 内容边界

不包含 API 密钥、数据库连接配置、无关个人信息或私人聊天原文。历史脚本没有运行验证。正文中“建议”不是“已实现”。没有自动授予第三方内容版权许可。
