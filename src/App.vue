<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { settingsStore } from './stores/settings'
import { plansStore } from './stores/plans'
import { coursesStore } from './stores/courses'
import { activitiesStore } from './stores/activities.js'
import { startReminderLoop } from './utils/reminders'

const route = useRoute()
// 统一初始化：各视图可能单独调用 init，但入口处保证全部就绪
settingsStore.init()
plansStore.init()
coursesStore.init()
activitiesStore.init()
startReminderLoop()

const tabs = [
  { path: '/today', label: '今日' },
  { path: '/calendar', label: '日历' },
  { path: '/stats', label: '统计' },
  { path: '/settings', label: '我的' }
]

const showTabBar = computed(() => route.path !== '/timetable')
</script>

<template>
  <div class="app-shell">
    <router-view />
    <nav v-if="showTabBar" class="tab-bar">
      <router-link
        v-for="t in tabs"
        :key="t.path"
        :to="t.path"
        class="tab-item"
        :class="{ on: route.path === t.path }"
      >
        {{ t.label }}
      </router-link>
    </nav>
  </div>
</template>
