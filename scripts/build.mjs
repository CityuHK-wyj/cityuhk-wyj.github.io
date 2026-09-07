import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let marked;
try { ({marked}=await import('marked')); }
catch (error) {
  const runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if(!runtime) throw error;
  ({marked}=await import(pathToFileURL(path.join(runtime,'marked/lib/marked.esm.js')).href));
}
const out=path.join(root,'dist');
const catalog=JSON.parse(await fs.readFile(path.join(root,'content/catalog.json'),'utf8'));
const origin=catalog.site.url.replace(/\/$/,'');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
await fs.mkdir(out,{recursive:true});
async function write(file,text){const target=path.join(out,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,text);}
await fs.mkdir(path.join(out,'assets'),{recursive:true});
await fs.copyFile(path.join(root,'assets/style.css'),path.join(out,'assets/style.css'));
function shell({title,description,body,relative='',url=''}){return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Yijie Notes</title><meta name="description" content="${esc(description)}"><meta name="author" content="WANG Yijie"><link rel="canonical" href="${origin}/${url}"><meta property="og:type" content="${url?'article':'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${origin}/${url}"><link rel="stylesheet" href="${relative}assets/style.css"><link rel="alternate" type="application/rss+xml" title="Yijie Notes" href="${relative}feed.xml"></head><body><a class="skip" href="#main">跳转到正文</a><header><div class="bar"><a class="brand" href="${relative}index.html">YIJIE <span aria-hidden="true">/</span> NOTES</a><nav aria-label="主导航"><a href="${relative}index.html">文章</a><a href="${relative}knowledge/current-state.html">项目状态</a><a href="${relative}llms.txt">LLM 入口</a><a href="https://github.com/CityuHK-wyj">GitHub</a></nav></div></header><main id="main" class="wrap">${body}</main><footer><span>WANG Yijie · Baseball Agent 开发记录</span><span><a href="${relative}knowledge/sources.html">来源与覆盖范围</a> · <a href="${relative}feed.xml">RSS</a> · 2026</span></footer></body></html>`;}
const knowledge=[{slug:'current-state',title:'项目当前状态',description:'已确认方向、历史实现与下一步。'},{slug:'decisions',title:'决策与开放问题',description:'区分已确认方向、建议和未决事项。'},{slug:'sources',title:'来源与覆盖范围',description:'材料来源、已知缺口与公开参考。'}];
const full=[];
for(const item of [...knowledge.map(k=>({...k,section:'knowledge',file:`knowledge/${k.slug}.md`})),...catalog.posts.map(p=>({...p,section:'posts'}))]){
  const raw=await fs.readFile(path.join(root,'content',item.file),'utf8');
  if(!raw.startsWith('# ')) throw Error(`Missing title: ${item.file}`);
  full.push({item,raw});
  let html=marked.parse(raw,{gfm:true});
  const headings=[];
  html=html.replace(/<h2>([\s\S]*?)<\/h2>/g,(_,heading)=>{const id=`section-${headings.length+1}`;headings.push({id,label:heading.replace(/<[^>]*>/g,'')});return `<h2 id="${id}">${heading}</h2>`;});
  html=html.replace(/<table>/g,'<div class="table-wrap" tabindex="0" role="region" aria-label="可横向滚动的数据表"><table>').replace(/<\/table>/g,'</table></div>');
  const metadata=item.section==='posts'?`首发 ${esc(item.published)} · 更新 ${esc(item.updated)} · ${esc(item.category)}`:'项目知识 · 更新 2026-09-07';
  html=html.replace(/(<h1>[\s\S]*?<\/h1>)/,`$1<div class="article-meta">${metadata}<br><a href="${item.slug}.md">Markdown 原文</a><a href="../llms-full.txt">完整文本</a></div>`);
  const pos=catalog.posts.findIndex(p=>p.slug===item.slug);
  const next=pos>=0?catalog.posts[pos+1]:null;
  const body=`<div class="article-layout"><aside class="toc" aria-label="文章目录"><strong>本文目录</strong>${headings.map(h=>`<a href="#${h.id}">${h.label}</a>`).join('')}<a href="../index.html">返回全部文章</a></aside><article><div class="eyebrow">${item.section==='posts'?`FIELD NOTES / ${String(pos+1).padStart(2,'0')}`:'PROJECT KNOWLEDGE'}</div>${html}<div class="article-foot"><a href="../index.html">全部文章</a>${next?`<a href="${next.slug}.html">下一篇：${esc(next.title)}</a>`:''}</div></article></div>`;
  await write(`${item.section}/${item.slug}.html`,shell({title:item.title,description:item.description,body,relative:'../',url:`${item.section}/${item.slug}.html`}));
  await write(`${item.section}/${item.slug}.md`,raw);
}
const rows=catalog.posts.map((p,i)=>`<section class="post-row"><div class="number" aria-hidden="true">${String(i+1).padStart(2,'0')}</div><div><h3><a href="posts/${p.slug}.html">${esc(p.title)}</a></h3><p>${esc(p.description)}</p></div><div class="post-meta"><span class="tag">${esc(p.category)}</span><br><time datetime="${p.published}">${p.published}</time><br><a href="posts/${p.slug}.md">Markdown</a></div></section>`).join('');
await write('index.html',shell({title:'棒球、数据与 Agent',description:catalog.site.description,body:`<div class="intro"><div><div class="eyebrow">WANG Yijie / Engineering journal</div><h1>棒球、数据<br>与 Agent。</h1><p>记录一个棒球分析 Agent 从数据脚本走向可靠系统的过程：如何理解问题、组织工具、验证结果，以及保留每次设计的理由。</p></div><aside class="context"><strong>继续这个项目</strong><a href="knowledge/current-state.html">当前状态与下一步</a><a href="knowledge/decisions.html">决策与开放问题</a><a href="llms.txt">给 LLM 的阅读索引</a><p>首版整理于 2026-09-07。基于可访问的讨论摘要与历史资料，完整聊天记录仍待补齐。</p></aside></div><div class="section-label"><h2>Baseball Agent 连载</h2><span class="meta">${catalog.posts.length} 篇 · 按设计脉络阅读</span></div>${rows}<div class="note">这里同时记录历史实现、已确认方向与待验证方案。了解项目现状，请先读<a href="knowledge/current-state.html">当前状态</a>；了解材料边界，请读<a href="knowledge/sources.html">来源说明</a>。</div>`}));
const llms=`# Yijie · Baseball Agent Notes\n\n> Chinese engineering notes on a baseball analytics Agent. Partial accessible-source synthesis, not a complete chat archive or a verified current implementation. Last compiled: 2026-09-07.\n\n## Read first\n${knowledge.map(k=>`- [${k.title}](${origin}/knowledge/${k.slug}.md): ${k.description}`).join('\n')}\n- [Machine-readable project state](${origin}/knowledge/project-state.json)\n\n## Articles\n${catalog.posts.map(p=>`- [${p.title}](${origin}/posts/${p.slug}.md): ${p.description}`).join('\n')}\n\n## Full text\n- [Combined context](${origin}/llms-full.txt)\n\nDistinguish user-confirmed directions, historical code observations, editorial proposals and unverified current implementation. Do not treat examples as approved schemas.\n`;
await write('llms.txt',llms);
await write('llms-full.txt',llms+'\n\n'+full.map(({item,raw})=>`---\nSource: ${origin}/${item.section}/${item.slug}.md\n\n${raw}`).join('\n\n'));
await fs.copyFile(path.join(root,'content/knowledge/project-state.json'),path.join(out,'knowledge/project-state.json'));
await write('catalog.json',JSON.stringify(catalog,null,2)+'\n');
const rss=`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Yijie · Baseball Agent Notes</title><link>${origin}/</link><description>${esc(catalog.site.description)}</description><language>zh-cn</language>${catalog.posts.map(p=>`<item><title>${esc(p.title)}</title><link>${origin}/posts/${p.slug}.html</link><guid>${origin}/posts/${p.slug}.html</guid><description>${esc(p.description)}</description><pubDate>${new Date(p.published+'T00:00:00Z').toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
await write('feed.xml',rss);
await write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url>${full.map(({item})=>`<url><loc>${origin}/${item.section}/${item.slug}.html</loc><lastmod>${item.updated||'2026-09-07'}</lastmod></url>`).join('')}</urlset>`);
await write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
await write('.nojekyll','');
await write('404.html',shell({title:'页面未找到',description:'请返回文章目录。',relative:'/',url:'404.html',body:'<h1>这篇内容尚不存在。</h1><p><a href="/">返回文章目录</a>，或从项目当前状态继续阅读。</p>'}));
console.log(`Built ${catalog.posts.length} posts and ${knowledge.length} knowledge pages in dist.`);
