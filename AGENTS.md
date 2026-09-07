# Blog maintenance instructions

This repository contains a Chinese technical blog about the baseball_agent project, not the Agent implementation.

Read content/knowledge/current-state.md, decisions.md and sources.md before editing. Keep historical code evidence, user-confirmed direction, editorial proposals and verified current implementation distinct. Do not claim full chat coverage without reading the full export.

Author Markdown in content/posts and register entries in content/catalog.json. Preserve stable slugs. Sync current-state.md, decisions.md and project-state.json when a decision changes. Dates represent publication and update time; original conversation dates belong in sources.

Never publish raw credentials, connection strings, private machine details or unrelated personal memory. Do not copy private source attachments into this repository. Do not invent player statistics, salaries, execution results or source provenance.

Run npm run build and npm run check. dist is generated from content; do not edit its articles directly. No AgentTask/ToolResult JSON in a post constitutes an approved application interface. llms.txt is a navigation aid, not a guarantee of automatic LLM ingestion.
