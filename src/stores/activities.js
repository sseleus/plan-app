import { reactive, watch } from 'vue'
import { load, save, genId } from './storage.js'
import { todayStr } from '../utils/date.js'

// 固定时长活动（考试、面试、讲座等）：{ id, title, date, start 'HH:mm', end 'HH:mm', place, color, remind }
export const activitiesStore = reactive({
  ready: false,
  activities: [],

  init() {
    if (this.ready) return
    this.activities = load('activities', [])
    this.ready = true
    watch(() => this.activities, v => save('activities', v), { deep: true })
  },

  add(data) {
    this.activities.push({ id: genId(), place: '', remind: true, ...data })
  },

  update(id, data) {
    const a = this.activities.find(x => x.id === id)
    if (a) Object.assign(a, data)
  },

  remove(id) {
    this.activities = this.activities.filter(a => a.id !== id)
  },

  on(dateStr) {
    return this.activities.filter(a => a.date === dateStr)
  },

  upcoming() {
    const t = todayStr()
    return this.activities.filter(a => a.date >= t)
  }
})
