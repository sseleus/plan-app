import { reactive, watch } from 'vue'
import { load, save, genId } from './storage.js'
import { weekdayMon1, fromStr, addDays } from '../utils/date.js'
import { settingsStore } from './settings.js'

// 课程按「节次」排：5 个大节
export const SLOT_TIMES = [
  { label: '1-2节', short: '1-2', start: '08:00', end: '09:40' },
  { label: '3-4节', short: '3-4', start: '10:00', end: '11:40' },
  { label: '5-6节', short: '5-6', start: '14:00', end: '15:40' },
  { label: '7-8节', short: '7-8', start: '16:00', end: '17:40' },
  { label: '晚', short: '晚', start: '19:00', end: '20:40' }
]

export const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export const COURSE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#ef4444', '#64748b']

// 课程：{ id, name, dow 1-7, slotStart/slotEnd 1-5, classroom, teacher, color, weekStart, weekEnd }
// 临时调整 adjustment：
//   cancel —— 某周某课取消一次
//   move   —— 某周某课临时调到另一天某节次（原时间腾空）
//   makeup —— 额外补课/调休：在指定日期补上某课程
export const coursesStore = reactive({
  ready: false,
  courses: [],
  adjustments: [],

  init() {
    if (this.ready) return
    settingsStore.init()
    this.courses = load('courses', [])
    this.adjustments = load('adjustments', [])
    this.ready = true
    watch(() => this.courses, v => save('courses', v), { deep: true })
    watch(() => this.adjustments, v => save('adjustments', v), { deep: true })
  },

  add(data) {
    this.courses.push({ id: genId(), classroom: '', teacher: '', ...data })
  },

  update(id, data) {
    const c = this.courses.find(x => x.id === id)
    if (c) Object.assign(c, data)
  },

  remove(id) {
    this.courses = this.courses.filter(c => c.id !== id)
    // 课程删除后其临时调整一并清理
    this.adjustments = this.adjustments.filter(a => a.courseId !== id)
  },

  addAdjustment(data) {
    this.adjustments.push({ id: genId(), ...data })
  },

  removeAdjustment(id) {
    this.adjustments = this.adjustments.filter(a => a.id !== id)
  },

  // 学期第几周（第 1 周 = term.startDate 所在周，按周一算）
  weekOf(dateStr) {
    const start = settingsStore.term.startDate
    const diff = Math.floor((fromStr(dateStr) - fromStr(start)) / 86400000)
    return Math.floor(diff / 7) + 1
  },

  activeIn(c, week) {
    return week >= c.weekStart && week <= c.weekEnd
  },

  // 某天的课程：常规课（扣除当周取消/调走的）+ 当天调来/补上的
  coursesOn(dateStr, weekOverride) {
    const week = weekOverride ?? this.weekOf(dateStr)
    const dow = weekdayMon1(dateStr)
    const list = []
    for (const c of this.courses) {
      if (c.dow !== dow || !this.activeIn(c, week)) continue
      const touched = this.adjustments.some(
        a => a.courseId === c.id && (a.kind === 'cancel' || a.kind === 'move') && a.week === week
      )
      if (touched) continue
      list.push(c)
    }
    for (const a of this.adjustments) {
      if ((a.kind === 'move' || a.kind === 'makeup') && a.date === dateStr) {
        const c = this.courses.find(x => x.id === a.courseId)
        if (c) list.push({ ...c, slotStart: a.slotStart, slotEnd: a.slotEnd, _adjust: a.kind })
      }
    }
    return list
  },

  // 周视图网格：grid[slotIndex][dayIndex] = course | undefined（按该周真实日期逐天计算，临时调整自动生效）
  weekGrid(week) {
    const mon = addDays(settingsStore.term.startDate, (week - 1) * 7)
    const grid = Array.from({ length: SLOT_TIMES.length }, () => Array(7).fill(null))
    for (let d = 0; d < 7; d++) {
      const date = addDays(mon, d)
      for (const c of this.coursesOn(date)) {
        const col = weekdayMon1(date) - 1
        for (let s = c.slotStart; s <= Math.min(c.slotEnd, SLOT_TIMES.length); s++) {
          grid[s - 1][col] = c
        }
      }
    }
    return grid
  }
})

// 小节号 → 大节序号：1-2节=大节1，3-4节=大节2，5-6节=大节3，7-8节=大节4，9+节=晚
export function smallToBig(n) {
  n = Number(n)
  if (!Number.isFinite(n) || n <= 0) return 1
  if (n >= 9) return 5
  return Math.ceil(n / 2)
}

// 解析粘贴的课表文本 → 行结果数组（ok 行可直接导入，fail 行标红）
export function parseTimetableText(text) {
  const WD_MAP = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7 }
  const rows = []
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  for (const raw of lines) {
    let line = raw
    const row = { ok: false, raw, name: '', dow: 0, slotStart: 0, slotEnd: 0, classroom: '', weekStart: 1, weekEnd: 30, reason: '' }

    const wd = line.match(/(周|星期)\s*([一二三四五六日天1-7])/)
    if (!wd) {
      row.reason = '没找到星期（如“周一”）'
      rows.push(row)
      continue
    }
    row.dow = WD_MAP[wd[2]]
    line = line.replace(wd[0], ' ')

    const slotRange = line.match(/第?\s*(\d+)\s*[-~—到]\s*(\d+)\s*节?/)
    if (slotRange) {
      const a = Number(slotRange[1])
      const b = Number(slotRange[2])
      row.slotStart = smallToBig(Math.min(a, b))
      row.slotEnd = smallToBig(Math.max(a, b))
      line = line.replace(slotRange[0], ' ')
    } else {
      const slotOne = line.match(/第?\s*(\d+)\s*节/)
      if (slotOne) {
        row.slotStart = row.slotEnd = smallToBig(slotOne[1])
        line = line.replace(slotOne[0], ' ')
      } else {
        const tm = line.match(/(\d{1,2}):(\d{2})/)
        if (tm) {
          const mins = Number(tm[1]) * 60 + Number(tm[2])
          let idx = SLOT_TIMES.findIndex(s => Math.abs(minsToNum(s.start) - mins) <= 60)
          if (idx < 0) idx = 0
          row.slotStart = row.slotEnd = idx + 1
          line = line.replace(tm[0], ' ')
        } else {
          row.reason = '没找到节次（如“1-2节”或“08:00”）'
          rows.push(row)
          continue
        }
      }
    }

    const weekRange = line.match(/(\d+)\s*[-~—]\s*(\d+)\s*周/)
    if (weekRange) {
      row.weekStart = Number(weekRange[1])
      row.weekEnd = Number(weekRange[2])
      line = line.replace(weekRange[0], ' ')
    }

    // 剩余文本：第一段为课程名，之后的短段尝试当教室
    const rest = line.replace(/[,;，；|/、]+/g, ' ').split(/\s+/).filter(Boolean)
    if (!rest.length) {
      row.reason = '没找到课程名'
      rows.push(row)
      continue
    }
    row.name = rest[0]
    if (rest.length > 1 && rest[rest.length - 1].length <= 12) row.classroom = rest[rest.length - 1]
    row.slotStart = Math.min(Math.max(row.slotStart, 1), 5)
    row.slotEnd = Math.min(Math.max(row.slotEnd, row.slotStart), 5)
    row.ok = true
    rows.push(row)
  }
  return rows
}

function minsToNum(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
