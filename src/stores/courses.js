import { reactive, watch } from 'vue'
import { load, save, genId } from './storage.js'
import { weekdayMon1, fromStr, addDays } from '../utils/date.js'
import { settingsStore, slotCount } from './settings.js'

export const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export const COURSE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#ef4444', '#64748b']

// 课程：{ id, name, dow 1-7, slotStart/slotEnd 1..slotCount()（大节序号）, classroom, teacher, color,
//         weekStart, weekEnd, parity 'all|odd|even'（单双周） }
// 大节的名称/时间/小节归属在 settings.slotTimes 里配置
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
    this.courses.push({ id: genId(), classroom: '', teacher: '', parity: 'all', ...data })
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
    if (week < c.weekStart || week > c.weekEnd) return false
    if (c.parity === 'odd' && week % 2 === 0) return false
    if (c.parity === 'even' && week % 2 === 1) return false
    return true
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
    const count = slotCount()
    const grid = Array.from({ length: count }, () => Array(7).fill(null))
    for (let d = 0; d < 7; d++) {
      const date = addDays(mon, d)
      for (const c of this.coursesOn(date)) {
        const col = weekdayMon1(date) - 1
        for (let s = c.slotStart; s <= Math.min(c.slotEnd, count); s++) {
          grid[s - 1][col] = c
        }
      }
    }
    return grid
  }
})
