import { createRouter, createWebHashHistory } from 'vue-router'
import TodayView from './views/TodayView.vue'
import CalendarView from './views/CalendarView.vue'
import TimetableView from './views/TimetableView.vue'
import StatsView from './views/StatsView.vue'
import SettingsView from './views/SettingsView.vue'

// hash 模式：静态托管与 PWA 离线场景下无需服务端路由回退
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/today' },
    { path: '/today', component: TodayView },
    { path: '/calendar', component: CalendarView },
    { path: '/timetable', component: TimetableView },
    { path: '/stats', component: StatsView },
    { path: '/settings', component: SettingsView }
  ]
})
