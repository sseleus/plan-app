<script setup>
import { computed } from 'vue'
import { plansStore } from '../stores/plans'
import { todayStr, addDays, weekDatesOf, weekCN } from '../utils/date'

plansStore.init()
const today = todayStr()

// 本周完成率：只统计本周已过去的日子
const weekRate = computed(() => {
  const days = weekDatesOf(today).filter(d => d <= today)
  let total = 0
  let done = 0
  for (const d of days) {
    for (const p of plansStore.occurrencesOn(d)) {
      total++
      if (plansStore.isDone(p.id, d)) done++
    }
  }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0, days: days.length }
})

// 连续打卡：从今天（或昨天）往前数“有计划且全部完成”的天数
const streak = computed(() => {
  let start = today
  const qualifies = d => {
    const list = plansStore.occurrencesOn(d)
    return list.length > 0 && list.every(p => plansStore.isDone(p.id, d))
  }
  if (!qualifies(today)) start = addDays(today, -1)
  let n = 0
  let d = start
  while (qualifies(d) && n < 365) {
    n++
    d = addDays(d, -1)
  }
  return n
})

// 近 7 天完成数
const last7 = computed(() => {
  const arr = []
  let max = 1
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i)
    const done = plansStore.occurrencesOn(d).filter(p => plansStore.isDone(p.id, d)).length
    max = Math.max(max, done)
    arr.push({ date: d, done, label: weekCN(d).replace('周', '') })
  }
  for (const a of arr) a.h = Math.round((a.done / max) * 100)
  return arr
})
</script>

<template>
  <div class="page">
    <div class="page-hd">
      <div>
        <div class="page-title">统计</div>
        <div class="page-sub">数据只保存在这台设备上</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-row">
        <div class="ring" :style="{ '--pct': weekRate.pct + '%' }">
          <div class="ring-inner">
            <b>{{ weekRate.total ? weekRate.pct + '%' : '--' }}</b>
            <i>本周完成率</i>
          </div>
        </div>
        <div>
          <div class="stat-title">已完成 {{ weekRate.done }} 项</div>
          <div class="stat-sub">
            未完成 {{ weekRate.total - weekRate.done }} 项<br />
            本周已过 {{ weekRate.days }} 天
          </div>
        </div>
      </div>
    </div>

    <div class="streak-card">
      <div>
        <b>🔥 连续打卡 {{ streak }} 天</b>
        <div class="st-sub">{{ streak > 0 ? '继续保持，别断了！' : '今天完成全部计划就开始计算' }}</div>
      </div>
      <div class="st-em">🏆</div>
    </div>

    <div class="stat-card">
      <div class="stat-title" style="margin-bottom: 10px">近 7 天完成数</div>
      <div class="bar-chart">
        <div v-for="d in last7" :key="d.date" class="bar-col">
          <div class="bar" :style="{ height: d.h + '%' }"></div>
          <span class="bar-label">{{ d.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
