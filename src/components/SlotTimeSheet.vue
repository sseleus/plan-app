<script setup>
import { ref, watch } from 'vue'
import { settingsStore, DEFAULT_SLOT_TIMES } from '../stores/settings.js'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['update:show'])

const rows = ref([])
const err = ref('')

watch(
  () => props.show,
  v => {
    if (!v) return
    rows.value = settingsStore.slotTimes.map(s => ({ ...s, label: s.label || '' }))
    err.value = ''
  }
)

function restoreDefault() {
  rows.value = JSON.parse(JSON.stringify(DEFAULT_SLOT_TIMES)).map(s => ({ ...s, label: s.label || '' }))
  err.value = ''
}

function save() {
  for (const r of rows.value) {
    r.from = Number(r.from)
    r.to = Number(r.to)
    if (!r.from || !r.to || r.from < 1 || r.from > r.to) {
      err.value = '小节范围不合法（起 ≤ 止）'
      return
    }
    if (!/^\d{1,2}:\d{2}$/.test(r.start) || !/^\d{1,2}:\d{2}$/.test(r.end)) {
      err.value = '上下课时间没填完整'
      return
    }
    if (r.start >= r.end) {
      err.value = '下课时间要晚于上课时间'
      return
    }
  }
  for (let i = 1; i < rows.value.length; i++) {
    if (rows.value[i].from <= rows.value[i - 1].to) {
      err.value = `第 ${i + 1} 大节的小节范围要接在上一节之后`
      return
    }
  }
  settingsStore.slotTimes = rows.value.map(r => ({
    from: r.from,
    to: r.to,
    start: r.start,
    end: r.end,
    label: (r.label || '').trim()
  }))
  emit('update:show', false)
}
</script>

<template>
  <template v-if="show">
    <div class="dim" @click="emit('update:show', false)"></div>
    <div class="sheet">
      <div class="sheet-title">节次时间设置</div>
      <div class="slot-hint">
        每个大节可设置：对应的小节编号范围（用于识别「2-17[3-5]」这类写法和「第3节」的归属）和上下课时间（用于课表、日历显示）。
      </div>

      <div v-for="(r, i) in rows" :key="i" class="slot-edit">
        <div class="se-head">
          <span class="se-idx">{{ i + 1 }}</span>
          <input v-model="r.label" class="inp se-label" placeholder="名称（可空，默认按小节范围）" maxlength="6" />
        </div>
        <div class="se-grid">
          <div class="se-field">
            <span class="se-cap">小节</span>
            <input v-model.number="r.from" class="inp" type="number" min="1" max="30" />
            <span class="se-dash">~</span>
            <input v-model.number="r.to" class="inp" type="number" min="1" max="30" />
          </div>
          <div class="se-field">
            <span class="se-cap">时间</span>
            <input v-model="r.start" class="inp" type="time" />
            <span class="se-dash">~</span>
            <input v-model="r.end" class="inp" type="time" />
          </div>
        </div>
      </div>

      <div v-if="err" class="slot-err">{{ err }}</div>

      <div class="sheet-actions">
        <button class="btn btn-ghost" @click="restoreDefault">恢复默认</button>
        <button class="btn btn-primary" @click="save">保存</button>
      </div>
    </div>
  </template>
</template>

<style scoped>
.slot-hint {
  font-size: 11px;
  color: var(--sub);
  line-height: 1.6;
  margin-bottom: 4px;
}
.slot-edit {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 10px;
  margin-top: 8px;
}
.se-head { display: flex; align-items: center; gap: 8px; }
.se-idx {
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--ac); color: #fff;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex: none;
}
.se-label { flex: 1; }
.se-grid { display: flex; gap: 10px; margin-top: 6px; }
.se-field { flex: 1; display: flex; align-items: center; gap: 4px; }
.se-cap { font-size: 11px; color: var(--sub); flex: none; }
.se-dash { color: var(--sub); font-size: 11px; }
.se-field .inp { padding: 7px 4px; text-align: center; min-width: 0; }
.slot-err { margin-top: 10px; font-size: 12px; color: #ef4444; }
</style>
