import * as XLSX from 'xlsx'
import { smallToBig, SLOT_TIMES } from '../stores/courses.js'

const WD_MAP = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }

function minsNum(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

// 行头/节次列单元格 → 大节序号（“1-2节”=大节1；“第3节”=大节2；“08:00”按时间就近匹配）
function slotFromHeader(cell) {
  const s = String(cell ?? '').trim()
  if (!s) return null
  let m = s.match(/(\d+)\s*[-~—]\s*(\d+)/)
  if (m) return smallToBig(m[1])
  m = s.match(/第?\s*(\d+)\s*节/)
  if (m) return smallToBig(m[1])
  m = s.match(/(\d{1,2}):(\d{2})/)
  if (m) {
    const mins = Number(m[1]) * 60 + Number(m[2])
    const idx = SLOT_TIMES.findIndex(t => Math.abs(minsNum(t.start) - mins) <= 60)
    return idx >= 0 ? idx + 1 : null
  }
  return null
}

// 课程格文本 → { name, classroom, weekStart, weekEnd }
function parseCellText(text) {
  let t = String(text).trim()
  let weekStart = 1
  let weekEnd = 30
  const wm = t.match(/(\d+)\s*[-~—]\s*(\d+)\s*周/)
  if (wm) {
    weekStart = Number(wm[1])
    weekEnd = Number(wm[2])
    t = t.replace(wm[0], ' ')
  }
  let classroom = ''
  const pm = t.match(/[（(]([^）)]{1,20})[)）]/)
  if (pm && /\d|教|楼|室|馆|场/.test(pm[1])) {
    classroom = pm[1]
    t = t.replace(pm[0], ' ')
  }
  const lines = t
    .split(/\n|[,;，；|]+/)
    .map(x => x.trim())
    .filter(Boolean)
  let name = (lines[0] || '').trim()
  if (!classroom && lines[1] && lines[1].length <= 12) classroom = lines[1]
  // 单行内空格分隔的情况：「概率论 概D120」
  if (!classroom && name.includes(' ')) {
    const seg = name.split(/\s+/)
    const last = seg[seg.length - 1]
    if (seg.length > 1 && last.length <= 12) {
      name = seg[0]
      classroom = last
    }
  }
  name = name.replace(/\s+/g, '')
  return { name, classroom, weekStart, weekEnd }
}

export async function parseExcelTimetable(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { error: 'Excel 里没有工作表' }
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
  return recognizeGrid(grid)
}

// 识别常见课表网格：星期表头行 + 节次列 + 课程格（纵向合并的同名课合并为一门）
export function recognizeGrid(grid) {
  let headerRow = -1
  let colDow = {}
  for (let r = 0; r < Math.min(grid.length, 6); r++) {
    const row = grid[r] || []
    const map = {}
    row.forEach((cell, c) => {
      const t = String(cell ?? '').trim()
      const m = t.match(/[周星期]\s*([一二三四五六日天])$/) || t.match(/^([一二三四五六日天])$/)
      if (m && map[c] == null) map[c] = WD_MAP[m[1]]
    })
    if (Object.keys(map).length >= 2) {
      headerRow = r
      colDow = map
      break
    }
  }
  if (headerRow < 0) {
    return { error: '没找到星期表头行（表格前几行里需要「周一」「星期二」这类字样）' }
  }

  // 节次列：非星期列中「节/时间/纯数字」出现最多的列
  const colCount = Math.max(...grid.map(r => (r || []).length))
  let slotCol = -1
  let best = 1
  for (let c = 0; c < colCount; c++) {
    if (colDow[c] != null) continue
    let hits = 0
    for (let r = headerRow + 1; r < grid.length; r++) {
      const t = String((grid[r] || [])[c] ?? '').trim()
      if (/节|时间|\d{1,2}:\d{2}/.test(t) || /^\d{1,2}$/.test(t)) hits++
    }
    if (hits > best) {
      best = hits
      slotCol = c
    }
  }

  const rows = []
  const lastByDow = {}
  let lastSlot = null
  let skipped = 0
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || []
    if (slotCol >= 0) {
      const s = slotFromHeader(row[slotCol])
      if (s) lastSlot = s
    }
    const slot = lastSlot || 1
    for (const [cStr, dow] of Object.entries(colDow)) {
      const text = String(row[Number(cStr)] ?? '').trim()
      if (!text) continue
      const info = parseCellText(text)
      if (!info.name) {
        skipped++
        continue
      }
      const prev = lastByDow[dow]
      if (prev && prev.name === info.name && prev.row === r - 1) {
        // 纵向合并单元格：延长同一门课的结束节次
        prev.row = r
        prev.entry.slotEnd = Math.max(prev.entry.slotEnd, slot)
        continue
      }
      const entry = {
        ok: true,
        raw: text,
        name: info.name,
        dow,
        slotStart: slot,
        slotEnd: slot,
        classroom: info.classroom,
        teacher: '',
        weekStart: info.weekStart,
        weekEnd: info.weekEnd,
        reason: ''
      }
      rows.push(entry)
      lastByDow[dow] = { name: info.name, row: r, entry }
    }
  }
  return { rows, skipped }
}
