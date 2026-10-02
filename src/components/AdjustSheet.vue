<script setup>
import { reactive, watch } from 'vue'
import { coursesStore, DAY_NAMES } from '../stores/courses'
import { slotCount, slotLabel } from '../stores/settings'
import { todayStr } from '../utils/date'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['update:show'])

const KINDS = [
  { v: 'cancel', t: '取消本次' },
  { v: 'move', t: '调整时间' },
  { v: 'makeup', t: '补课·调休' }
]

const form = reactive({ courseId: '', kind: 'cancel', week: 1, date: '', slotStart: 1, slotEnd: 2 })

watch(
  () => props.show,
  v => {
    if (!v) return
    Object.assign(form, {
      courseId: coursesStore.courses[0]?.id || '',
      kind: 'cancel',
      week: Math.max(coursesStore.weekOf(todayStr()), 1),
      date: todayStr(),
      slotStart: 1,
      slotEnd: 2
    })
  }
)

const kindHint = {
  cancel: '所选周次里这门课不再出现（如放假、老师请假）',
  move: '所选周次的原时间不再上课，改到目标日期的目标节次上',
  makeup: '在目标日期额外加一次课（原周次的课不受影响，适合周末补课）'
}

function save() {
  if (!form.courseId) return
  if (form.kind === 'cancel') {
    coursesStore.addAdjustment({ courseId: form.courseId, kind: 'cancel', week: form.week })
  } else {
    if (!form.date) return
    coursesStore.addAdjustment({
      courseId: form.courseId,
      kind: form.kind,
      week: form.week,
      date: form.date,
      slotStart: form.slotStart,
      slotEnd: form.slotEnd
    })
  }
  emit('update:show', false)
}
</script>

<template>
  <template v-if="show">
    <div class="dim" @click="emit('update:show', false)"></div>
    <div class="sheet">
      <div class="sheet-title">调课 / 调休</div>

      <div class="field-label">类型</div>
      <div class="chip-row">
        <button v-for="k in KINDS" :key="k.v" class="chip" :class="{ on: form.kind === k.v }" @click="form.kind = k.v">
          {{ k.t }}
        </button>
      </div>
      <div class="kind-hint">{{ kindHint[form.kind] }}</div>

      <div class="field-label">课程</div>
      <div class="chip-row">
        <button
          v-for="c in coursesStore.courses"
          :key="c.id"
          class="chip"
          :class="{ on: form.courseId === c.id }"
          @click="form.courseId = c.id"
        >
          {{ c.name }}
        </button>
      </div>
      <div v-if="!coursesStore.courses.length" class="kind-hint">还没有课程，先点右上角 ＋ 或导入课表</div>

      <template v-if="form.kind !== 'makeup'">
        <div class="field-label">是哪一周的课</div>
        <select v-model.number="form.week" class="inp">
          <option v-for="w in 30" :key="w" :value="w">第 {{ w }} 周</option>
        </select>
      </template>

      <template v-if="form.kind !== 'cancel'">
        <div class="field-label">{{ form.kind === 'makeup' ? '补课日期' : '调到哪一天' }}</div>
        <input v-model="form.date" class="inp" type="date" />
        <div class="field-label">节次</div>
        <div class="row2">
          <select v-model.number="form.slotStart" class="inp" @change="form.slotEnd < form.slotStart && (form.slotEnd = form.slotStart)">
            <option v-for="s in slotCount()" :key="s" :value="s">{{ slotLabel(s - 1) }} 起</option>
          </select>
          <select v-model.number="form.slotEnd" class="inp">
            <option v-for="s in slotCount()" :key="s" :value="s" :disabled="s < form.slotStart">{{ slotLabel(s - 1) }} 止</option>
          </select>
        </div>
      </template>

      <div class="sheet-actions">
        <button class="btn btn-ghost" @click="emit('update:show', false)">取消</button>
        <button class="btn btn-primary" :disabled="!form.courseId" @click="save">保存调整</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.kind-hint {
  font-size: 11px;
  color: var(--sub);
  line-height: 1.6;
  margin-top: 6px;
}
</style>
