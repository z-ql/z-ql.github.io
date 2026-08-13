#!/usr/bin/env node
// 一次性图床整理脚本：下载 -> 上传到新目录 -> 校验 -> 删除旧文件
// 用法: IMGBED_TOKEN=xxx node scripts/imgbed-organize.mjs <download|upload|verify|delete>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://img.zql404.top';
const TOKEN = process.env.IMGBED_TOKEN;
if (!TOKEN) {
  console.error('Missing IMGBED_TOKEN env var');
  process.exit(1);
}
const STAGING = path.join(path.dirname(fileURLToPath(import.meta.url)), '.imgbed-staging');
const RESULT_FILE = path.join(STAGING, 'result.json');

// old: 旧存储路径（/file/ 之后的部分）；folder/name: 新目录结构
const MAPPING = [
  { old: '1780750002479_dariusz-sankowski-mj2NwYH3wBA-unsplash.jpg', folder: '博客/创建图床', name: 'imgbed-fig1.jpg', size: 2400566 },
  { old: '1780664858018_image.png', folder: '博客/创建图床', name: 'imgbed-fig2.png', size: 251939 },
  { old: '1780664962425_image.png', folder: '博客/创建图床', name: 'imgbed-fig3.png', size: 86541 },
  { old: '1780665055815_image.png', folder: '博客/创建图床', name: 'imgbed-fig4.png', size: 255032 },
  { old: '1780665116514_image.png', folder: '博客/创建图床', name: 'imgbed-fig5.png', size: 295592 },
  { old: '1780665838780_image.png', folder: '博客/创建图床', name: 'imgbed-fig6.png', size: 260126 },
  { old: '1780665201558_image.png', folder: '博客/创建图床', name: 'imgbed-fig7.png', size: 275065 },
  { old: '1780665247011_image.png', folder: '博客/创建图床', name: 'imgbed-fig8.png', size: 201351 },
  { old: '1780665295730_image.png', folder: '博客/创建图床', name: 'imgbed-fig9.png', size: 340690 },
  { old: '1780665441557_image.png', folder: '博客/创建图床', name: 'imgbed-fig10.png', size: 619316 },
  { old: '1780665607507_image.png', folder: '博客/创建图床', name: 'imgbed-fig11.png', size: 377546 },
  { old: '1780665622854_image.png', folder: '博客/创建图床', name: 'imgbed-fig12.png', size: 490453 },
  { old: '1780665516272_image.png', folder: '博客/创建图床', name: 'imgbed-fig13.png', size: 480011 },
  { old: '1780665555150_image.png', folder: '博客/创建图床', name: 'imgbed-fig14.png', size: 581054 },
  { old: '1780665701894_image.png', folder: '博客/创建图床', name: 'imgbed-fig15.png', size: 637703 },
  { old: '1780665898283_image.png', folder: '博客/创建图床', name: 'imgbed-fig16.png', size: 208953 },
  { old: '1780665963562_image.png', folder: '博客/创建图床', name: 'imgbed-fig17.png', size: 139768 },
  { old: '1780666126525_image.png', folder: '博客/创建图床', name: 'imgbed-fig18.png', size: 230704 },
  { old: 'file/1780819209375_20200112222135_pdimg.webp', folder: '博客/创建图床', name: 'imgbed-fig19.webp', size: 60110 },
  { old: '1780678849822_122026848_p0.jpg', folder: '博客/博客网站日志', name: 'upload-project-to-github-fig1.jpg', size: 3907700 },
];

function newReadUrl(m) {
  const encoded = m.folder.split('/').map(encodeURIComponent).concat(encodeURIComponent(m.name)).join('/');
  return `${BASE}/file/${encoded}`;
}

const headers = { Authorization: `Bearer ${TOKEN}` };

async function download() {
  await mkdir(STAGING, { recursive: true });
  for (const m of MAPPING) {
    const url = `${BASE}/file/${m.old}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`download ${m.old}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const target = path.join(STAGING, m.name);
    await writeFile(target, buf);
    const ok = buf.length === m.size;
    console.log(`${ok ? 'OK ' : 'SIZE_MISMATCH'} ${m.name} (${buf.length}/${m.size})`);
    if (!ok) throw new Error(`size mismatch for ${m.old}`);
  }
}

async function upload() {
  const results = [];
  for (const m of MAPPING) {
    const buf = await readFile(path.join(STAGING, m.name));
    const form = new FormData();
    form.append('file', new Blob([buf]), m.name);
    const q = new URLSearchParams({ uploadFolder: m.folder, uploadNameType: 'origin', returnFormat: 'full' });
    const res = await fetch(`${BASE}/upload?${q}`, { method: 'POST', headers, body: form });
    const text = await res.text();
    if (!res.ok) throw new Error(`upload ${m.name}: HTTP ${res.status} ${text}`);
    let json;
    try { json = JSON.parse(text); } catch { throw new Error(`upload ${m.name}: bad JSON ${text.slice(0, 200)}`); }
    const src = json[0]?.src;
    if (!src) throw new Error(`upload ${m.name}: no src in response ${text.slice(0, 200)}`);
    results.push({ old: m.old, name: m.name, src });
    console.log(`UP ${m.name} -> ${src}`);
  }
  await writeFile(RESULT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nresult saved: ${RESULT_FILE}`);
}

async function verify() {
  for (const m of MAPPING) {
    const url = newReadUrl(m);
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`${res.status === 200 ? 'OK ' : 'FAIL'} ${url} -> ${res.status}`);
  }
}

async function del() {
  // 该部署版本没有生效的 batch 删除接口（POST /api/manage/delete/batch 被当成
  // 删除名为 "batch" 的单文件处理），所以逐文件调用单文件删除。
  for (const m of MAPPING) {
    const res = await fetch(`${BASE}/api/manage/delete/${m.old}`, { headers });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = {}; }
    if (res.ok && json.success) {
      console.log(`DEL ${m.old}`);
    } else if (res.status === 404 || json.error) {
      console.log(`SKIP ${m.old} (already gone: ${res.status} ${text.slice(0, 80)})`);
    } else {
      console.error(`FAIL ${m.old} -> ${res.status} ${text.slice(0, 200)}`);
      process.exitCode = 1;
    }
  }
}

async function updateRefs() {
  const files = [
    'src/content/blog/imgbed/index.mdx',
    'src/content/blog/imgbed/index-en.mdx',
    'src/content/blog/japanese-learning-note/index.mdx',
    'src/content/blog/upload-project-to-github/index.mdx',
    'src/content/blog/upload-project-to-github/index-en.mdx',
  ];
  for (const rel of files) {
    const fp = path.join(process.cwd(), rel);
    let text = await readFile(fp, 'utf8');
    let count = 0;
    for (const m of MAPPING) {
      const oldUrl = `${BASE}/file/${m.old}`;
      const parts = text.split(oldUrl);
      if (parts.length > 1) {
        count += parts.length - 1;
        text = parts.join(newReadUrl(m));
      }
    }
    await writeFile(fp, text);
    console.log(`${count} replacement(s) in ${rel}`);
  }
}

const phase = process.argv[2];
if (phase === 'download') await download();
else if (phase === 'upload') await upload();
else if (phase === 'verify') await verify();
else if (phase === 'delete') await del();
else if (phase === 'updaterefs') await updateRefs();
else {
  console.error('usage: node scripts/imgbed-organize.mjs <download|upload|verify|delete>');
  process.exit(1);
}
