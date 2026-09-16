<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { plansStore } from '../stores/plans.js'
import { activitiesStore } from '../stores/activities.js'
import { settingsStore } from '../stores/settings.js'
import { todayStr, fmtCN, weekCN } from '../utils/date.js'
import PlanSheet from '../components/PlanSheet.vue'

const router = useRouter()
const today = todayStr()

const sheetShow = ref(false)
const editingPlan = ref(null)
const editingActivity = ref(null)

const items = computed(() => plansStore.occurrencesOn(today))
const doneCount = computed(() => items.value.filter(p => plansStore.isDone(p.id, today)).length)
const pct = computed(() => (items.value.length ? Math.round((doneCount.value / items.value.length) * 100) : 0))

const activitiesToday = computed(() => activitiesStore.on(today))

function actSub(a) {
  const parts = []
  if (a.start) parts.push(a.end ? `${a.start}-${a.end}` : a.start)
  if (a.place) parts.push(a.place)
  if (a.remind) parts.push('🔔')
  return parts.join(' · ') || '全天'
}

const groups = computed(() => {
  const arr = []
  for (const cat of settingsStore.categories) {
    const list = items.value.filter(p => p.categoryId === cat.id)
    if (list.length) arr.push({ cat, list })
  }
  // 分类被删除后，其计划归入「其他」
  const known = new Set(settingsStore.categories.map(c => c.id))
  const others = items.value.filter(p => !known.has(p.categoryId))
  if (others.length) arr.push({ cat: { id: '_other', name: '其他', color: '#64748b' }, list: others })
  return arr
})

const REPEAT_CN = { none: '', daily: '每天', weekly: '每周', weekdays: '工作日' }

function subOf(p) {
  const parts = []
  if (p.time) parts.push(p.time)
  if (REPEAT_CN[p.repeat]) parts.push(REPEAT_CN[p.repeat])
  if (p.remind && p.time) parts.push('🔔')
  return parts.join(' · ') || '全天'
}

function toggle(p) {
  plansStore.toggleDone(p.id, today)
}

function openCreate() {
  editingPlan.value = null
  editingActivity.value = null
  sheetShow.value = true
}

function openEdit(p) {
  editingPlan.value = p
  editingActivity.value = null
  sheetShow.value = true
}

function openEditActivity(a) {
  editingPlan.value = null
  editingActivity.value = a
  sheetShow.value = true
}

function delActivity(a) {
  if (confirm(`删除「${a.title}」？`)) activitiesStore.remove(a.id)
}

function del(p) {
  const tip = p.repeat !== 'none' ? `删除计划「${p.title}」？其所有重复日期都会删除` : `删除计划「${p.title}」？`
  if (confirm(tip)) plansStore.remove(p.id)
}
</script>

<template>
  <div class="page">
    <div class="page-hd">
      <div>
        <div class="h-date">{{ fmtCN(today) }} {{ weekCN(today) }}</div>
        <div class="page-sub">今天有 {{ items.length }} 个计划 · 已完成 {{ doneCount }}</div>
      </div>
      <button class="icon-btn" @click="router.push('/settings')">⚙</button>
    </div>

    <div class="pbar"><div class="pfill" :style="{ width: pct + '%' }"></div></div>
    <div class="p-sub">今日进度 {{ doneCount }}/{{ items.length }}</div>

    <template v-if="activitiesToday.length">
      <div class="sec-label">考试 · 活动</div>
      <div v-for="a in activitiesToday" :key="a.id" class="task-card" @click="openEditActivity(a)">
        <span class="day-bar" :style="{ background: a.color }"></span>
        <div class="t-main">
          <div class="t-title">{{ a.title }}</div>
          <div class="t-sub">{{ actSub(a) }}</div>
        </div>
        <button class="t-del" @click.stop="delActivity(a)">✕</button>
      </div>
    </template>

    <template v-if="groups.length">
      <div v-for="g in groups" :key="g.cat.id">
        <div class="sec-label">{{ g.cat.name }}</div>
        <div
          v-for="p in g.list"
          :key="p.id"
          class="task-card"
          :class="{ done: plansStore.isDone(p.id, today) }"
          @click="openEdit(p)"
        >
          <span class="ck" :class="{ on: plansStore.isDone(p.id, today) }" @click.stop="toggle(p)">✓</span>
          <div class="t-main">
            <div class="t-title">{{ p.title }}</div>
            <div class="t-sub">{{ subOf(p) }}</div>
          </div>
          <span v-if="p.priority === 'high'" class="prio-tag high">高</span>
          <span v-else-if="p.priority === 'mid'" class="prio-tag mid">中</span>
          <button class="t-del" @click.stop="del(p)">✕</button>
        </div>
      </div>
    </template>

    <div v-if="!groups.length && !activitiesToday.length" class="empty">
      <span class="em">🌤</span>今天还没有计划<br />点右下角 ＋ 添加一个吧
    </div>

    <button class="fab" @click="openCreate">＋</button>
    <PlanSheet v-model:show="sheetShow" :plan="editingPlan" :activity="editingActivity" />
  </div>
</template>
