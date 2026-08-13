// 处理 public/music/audio/ 下的 mp3：
// 读取 ID3 标签 → 重命名为「歌手 - 歌名」→ 提取封面到 cover/、歌词到 lrc/ → 重写 playlist.json
import NodeID3 from 'node-id3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_DIR = path.join(ROOT, 'public/music/audio')
const COVER_DIR = path.join(ROOT, 'public/music/cover')
const LRC_DIR = path.join(ROOT, 'public/music/lrc')
const PLAYLIST = path.join(ROOT, 'public/music/playlist.json')

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
}

function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

function clearDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

if (!fs.existsSync(AUDIO_DIR)) {
  console.error(`未找到目录：${AUDIO_DIR}`)
  process.exit(1)
}

const mp3s = fs
  .readdirSync(AUDIO_DIR)
  .filter((f) => f.toLowerCase().endsWith('.mp3'))
  .sort()

clearDir(COVER_DIR)
clearDir(LRC_DIR)

const entries = []

for (const file of mp3s) {
  const src = path.join(AUDIO_DIR, file)
  const tags = NodeID3.read(src) || {}

  const title = (tags.title || '').trim() || path.basename(file, '.mp3')
  const artist = (tags.artist || '').trim()
  const base = sanitize(artist ? `${artist} - ${title}` : title)

  const newName = `${base}.mp3`
  if (newName !== file) {
    fs.renameSync(src, path.join(AUDIO_DIR, newName))
    console.log(`重命名：${file} → ${newName}`)
  }

  const entry = { name: title, artist, url: `/music/audio/${newName}` }

  // 封面（APIC）
  const img = tags.image
  if (img && img.imageBuffer && img.imageBuffer.length) {
    const ext = EXT_BY_MIME[(img.mime || '').toLowerCase()] || 'jpg'
    const coverFile = `${base}.${ext}`
    fs.writeFileSync(path.join(COVER_DIR, coverFile), img.imageBuffer)
    entry.cover = `/music/cover/${coverFile}`
  }

  // 歌词（USLT）
  const lyricsText =
    (tags.unsynchronisedLyrics && tags.unsynchronisedLyrics.text) ||
    (tags.lyrics && typeof tags.lyrics === 'string' ? tags.lyrics : null)
  if (lyricsText && lyricsText.trim()) {
    const lrcFile = `${base}.lrc`
    fs.writeFileSync(path.join(LRC_DIR, lrcFile), lyricsText)
    entry.lrc = `/music/lrc/${lrcFile}`
  }

  console.log(
    `处理：${title}${artist ? ` - ${artist}` : ''}` +
      (entry.cover ? ` | 封面 ✓` : ' | 封面 ✗') +
      (entry.lrc ? ` | 歌词 ✓` : ` | 歌词 ✗`)
  )
  entries.push(entry)
}

fs.writeFileSync(PLAYLIST, JSON.stringify(entries, null, 2) + '\n')
console.log(`\nplaylist.json 已更新，共 ${entries.length} 首：${PLAYLIST}`)
