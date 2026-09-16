import { reactive, watch } from 'vue'
import { load, save } from './storage.js'

export const DEFAULT_CATEGORIES = [
  { id: 'work', name: '工作', color: '#3b82f6' },
  { id: 'study', name: '学习', color: '#10b981' },
  { id: 'life', name: '生活', color: '#f59e0b' }
]

export const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444', '#64748b']

export const settingsStore = reactive({
  ready: false,
  theme: 'auto', // auto | light | dark
  categories: [],
  remindersOn: true,
  reminderMinutes: 10,
  term: { name: '2026 秋季学期', startDate: '2026-09-07' },

  init() {
    if (this.ready) return
    this.theme = load('theme', 'auto')
    this.categories = load('categories', DEFAULT_CATEGORIES)
    this.remindersOn = load('remindersOn', true)
    this.reminderMinutes = load('reminderMinutes', 10)
    this.term = load('term', { name: '2026 秋季学期', startDate: '2026-09-07' })
    this.ready = true

    watch(() => this.theme, v => save('theme', v))
    watch(() => this.categories, v => save('categories', v), { deep: true })
    watch(() => this.remindersOn, v => save('remindersOn', v))
    watch(() => this.reminderMinutes, v => save('reminderMinutes', v))
    watch(() => this.term, v => save('term', v), { deep: true })

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
