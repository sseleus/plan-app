import { reactive, watch } from 'vue'
import { load, save, genId } from './storage.js'
import { weekdayMon1 } from '../utils/date.js'

// 计划：{ id, title, categoryId, date 'YYYY-MM-DD', time 'HH:mm'|'', priority 'high|mid|low',
//         repeat 'none|daily|weekly|weekdays', remind bool, createdAt }
// 完成状态按「计划 × 日期」记录，重复计划每天独立打卡
export const plansStore = reactive({
  ready: false,
  plans: [],
  done: {},

  init() {
    if (this.ready) return
    this.plans = load('plans', [])
    this.done = load('done', {})
    this.ready = true
    watch(() => this.plans, v => save('plans', v), { deep: true })
    watch(() => this.done, v => save('done', v), { deep: true })
  },

  add(data) {
    this.plans.unshift({ id: genId(), createdAt: Date.now(), remind: false, time: '', ...data })
  },

  update(id, data) {
    const p = this.plans.find(x => x.id === id)
    if (p) Object.assign(p, data)
  },

  remove(id) {
    this.plans = this.plans.filter(p => p.id !== id)
    for (const k of Object.keys(this.done)) {
      if (k.startsWith(id + '|')) delete this.done[k]
    }
  },

  doneKey(planId, date) {
    return `${planId}|${date}`
  },

  isDone(planId, date) {
    return !!this.done[this.doneKey(planId, date)]
  },

  toggleDone(planId, date) {
    const k = this.doneKey(planId, date)
    if (this.done[k]) delete this.done[k]
    else this.done[k] = true
  },

  // 某计划在某天是否发生（含重复展开）
  occursOn(plan, date) {
    if (!plan.date || date < plan.date) return false
    switch (plan.repeat) {
      case 'daily':
        return true
      case 'weekly':
        return weekdayMon1(date) === weekdayMon1(plan.date)
      case 'weekdays':
        return weekdayMon1(date) <= 5
      default:
        return date === plan.date
    }
  },

  // 某天的所有计划实例（已展开重复）
  occurrencesOn(date) {
    return this.plans.filter(p => this.occursOn(p, date))
  }
})
