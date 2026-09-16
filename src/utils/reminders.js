import { plansStore } from '../stores/plans.js'
import { activitiesStore } from '../stores/activities.js'
import { settingsStore } from '../stores/settings.js'
import { todayStr, timeToMinutes } from './date.js'

// 前台提醒：App 打开期间每 30 秒检查一次临期计划并弹浏览器通知
// （系统级推送需要服务端，超出本地版范围；页面关闭时提醒自然停止）
const notified = new Set()
let timer = null

export function startReminderLoop() {
  if (timer) return
  timer = setInterval(checkReminders, 30000)
  checkReminders()
}

export function notificationsAvailable() {
  return typeof Notification !== 'undefined'
}

export function notificationState() {
  return notificationsAvailable() ? Notification.permission : 'unsupported'
}

export function requestNotifyPermission() {
  if (!notificationsAvailable() || Notification.permission !== 'default') {
    return Promise.resolve(notificationState())
  }
  return Notification.requestPermission()
}

export function checkReminders() {
  if (!settingsStore.ready || !settingsStore.remindersOn) return
  if (!notificationsAvailable() || Notification.permission !== 'granted') return
  if (document.hidden) return // 后台标签页不弹，回前台再查

  const today = todayStr()
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const due = []
  for (const p of plansStore.occurrencesOn(today)) {
    if (!p.time || !p.remind) continue
    if (plansStore.isDone(p.id, today)) continue
    due.push({ key: `p|${p.id}|${today}`, time: p.time, title: p.title })
  }
  for (const a of activitiesStore.activities) {
    if (a.date !== today || !a.start || !a.remind) continue
    due.push({ key: `a|${a.id}|${today}`, time: a.start, title: a.title })
  }
  for (const it of due) {
    const diff = timeToMinutes(it.time) - nowMin
    if (diff < 0 || diff > settingsStore.reminderMinutes) continue
    if (notified.has(it.key)) continue
    notified.add(it.key)
    new Notification('计划提醒', {
      body: diff === 0 ? `${it.time} · ${it.title}（就是现在！）` : `${it.time} · ${it.title}（还有 ${diff} 分钟）`,
      tag: it.key
    })
  }
}
