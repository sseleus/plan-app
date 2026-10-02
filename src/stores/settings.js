import { reactive, watch } from 'vue'
import { load, save } from './storage.js'

export const DEFAULT_CATEGORIES = [
  { id: 'work', name: '工作', color: '#3b82f6' },
  { id: 'study', name: '学习', color: '#10b981' },
  { id: 'life', name: '生活', color: '#f59e0b' }
]

export const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#64748b']

// 大节配置：from/to = 该大节覆盖的小节编号，start/end = 上下课时间
// label 可选（如「晚」），缺省时自动按小节范围生成（如「3-5节」）
export const DEFAULT_SLOT_TIMES = [
  { from: 1, to: 2, start: '08:00', end: '09:40', label: '' },
  { from: 3, to: 4, start: '10:00', end: '11:40', label: '' },
  { from: 5, to: 6, start: '14:00', end: '15:40', label: '' },
  { from: 7, to: 8, start: '16:00', end: '17:40', label: '' },
  { from: 9, to: 12, start: '19:00', end: '20:40', label: '晚' }
]

function validSlotTimes(v) {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    v.every(s => Number.isInteger(s.from) && Number.isInteger(s.to) && s.from >= 1 && s.from <= s.to && /^\d{1,2}:\d{2}$/.test(s.start) && /^\d{1,2}:\d{2}$/.test(s.end))
  )
}

export const settingsStore = reactive({
  ready: false,
  theme: 'auto', // auto | light | dark
  categories: [],
  remindersOn: true,
  reminderMinutes: 10,
  term: { name: '2026 秋季学期', startDate: '2026-09-07' },
  slotTimes: DEFAULT_SLOT_TIMES,

  init() {
    if (this.ready) return
    this.theme = load('theme', 'auto')
    this.categories = load('categories', DEFAULT_CATEGORIES)
    this.remindersOn = load('remindersOn', true)
    this.reminderMinutes = load('reminderMinutes', 10)
    this.term = load('term', { name: '2026 秋季学期', startDate: '2026-09-07' })
    const savedSlots = load('slotTimes', null)
    this.slotTimes = validSlotTimes(savedSlots) ? savedSlots : JSON.parse(JSON.stringify(DEFAULT_SLOT_TIMES))
    this.ready = true

    watch(() => this.theme, v => save('theme', v))
    watch(() => this.categories, v => save('categories', v), { deep: true })
    watch(() => this.remindersOn, v => save('remindersOn', v))
    watch(() => this.reminderMinutes, v => save('reminderMinutes', v))
    watch(() => this.term, v => save('term', v), { deep: true })
    watch(() => this.slotTimes, v => save('slotTimes', v), { deep: true })

    this.applyTheme()
    // 跟随系统：系统切换明暗时实时生效
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.theme === 'auto') this.applyTheme()
    })
  },

  resolvedTheme() {
    if (this.theme !== 'auto') return this.theme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  },

  applyTheme() {
    document.documentElement.dataset.theme = this.resolvedTheme()
  },

  setTheme(t) {
    this.theme = t
    this.applyTheme()
  },

  catById(id) {
    return this.categories.find(c => c.id === id)
  },

  catColor(id) {
    return (this.catById(id) || {}).color || '#64748b'
  },

  addCategory(name, color) {
    this.categories.push({ id: 'c' + Date.now().toString(36), name, color })
  },

  removeCategory(id) {
    this.categories = this.categories.filter(c => c.id !== id)
  },

  nextCategoryColor() {
    return CATEGORY_COLORS[this.categories.length % CATEGORY_COLORS.length]
  }
})

// —— 节次配置辅助（供课程表、解析器等处使用）——

export function slotTimes() {
  if (!settingsStore.ready) settingsStore.init()
  return validSlotTimes(settingsStore.slotTimes) ? settingsStore.slotTimes : DEFAULT_SLOT_TIMES
}

export function slotCount() {
  return slotTimes().length
}

// 大节名称：自定义 label 优先，否则按小节范围（如「3-5节」）
export function slotLabel(i) {
  const s = slotTimes()[i]
  if (!s) return ''
  if (s.label) return s.label
  return s.from === s.to ? `${s.from}节` : `${s.from}-${s.to}节`
}

// 网格表头用的短名称
export function slotShort(i) {
  const s = slotTimes()[i]
  if (!s) return ''
  if (s.label) return s.label
  return s.from === s.to ? `${s.from}` : `${s.from}-${s.to}`
}

// 小节号 → 大节序号（1 起）：按配置的小节归属查找，落在范围外时就近归到第一节/最后一节
export function smallToBig(n) {
  n = Number(n)
  const slots = slotTimes()
  if (!Number.isFinite(n) || n <= 0) return 1
  for (let i = 0; i < slots.length; i++) {
    if (n >= slots[i].from && n <= slots[i].to) return i + 1
  }
  if (n < slots[0].from) return 1
  return slots.length
}
