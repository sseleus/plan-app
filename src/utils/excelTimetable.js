import * as XLSX from 'xlsx'
import { slotTimes, smallToBig } from '../stores/settings.js'
import { parseCourseCell, cnNum, periodsToSlots } from './courseCell.js'

const WD_MAP = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 }

function minsNum(t) {
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + (m || 0)
}

const GROUP_RE = /^(上午|早上|清晨|中午|下午|傍晚|晚上|晚自习)/

function groupKey(label) {
  const m = String(label).match(GROUP_RE)
  return m ? m[1] : ''
}

// 「上午/下午/晚上」→ 该时段第一个大节序号（按配置的上课时间推断）
function groupBase(label) {
  const slots = slotTimes()
  const m = String(label).match(GROUP_RE)
  const word = m ? m[1] : '上午'
  const hour = /上午|早上|清晨/.test(word) ? 8 : /晚上|晚自习|傍晚/.test(word) ? 19 : 12
  let idx = slots.findIndex(s => Number(s.start.split(':')[0]) >= hour)
  if (idx < 0) idx = slots.length - 1
  return idx + 1
}

// 行头/节次列单元格 → 大节序号（directMode=true 时纯数字/中文数字直接是大节序号，否则按小节换算）
function slotFromHeader(cell, directMode) {
  const s = String(cell ?? '').trim()
  if (!s) return null
  const count = slotTimes().length
  const clamp = n => Math.min(Math.max(n, 1), count)

  let m = s.match(/(\d{1,2})\s*[-~—]\s*(\d{1,2})/)
  if (m) return smallToBig(Number(m[1]))
  m = s.match(/^([一二三四五六七八九十]{1,2})\s*[-~—]\s*([一二三四五六七八九十]{1,2})$/)
  if (m) return smallToBig(cnNum(m[1]))
  m = s.match(/第?\s*(\d{1,2})\s*节/)
  if (m) return smallToBig(Number(m[1]))
  m = s.match(/(\d{1,2}):(\d{2})/)
  if (m) {
    const mins = Number(m[1]) * 60 + Number(m[2])
    const idx = slotTimes().findIndex(t => Math.abs(minsNum(t.start) - mins) <= 60)
    return idx >= 0 ? idx + 1 : null
  }
  m = s.match(/^([一二三四五六七八九十]{1,3})$/)
  if (m) {
    const n = cnNum(m[1])
    if (n == null) return null
    return directMode ? clamp(n) : smallToBig(n)
  }
  m = s.match(/^(\d{1,2})$/)
  if (m) {
    const n = Number(m[1])
    return directMode ? clamp(n) : smallToBig(n)
  }
  return null
}

export async function parseExcelTimetable(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { error: 'Excel 里没有工作表' }
  // blankrows 保持 true：!merges 的行列号以原始表为准，展开后再过滤空行
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: '' })
  expandMerges(grid, ws['!merges'] || [])
  const dense = grid.filter(row => (row || []).some(cell => String(cell ?? '').trim() !== ''))
  return recognizeGrid(dense)
}

// 纵向/横向合并单元格：把左上角的值铺满整个合并区，课程格就能在每一行都被读到
function expandMerges(grid, merges) {
  for (const m of merges) {
    const tl = (grid[m.s.r] || [])[m.s.c]
    if (tl == null || String(tl).trim() === '') continue
    for (let r = m.s.r; r <= m.e.r; r++) {
      if (!grid[r]) grid[r] = []
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue
        grid[r][c] = tl
      }
    }
  }
}

