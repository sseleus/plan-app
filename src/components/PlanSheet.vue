<script setup>
import { reactive, ref, watch } from 'vue'
import { plansStore } from '../stores/plans.js'
import { activitiesStore } from '../stores/activities.js'
import { settingsStore } from '../stores/settings.js'
import { todayStr } from '../utils/date.js'
import { COURSE_COLORS } from '../stores/courses.js'

const props = defineProps({
  show: Boolean,
  plan: { type: Object, default: null },
  activity: { type: Object, default: null },
  presetDate: { type: String, default: '' },
  initialMode: { type: String, default: 'plan' } // plan | activity
})
const emit = defineEmits(['update:show'])

const REPEATS = [
  { v: 'none', t: '不重复' },
  { v: 'daily', t: '每天' },
  { v: 'weekly', t: '每周' },
  { v: 'weekdays', t: '工作日' }
]
const PRIOS = [
  { v: 'high', t: '高' },
  { v: 'mid', t: '中' },
  { v: 'low', t: '低' }
]

const mode = ref('plan')
const form = reactive({
  title: '', categoryId: '', date: '', time: '', repeat: 'none', priority: 'mid', remind: false
})
const actForm = reactive({
  title: '', date: '', start: '', end: '', place: '', color: '#ef4444', remind: true
})

function fillForms() {
  const p = props.plan
  Object.assign(form, {
    title: p?.title || '',
    categoryId: p?.categoryId || settingsStore.categories[0]?.id || '',
    date: p?.date || props.presetDate || todayStr(),
    time: p?.time || '',
    repeat: p?.repeat || 'none',
    priority: p?.priority || 'mid',
    remind: !!p?.remind
  })
  const a = props.activity
  Object.assign(actForm, {
    title: a?.title || '',
    date: a?.date || props.presetDate || todayStr(),
    start: a?.start || '',
    end: a?.end || '',
    place: a?.place || '',
    color: a?.color || '#ef4444',
    remind: a ? !!a.remind : true
  })
}

watch(
  () => props.show,
  v => {
    if (!v) return
    mode.value = props.activity ? 'activity' : props.initialMode
    fillForms()
  }
)

function close() {
  emit('update:show', false)
}

function save() {
  if (mode.value === 'plan') {
    const title = form.title.trim()
    if (!title) return
    const data = { ...form, title }
    if (props.plan) plansStore.update(props.plan.id, data)
    else plansStore.add(data)
  } else {
    const title = actForm.title.trim()
    if (!title || !actForm.date) return
    const data = { ...actForm, title }
    if (props.activity) activitiesStore.update(props.activity.id, data)
    else activitiesStore.add(data)
  }
  close()
}
</script>

<template>
  <template v-if="show">
    <div class="dim" @click="close"></div>
    <div class="sheet">
      <div class="chip-row" style="margin-bottom: 12px">
        <button class="chip" :class="{ on: mode === 'plan' }" @click="mode = 'plan'">计划</button>
        <button class="chip" :class="{ on: mode === 'activity' }" @click="mode = 'activity'">考试 / 活动</button>
      </div>

      <!-- 计划表单 -->
      <template v-if="mode === 'plan'">
        <div class="sheet-title">{{ plan ? '编辑计划' : '新建计划' }}</div>
        <input v-model="form.title" class="inp" placeholder="要做点什么？例如：写周报" maxlength="50" />

        <div class="field-label">分类</div>
        <div class="chip-row">
          <button
            v-for="c in settingsStore.categories"
            :key="c.id"
            class="chip"
            :class="{ on: form.categoryId === c.id }"
            @click="form.categoryId = c.id"
          >
            {{ c.name }}
          </button>
        </div>

        <div class="field-label">日期 · 时间</div>
        <div class="row2">
          <input v-model="form.date" class="inp" type="date" />
          <input v-model="form.time" class="inp" type="time" />
        </div>

        <div class="field-label">重复</div>
        <div class="chip-row">
          <button
            v-for="r in REPEATS"
            :key="r.v"
            class="chip"
            :class="{ on: form.repeat === r.v }"
            @click="form.repeat = r.v"
          >
            {{ r.t }}
          </button>
        </div>

        <div class="field-label">优先级</div>
        <div class="chip-row">
          <button
            v-for="pr in PRIOS"
            :key="pr.v"
            class="chip"
            :class="{ on: form.priority === pr.v }"
            @click="form.priority = pr.v"
          >
            {{ pr.t }}
          </button>
        </div>

        <div class="field-label">提醒</div>
        <div class="row-plain remind-box">
          <div>
            <div class="row-title">到点通知我</div>
            <div class="row-sub">提前 {{ settingsStore.reminderMinutes }} 分钟 · 需授权浏览器通知（可在「我的」里开启）</div>
          </div>
          <button class="switch" :class="{ on: form.remind }" @click="form.remind = !form.remind"></button>
        </div>
      </template>

      <!-- 考试 / 活动表单 -->
      <template v-else>
        <div class="sheet-title">{{ activity ? '编辑考试 / 活动' : '新建考试 / 活动' }}</div>
        <input v-model="actForm.title" class="inp" placeholder="名称，例如：高等数学期末考试" maxlength="50" />

        <div class="field-label">日期</div>
        <input v-model="actForm.date" class="inp" type="date" />

        <div class="field-label">开始 · 结束时间</div>
        <div class="row2">
          <input v-model="actForm.start" class="inp" type="time" />
          <input v-model="actForm.end" class="inp" type="time" />
        </div>

        <div class="field-label">地点（可选）</div>
        <input v-model="actForm.place" class="inp" placeholder="例如：教三 C305" maxlength="30" />

        <div class="field-label">颜色</div>
        <div class="chip-row">
          <button
            v-for="c in COURSE_COLORS"
            :key="c"
            class="color-dot"
            :class="{ on: actForm.color === c }"
            :style="{ background: c }"
            @click="actForm.color = c"
          ></button>
        </div>

        <div class="field-label">提醒</div>
        <div class="row-plain remind-box">
          <div>
            <div class="row-title">到点通知我</div>
            <div class="row-sub">提前 {{ settingsStore.reminderMinutes }} 分钟</div>
          </div>
          <button class="switch" :class="{ on: actForm.remind }" @click="actForm.remind = !actForm.remind"></button>
        </div>
      </template>

      <div class="sheet-actions">
        <button class="btn btn-ghost" @click="close">取消</button>
        <button
          class="btn btn-primary"
          :disabled="mode === 'plan' ? !form.title.trim() : !actForm.title.trim() || !actForm.date"
          @click="save"
        >
          保存
        </button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.remind-box {
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.color-dot { width: 30px; height: 30px; border-radius: 50%; border: 3px solid transparent; }
.color-dot.on { border-color: var(--tx); }
</style>
