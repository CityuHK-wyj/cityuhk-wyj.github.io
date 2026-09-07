import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','dist');
const errors=[];
async function walk(dir){const result=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);result.push(...e.isDirectory()?await walk(p):[p]);}return result;}
const files=await walk(root);
for(const file of files){
 const text=await fs.readFile(file,'utf8');
 if(/sk-[A-Za-z0-9_-]{16,}/.test(text)) errors.push(`Possible secret in ${file}`);
 if(file.endsWith('.json'))try{JSON.parse(text);}catch{errors.push(`Invalid JSON ${file}`);}
 if(!file.endsWith('.html'))continue;
 if(!text.includes('<html lang="zh-CN">')||!text.includes('<h1>'))errors.push(`Missing document semantics ${file}`);
 for(const match of text.matchAll(/(?:href|src)="([^"]+)"/g)){
  const link=match[1];if(/^(https?:|mailto:|data:)/.test(link))continue;
  const [location,fragment]=link.split('#');const clean=location.split('?')[0];
  let target=clean?clean.startsWith('/')?path.join(root,clean):path.resolve(path.dirname(file),clean):file;
  if(clean.endsWith('/'))target=path.join(target,'index.html');
  try{await fs.access(target);if(fragment){const body=await fs.readFile(target,'utf8');if(!body.includes(`id="${fragment}"`))errors.push(`Broken anchor ${file}: ${link}`);}}
  catch{errors.push(`Broken local link ${file}: ${link}`);}
 }
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log(`Checked ${files.length} generated files: local links, anchors, JSON and document semantics passed.`);
