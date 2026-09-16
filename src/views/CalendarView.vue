<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { plansStore } from '../stores/plans'
import { coursesStore, SLOT_TIMES } from '../stores/courses'
import { activitiesStore } from '../stores/activities.js'
import { settingsStore } from '../stores/settings'
import { todayStr, fmtCN, weekCN, monthGrid, timeToMinutes } from '../utils/date'
import PlanSheet from '../components/PlanSheet.vue'

const router = useRouter()
plansStore.init()
coursesStore.init()

const today = todayStr()
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1) // 1-12
const selected = ref(today)

const sheetShow = ref(false)
const editingPlan = ref(null)
const editingActivity = ref(null)

const grid = computed(() => monthGrid(year.value, month.value))
const monthTitle = computed(() => `${year.value}年${month.value}月`)

function hasItems(dateStr) {
  if (!dateStr) return false
  return plansStore.occurrencesOn(dateStr).length + coursesStore.coursesOn(dateStr).length > 0
}

function prevMonth() {
  if (month.value === 1) { year.value--; month.value = 12 } else month.value--
}
function nextMonth() {
  if (month.value === 12) { year.value++; month.value = 1 } else month.value++
}
function backToday() {
  const n = new Date()
  year.value = n.getFullYear()
  month.value = n.getMonth() + 1
  selected.value = today
}

// 某天的计划 + 课程，按时间排序
const dayItems = computed(() => {
  const d = selected.value
  const plans = plansStore.occurrencesOn(d).map(p => ({
    kind: 'plan', id: p.id, plan: p,
    title: p.title,
    time: p.time || '全天',
    order: timeToMinutes(p.time),
    color: settingsStore.catColor(p.categoryId),
    sub: p.time ? '计划' : '计划 · 全天'
  }))
  const courses = coursesStore.coursesOn(d).map(c => {
    const slot = SLOT_TIMES[c.slotStart - 1]
    const mark = c._adjust === 'makeup' ? '补课 · ' : c._adjust === 'move' ? '调课 · ' : ''
    return {
      kind: 'course', id: c.id, course: c,
      title: c.name,
      time: `${slot.start}-${slot.end}`,
      order: timeToMinutes(slot.start),
      color: c.color,
      sub: `${mark}${slot.label} · ${c.classroom || '无教室'} · 课程`
    }
  })
  const activities = activitiesStore.on(d).map(a => ({
    kind: 'activity', id: a.id, activity: a,
    title: a.title,
    time: a.end ? `${a.start}-${a.end}` : a.start || '全天',
    order: timeToMinutes(a.start),
    color: a.color,
    sub: `考试/活动${a.place ? ' · ' + a.place : ''}`
  }))
  return [...plans, ...courses, ...activities].sort((a, b) => a.order - b.order)
})

function openItem(item) {
  if (item.kind === 'plan') {
    editingPlan.value = item.plan
    editingActivity.value = null
    sheetShow.value = true
  } else if (item.kind === 'activity') {
    editingPlan.value = null
    editingActivity.value = item.activity
    sheetShow.value = true
  } else {
    router.push('/timetable')
  }
}

function addAtDay() {
  editingPlan.value = null
  editingActivity.value = null
  sheetShow.value = true
}
</script>

<template>
  <div class="page">
    <div class="page-hd">
      <div>
        <div class="page-title">日历</div>
        <div class="page-sub">计划与课程自动合并到每一天</div>
      </div>
      <button class="icon-btn" style="width:auto;padding:0 12px;border-radius:99px;font-size:12px" @click="router.push('/timetable')">
        课程表
      </button>
    </div>

    <div class="cal-head">
      <button class="cal-nav" @click="prevMonth">‹</button>
      <span @click="backToday">{{ monthTitle }}</span>
      <button class="cal-nav" @click="nextMonth">›</button>
    </div>
    <div class="dow-row">
      <span v-for="d in ['日', '一', '二', '三', '四', '五', '六']" :key="d">{{ d }}</span>
    </div>
    <div class="cal-grid">
      <template v-for="(cell, i) in grid" :key="i">
        <div v-if="cell" class="cal-cell" :class="{ sel: cell === selected, today: cell === today }" @click="selected = cell">
          <span>{{ Number(cell.slice(8)) }}</span>
          <span v-if="hasItems(cell)" class="dot"></span>
        </div>
        <div v-else class="cal-cell"></div>
      </template>
    </div>

    <div class="sec-label">{{ fmtCN(selected) }} {{ weekCN(selected) }} · {{ dayItems.length }} 项</div>
    <div v-if="dayItems.length" class="day-list">
      <div v-for="item in dayItems" :key="item.kind + item.id" class="day-item" @click="openItem(item)">
        <span class="day-bar" :style="{ background: item.color }"></span>
        <div class="di-main">
          <div class="di-title" :style="item.kind === 'plan' && plansStore.isDone(item.id, selected) ? 'text-decoration:line-through;color:var(--sub)' : ''">
            {{ item.title }}
          </div>
          <div class="di-sub">{{ item.time }} · {{ item.sub }}</div>
        </div>
        <span class="day-type">{{ item.kind === 'course' ? '课程' : item.kind === 'activity' ? '活动' : '计划' }}</span>
      </div>
    </div>
    <div v-else class="empty"><span class="em">📭</span>这一天还没有安排</div>

    <button class="add-day-btn" @click="addAtDay">＋ 添加计划到这一天</button>
    <PlanSheet v-model:show="sheetShow" :plan="editingPlan" :activity="editingActivity" :preset-date="selected" />
  </div>
</template>

<style scoped>
.add-day-btn {
  display: block; width: 100%; margin-top: 12px;
  padding: 12px; border-radius: 12px;
  border: 1px dashed var(--line); color: var(--ac); font-size: 13.5px; font-weight: 700;
  background: var(--card);
}
</style>
