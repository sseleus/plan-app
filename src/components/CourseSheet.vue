<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { coursesStore, DAY_NAMES, COURSE_COLORS } from '../stores/courses.js'
import { slotCount, slotLabel } from '../stores/settings.js'

const props = defineProps({
  show: Boolean,
  course: { type: Object, default: null },
  presetDow: { type: Number, default: 1 }
})
const emit = defineEmits(['update:show'])

const PARITIES = [
  { v: 'all', t: '每周都上' },
  { v: 'odd', t: '单周' },
  { v: 'even', t: '双周' }
]

const form = reactive({
  name: '', dow: 1, slotStart: 1, slotEnd: 2, classroom: '', teacher: '',
  color: COURSE_COLORS[0], weekStart: 1, weekEnd: 30, parity: 'all', allTerm: true,
  startDate: '', weeksCount: 4
})
const weekMode = ref('date') // date = 开始日期+持续几周；weeks = 直接填周次

watch(
  () => props.show,
  v => {
    if (!v) return
    const c = props.course
    const custom = c && !(c.weekStart === 1 && c.weekEnd >= 30)
    Object.assign(form, {
      name: c?.name || '',
      dow: c?.dow || props.presetDow || 1,
      slotStart: c?.slotStart || 1,
      slotEnd: c?.slotEnd || c?.slotStart || 1,
      classroom: c?.classroom || '',
      teacher: c?.teacher || '',
      color: c?.color || COURSE_COLORS[coursesStore.courses.length % COURSE_COLORS.length],
      weekStart: c?.weekStart ?? 1,
      weekEnd: c?.weekEnd ?? 30,
      parity: c?.parity || 'all',
      allTerm: c ? !custom : false,
      startDate: '',
      weeksCount: 4
    })
    weekMode.value = c ? 'weeks' : 'date' // 编辑已有课程直接改周次；新建默认按日期
  }
)

// 节次起变化时节次止跟着钳制，避免出现止<起的隐形课程
watch(
  () => form.slotStart,
  v => {
    if (form.slotEnd < v) form.slotEnd = v
  }
)

// 按日期模式：开始日期 + 持续周数 → 换算成学期周次范围
const computedRange = computed(() => {
  if (form.allTerm || weekMode.value !== 'date' || !form.startDate) return null
  const start = Math.max(1, coursesStore.weekOf(form.startDate))
  const weeks = Math.max(1, Math.min(30, Number(form.weeksCount) || 1))
  return [start, Math.min(30, start + weeks - 1)]
})

function close() {
  emit('update:show', false)
}

function save() {
  const name = form.name.trim()
  if (!name) return
  let weekStart = 1
  let weekEnd = 30
  if (!form.allTerm) {
    if (computedRange.value) {
      ;[weekStart, weekEnd] = computedRange.value
    } else {
      weekStart = Math.max(1, Number(form.weekStart) || 1)
      weekEnd = Math.max(weekStart, Number(form.weekEnd) || 30)
    }
  }
  const data = {
    name, dow: form.dow, slotStart: form.slotStart, slotEnd: form.slotEnd,
    classroom: form.classroom, teacher: form.teacher, color: form.color,
    weekStart, weekEnd, parity: form.parity
  }
  if (props.course) coursesStore.update(props.course.id, data)
  else coursesStore.add(data)
  close()
}

function del() {
  if (props.course && confirm(`删除课程「${props.course.name}」？`)) {
    coursesStore.remove(props.course.id)
    close()
  }
}
</script>

<template>
  <template v-if="show">
    <div class="dim" @click="close"></div>
    <div class="sheet">
      <div class="sheet-title">{{ course ? '编辑课程' : '添加课程' }}</div>

      <input v-model="form.name" class="inp" placeholder="课程名称，例如：高等数学" maxlength="30" />

      <div class="field-label">星期</div>
      <div class="chip-row">
        <button v-for="(d, i) in DAY_NAMES" :key="d" class="chip" :class="{ on: form.dow === i + 1 }" @click="form.dow = i + 1">
          {{ d }}
        </button>
      </div>

      <div class="field-label">节次</div>
      <div class="row2">
        <select v-model.number="form.slotStart" class="inp">
          <option v-for="s in slotCount()" :key="s" :value="s">{{ slotLabel(s - 1) }} 起</option>
        </select>
        <select v-model.number="form.slotEnd" class="inp">
          <option v-for="s in slotCount()" :key="s" :value="s" :disabled="s < form.slotStart">{{ slotLabel(s - 1) }} 止</option>
        </select>
      </div>

      <div class="field-label">教室 · 老师</div>
      <div class="row2">
        <input v-model="form.classroom" class="inp" placeholder="教室，如 教一A101" maxlength="20" />
        <input v-model="form.teacher" class="inp" placeholder="老师（可选）" maxlength="20" />
      </div>

      <div class="field-label">颜色</div>
      <div class="chip-row">
        <button
          v-for="c in COURSE_COLORS"
          :key="c"
          class="color-dot"
          :class="{ on: form.color === c }"
          :style="{ background: c }"
          @click="form.color = c"
        ></button>
      </div>

      <div class="field-label">上课周次</div>
      <div class="chip-row">
        <button
          v-for="p in PARITIES"
          :key="p.v"
          class="chip"
          :class="{ on: form.parity === p.v }"
          @click="form.parity = p.v"
        >
          {{ p.t }}
        </button>
      </div>

      <div class="field-label">持续时段</div>
      <div class="row-plain remind-box">
        <div class="row-title">全学期（1-30 周）</div>
        <button class="switch" :class="{ on: form.allTerm }" @click="form.allTerm = !form.allTerm"></button>
      </div>

      <template v-if="!form.allTerm">
        <div class="chip-row mt10">
          <button class="chip" :class="{ on: weekMode === 'date' }" @click="weekMode = 'date'">从某天开始上几周</button>
          <button class="chip" :class="{ on: weekMode === 'weeks' }" @click="weekMode = 'weeks'">直接填周次</button>
        </div>

        <template v-if="weekMode === 'date'">
          <div class="field-label">从哪一天开始上</div>
          <input v-model="form.startDate" class="inp" type="date" />
          <div class="field-label">持续几周后结束</div>
          <input v-model.number="form.weeksCount" class="inp" type="number" min="1" max="30" />
          <div v-if="computedRange" class="row-sub" style="margin-top: 6px">
            即第 {{ computedRange[0] }} ~ {{ computedRange[1] }} 周
          </div>
        </template>

        <div v-else class="row2 mt10">
          <input v-model.number="form.weekStart" class="inp" type="number" min="1" max="30" placeholder="起始周" />
          <input v-model.number="form.weekEnd" class="inp" type="number" min="1" max="30" placeholder="结束周" />
        </div>
      </template>

      <div class="sheet-actions">
        <button v-if="course" class="btn btn-danger" @click="del">删除</button>
        <button class="btn btn-ghost" @click="close">取消</button>
        <button class="btn btn-primary" :disabled="!form.name.trim()" @click="save">保存</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.remind-box { padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; }
.color-dot { width: 30px; height: 30px; border-radius: 50%; border: 3px solid transparent; }
.color-dot.on { border-color: var(--tx); }
</style>