// 识别常见课表网格：星期表头行 + 节次列（数字/中文数字/时间）+ 课程格
// 课程格支持「课程名/老师/周次/单双周/[节次]/教室」混排；纵向合并的连堂课自动合并
export function recognizeGrid(grid) {
  // 1. 星期表头行（前 10 行内找，含「周一」「星期日」字样的列 ≥2 即认定）
  let headerRow = -1
  let colDow = {}
  for (let r = 0; r < Math.min(grid.length, 10); r++) {
    const row = grid[r] || []
    const map = {}
    row.forEach((cell, c) => {
      const t = String(cell ?? '').trim()
      const m = t.match(/(?:周|星期)\s*([一二三四五六日天1-7])/) || t.match(/^([一二三四五六日天])$/)
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

  // 2. 找节次列（节/时间/纯数字/中文数字最多的一列）和上午/下午/晚上分组列
  const colCount = Math.max(...grid.map(r => (r || []).length))
  let slotCol = -1
  let slotHits = 1
  let groupCol = -1
  let groupHits = 1
  for (let c = 0; c < colCount; c++) {
    if (colDow[c] != null) continue
    let hits = 0
    let ghits = 0
    for (let r = headerRow + 1; r < grid.length; r++) {
      const t = String((grid[r] || [])[c] ?? '').trim()
      if (!t) continue
      if (GROUP_RE.test(t) && t.length <= 4) {
        ghits++
        continue
      }
      if (/节|时间|\d{1,2}:\d{2}/.test(t) || /^\d{1,2}$/.test(t) || /^[一二三四五六七八九十]{1,3}$/.test(t)) hits++
    }
    if (hits > slotHits) {
      slotHits = hits
      slotCol = c
    }
    if (ghits > groupHits) {
      groupHits = ghits
      groupCol = c
    }
  }

  // 3. 节次列里的纯数字是大节序号还是小节号：
  //    有分组列时看单个分组内的行数（上午最多 2 行 → 是大节序号）；否则行数 ≤5 且最大值 ≤5 视为大节序号
  let directMode = false
  if (slotCol >= 0) {
    const nums = []
    const perGroup = {}
    for (let r = headerRow + 1; r < grid.length; r++) {
      const t = String((grid[r] || [])[slotCol] ?? '').trim()
      if (!t) continue
      if (/^\d{1,2}$/.test(t) || /^[一二三四五六七八九十]{1,3}$/.test(t)) {
        const n = cnNum(t)
        if (n != null) nums.push(n)
      }
      if (groupCol >= 0) {
        const g = groupKey((grid[r] || [])[groupCol])
        if (g) perGroup[g] = (perGroup[g] || 0) + 1
      }
    }
    const maxInGroup = Math.max(0, ...Object.values(perGroup))
    const count = slotTimes().length
    directMode =
      nums.length > 0 &&
      (groupCol >= 0
        ? maxInGroup <= 2 && Math.max(...nums) <= count
        : nums.length <= 5 && Math.max(...nums) <= count)
  }

  // 4. 逐行读取课程格
  const rows = []
  const lastByDow = {}
  let lastSlot = null
  let lastGroupBase = null
  let lastGroupLabel = ''
  let groupRowIdx = 0
  let skipped = 0
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || []
    if (slotCol >= 0) {
      const s = slotFromHeader(row[slotCol], directMode)
      if (s) lastSlot = s
    }
    let slot = lastSlot
    if (!slot && groupCol >= 0) {
      const g = String(row[groupCol] ?? '').trim()
      const key = groupKey(g)
      // 合并单元格展开后分组标签每行都在，只在分组切换时重置行内计数
      if (key && key !== lastGroupLabel) {
        lastGroupLabel = key
        lastGroupBase = groupBase(g)
        groupRowIdx = 0
      }
      if (lastGroupBase) slot = Math.min(slotTimes().length, lastGroupBase + groupRowIdx)
    }

    let rowHasCourse = false
    for (const [cStr, dow] of Object.entries(colDow)) {
      const text = String(row[Number(cStr)] ?? '').trim()
      if (!text) continue
      rowHasCourse = true
      const info = parseCourseCell(text)
      if (!info.name) {
        skipped++
        continue
      }
      // 括号小节优先（可能合法跨大节，如 [6-8]）；无括号时用行头的节次
      let [slotStart, slotEnd] = info.periods ? periodsToSlots(info.periods) : [slot || 1, slot || 1]
      if (slotEnd < slotStart) slotEnd = slotStart
      const prev = lastByDow[dow]
      if (prev && prev.name === info.name && prev.row === r - 1) {
        // 纵向合并/连堂：延长同一门课的节次范围
        prev.row = r
        prev.entry.slotStart = Math.min(prev.entry.slotStart, slotStart)
        prev.entry.slotEnd = Math.max(prev.entry.slotEnd, slotEnd)
        continue
      }
      const entry = {
        ok: true,
        raw: text,
        name: info.name,
        dow,
        slotStart,
        slotEnd,
        classroom: info.classroom,
        teacher: info.teacher,
        weekStart: info.weekStart,
        weekEnd: info.weekEnd,
        parity: info.parity,
        reason: ''
      }
      rows.push(entry)
      lastByDow[dow] = { name: info.name, row: r, entry }
    }
    if (rowHasCourse && !lastSlot && lastGroupBase) groupRowIdx++
  }
  return { rows, skipped }
}

// 把粘贴文本重建为二维网格：表格粘贴时单元格内的换行会把一行拆成多行，
// 按「目标列数 = 最宽行」判断断行处，把碎行接回上一逻辑行
function buildTextGrid(rawLines) {
  if (!rawLines.some(l => l.includes('\t'))) return []
  const lines = rawLines.filter(l => l.trim() !== '')
  const width = Math.max(...lines.map(l => l.split('\t').length))
  const rows = []
  let cur = null
  let expectCont = false
  for (const line of lines) {
    const cells = line.split('\t')
    if (cur && expectCont && cells.length < width) {
      const ci = cur.length - 1
      cur[ci] = (cur[ci] ? cur[ci] + '\n' : '') + cells[0]
      for (let i = 1; i < cells.length; i++) cur.push(cells[i])
    } else {
      if (cur) rows.push(cur)
      cur = cells.slice()
    }
    expectCont = cur.length < width
  }
  if (cur) rows.push(cur)
  return rows
}

// 解析粘贴的课表文本 → 行结果数组（ok 行可直接导入，fail 行标红）
// 支持整表粘贴（Tab 分列、单元格可含换行）和每行一门课（多行块里星期可写在块末）
export function parseTimetableText(text) {
  const rawLines = String(text || '').split(/\r?\n/)

  const grid = buildTextGrid(rawLines)
  const colCount = Math.max(0, ...grid.map(r => r.length))
  if (colCount >= 4) {
    const res = recognizeGrid(grid)
    if (!res.error && res.rows.length) return res.rows
  }

  // 行/块模式：含星期行为的行开启记录，星期出现前连续多行并入同一记录（对应多行单元格逐行粘贴）
  const WD_RE = /(周|星期)\s*[一二三四五六日天1-7]/
  const records = []
  const recHasWd = []
  for (const raw of rawLines) {
    if (raw.trim() === '') continue
    const hasWd = WD_RE.test(raw)
    const last = records.length - 1
    if (last >= 0 && !recHasWd[last]) {
      records[last].push(raw)
      if (hasWd) recHasWd[last] = true
    } else {
      records.push([raw])
      recHasWd.push(hasWd)
    }
  }

  const rows = []
  for (const rec of records) {
    const raw = rec.join('\n')
    let line = raw
    const row = { ok: false, raw, name: '', dow: 0, slotStart: 0, slotEnd: 0, classroom: '', teacher: '', weekStart: 1, weekEnd: 30, parity: 'all', reason: '' }

    const wd = line.match(/(周|星期)\s*([一二三四五六日天1-7])/)
    if (!wd) {
      row.reason = '没找到星期（如“周一”）'
      rows.push(row)
      continue
    }
    row.dow = WD_MAP[wd[2]]
    line = line.replace(wd[0], ' ')

    const info = parseCourseCell(line, { splitSpaces: true })
    if (!info.name) {
      row.reason = '没找到课程名'
      rows.push(row)
      continue
    }
    row.name = info.name
    row.classroom = info.classroom
    row.teacher = info.teacher
    row.weekStart = info.weekStart
    row.weekEnd = info.weekEnd
    row.parity = info.parity

    if (info.periods) {
      ;[row.slotStart, row.slotEnd] = periodsToSlots(info.periods)
    } else {
      const tm = line.match(/(\d{1,2}):(\d{2})/)
      if (!tm) {
        row.reason = '没找到节次（如“1-2节”或“08:00”）'
        rows.push(row)
        continue
      }
      const mins = Number(tm[1]) * 60 + Number(tm[2])
      let idx = slotTimes().findIndex(s => Math.abs(minsNum(s.start) - mins) <= 60)
      if (idx < 0) idx = 0
      row.slotStart = row.slotEnd = idx + 1
    }
    if (row.slotEnd < row.slotStart) row.slotEnd = row.slotStart
    row.ok = true
    rows.push(row)
  }
  return rows
}
