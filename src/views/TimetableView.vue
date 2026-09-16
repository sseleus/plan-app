<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { coursesStore, parseTimetableText, SLOT_TIMES, DAY_NAMES, COURSE_COLORS } from '../stores/courses'
import { parseExcelTimetable } from '../utils/excelTimetable'
import { settingsStore } from '../stores/settings'
import { todayStr, addDays } from '../utils/date'
import CourseSheet from '../components/CourseSheet.vue'
import AdjustSheet from '../components/AdjustSheet.vue'

const router = useRouter()
coursesStore.init()

const today = todayStr()
const currentWeek = Math.max(coursesStore.weekOf(today), 1)
const week = ref(currentWeek)

const sheetShow = ref(false)
const editingCourse = ref(null)
const importShow = ref(false)
const termShow = ref(false)
const adjustShow = ref(false)

const weekTitle = computed(() => {
  const mon = addDays(settingsStore.term.startDate, (week.value - 1) * 7)
  const sun = addDays(mon, 6)
  return `${Number(mon.slice(5, 7))}/${Number(mon.slice(8))} - ${Number(sun.slice(5, 7))}/${Number(sun.slice(8))}`
})
const todayDow = computed(() => {
  if (coursesStore.weekOf(today) !== week.value) return 0
  const d = new Date(today)
  return d.getDay() === 0 ? 7 : d.getDay()
})

const grid = computed(() => coursesStore.weekGrid(week.value))
const courseCount = computed(() => coursesStore.courses.length)

function prevWeek() { if (week.value > 1) week.value-- }
function nextWeek() { if (week.value < 30) week.value++ }

function openCreate() { editingCourse.value = null; sheetShow.value = true }
function openEdit(c) {
  if (c._adjust) {
    alert('这是临时调课/补课出来的课，请在下方「临时调整」列表里管理。')
    return
  }
  editingCourse.value = c
  sheetShow.value = true
}

/* —— 导入（粘贴文本 / Excel 文件） —— */
const importMode = ref('text') // text | excel
const importText = ref('')
const excelRows = ref([])
const excelName = ref('')
const fileEl = ref(null)
const checked = reactive({})

const rows = computed(() =>
  importMode.value === 'text' ? parseTimetableText(importText.value) : excelRows.value
)
const importable = computed(() => rows.value.filter((r, i) => r.ok && checked[i] !== false))

function parsedLabel(r) {
  return `${DAY_NAMES[r.dow - 1]} ${SLOT_TIMES[r.slotStart - 1].short}节 ${r.name}${r.classroom ? ' · ' + r.classroom : ''}`
}

function pickExcel() {
  fileEl.value.click()
}

async function onExcelFile(e) {
  const f = e.target.files[0]
  if (!f) return
  excelName.value = f.name
  try {
    const res = await parseExcelTimetable(f)
    if (res.error) {
      alert(res.error)
    } else {
      excelRows.value = res.rows
      if (!res.rows.length) alert(`表格里没识别出课程（跳过了 ${res.skipped} 个无法识别的格子）`)
    }
  } catch (err) {
    alert('Excel 解析失败：' + (err?.message || err))
  }
  e.target.value = ''
}

function doImport() {
  let n = 0
  for (const r of importable.value) {
    coursesStore.add({
      name: r.name, dow: r.dow, slotStart: r.slotStart, slotEnd: r.slotEnd,
      classroom: r.classroom, teacher: r.teacher || '',
      color: COURSE_COLORS[coursesStore.courses.length % COURSE_COLORS.length],
      weekStart: r.weekStart, weekEnd: r.weekEnd
    })
    n++
  }
  importText.value = ''
  excelRows.value = []
  importShow.value = false
  if (n) alert(`成功导入 ${n} 门课程`)
}

/* —— 学期设置 —— */
const termForm = reactive({ name: '', startDate: '' })
function openTerm() {
  termForm.name = settingsStore.term.name
  termForm.startDate = settingsStore.term.startDate
  termShow.value = true
}
function saveTerm() {
  if (!termForm.startDate) return
  settingsStore.term = { name: termForm.name || '我的学期', startDate: termForm.startDate }
  week.value = Math.max(coursesStore.weekOf(today), 1)
  termShow.value = false
}

/* —— 临时调整列表 —— */
const adjustments = computed(() => coursesStore.adjustments)
function adjLabel(a) {
  const c = coursesStore.courses.find(x => x.id === a.courseId)
  const name = c ? c.name : '（课程已删除）'
  if (a.kind === 'cancel') return `第 ${a.week} 周「${name}」取消一次`
  const slots = SLOT_TIMES[a.slotStart - 1].label
  if (a.kind === 'move') return `第 ${a.week} 周「${name}」调至 ${a.date} ${slots}`
  return `${a.date} 补「${name}」${slots}`
}
function delAdjustment(a) {
  if (confirm('删除这条调整？课程会恢复原样。')) coursesStore.removeAdjustment(a.id)
}
</script>

<template>
  <div class="page">
    <div class="page-hd">
      <button class="icon-btn" @click="router.push('/calendar')">‹</button>
      <div class="page-title" style="font-size: 17px">课程表</div>
      <button class="icon-btn" @click="openCreate">＋</button>
    </div>

    <div class="tt-week">
      <button class="cal-nav" @click="prevWeek">‹</button>
      <span @click="week = currentWeek">第 {{ week }} 周（{{ weekTitle }}）</span>
      <button class="cal-nav" @click="nextWeek">›</button>
    </div>

    <div class="tt-grid">
      <div class="tt-head"></div>
      <div v-for="(d, i) in DAY_NAMES" :key="d" class="tt-head" :class="{ 'today-col': i + 1 === todayDow }">
        {{ d.replace('周', '') }}
      </div>
      <template v-for="(slotRows, si) in grid" :key="si">
        <div class="tt-time">{{ SLOT_TIMES[si].short }}<br />{{ SLOT_TIMES[si].start }}</div>
        <div v-for="(c, di) in slotRows" :key="di">
          <div v-if="c" class="course-block" :style="{ background: c.color }" @click="openEdit(c)">
            <span class="cb-name">{{ (c._adjust === 'makeup' ? '补·' : c._adjust === 'move' ? '调·' : '') + c.name }}</span>
            <span class="cb-room">{{ c.classroom || c.teacher || '&nbsp;' }}</span>
          </div>
        </div>
      </template>
    </div>

    <div class="tt-tip">
      💡 点课程块可编辑；点右上角 ＋ 手动添加；支持粘贴文本或 Excel 文件导入；放假、调休、临时换教室用「调课 / 调休」。
    </div>

    <div class="row2 mt10">
      <button class="btn btn-ghost" @click="openTerm">学期设置</button>
      <button class="btn btn-ghost" @click="adjustShow = true">调课 / 调休</button>
      <button class="btn btn-primary" @click="importShow = true">导入课表</button>
    </div>

    <div v-if="adjustments.length" class="group mt16">
      <div class="row-plain">
        <div class="row-title">临时调整（{{ adjustments.length }}）</div>
      </div>
      <div v-for="a in adjustments" :key="a.id" class="row-plain">
        <div class="row-sub" style="font-size: 12px; color: var(--tx)">{{ adjLabel(a) }}</div>
        <button class="cat-x" @click="delAdjustment(a)">✕</button>
      </div>
    </div>

    <CourseSheet v-model:show="sheetShow" :course="editingCourse" />
    <AdjustSheet v-model:show="adjustShow" />

    <!-- 导入课表弹层 -->
    <template v-if="importShow">
      <div class="dim" @click="importShow = false"></div>
      <div class="sheet">
        <div class="sheet-title">导入课表</div>

        <div class="chip-row" style="margin-bottom: 10px">
          <button class="chip" :class="{ on: importMode === 'text' }" @click="importMode = 'text'">粘贴文本</button>
          <button class="chip" :class="{ on: importMode === 'excel' }" @click="importMode = 'excel'">Excel 文件</button>
        </div>

        <template v-if="importMode === 'text'">
          <div class="imp-tip">
            从其他课表 App 复制课表文本，每行一门课。如：「高等数学 周一 1-2节 A101」「大学英语 星期二 3-4节 B202 1-16周」。识别不了的行会标红。
          </div>
          <textarea
            v-model="importText"
            class="inp"
            rows="6"
            placeholder="每行一门课，例如：&#10;高等数学 周一 1-2节 教一A101&#10;大学英语 星期二 3-4节 B202 1-16周"
          ></textarea>
        </template>

        <template v-else>
          <div class="imp-tip">
            选择课表 Excel 文件（.xlsx / .xls）。自动识别带「周一~周日」表头行和节次列的课表网格，课程格支持“课程名/教室/周次”混排，纵向合并的连堂课会自动合并。识别结果可在下方预览勾选。
          </div>
          <button class="btn btn-ghost" style="width: 100%" @click="pickExcel">
            {{ excelName ? `已选择：${excelName}` : '选择 Excel 文件' }}
          </button>
          <input ref="fileEl" type="file" accept=".xlsx,.xls" style="display: none" @change="onExcelFile" />
        </template>

        <div v-if="rows.length" class="mt10">
          <div v-for="(r, i) in rows" :key="i" class="imp-row">
            <span class="imp-mark" :class="r.ok ? 'ok' : 'bad'"></span>
            <div class="imp-raw">
              <div>{{ r.raw }}</div>
              <div v-if="r.ok" class="imp-parsed">识别为：{{ parsedLabel(r) }}（{{ r.weekStart }}-{{ r.weekEnd }} 周）</div>
              <div v-else class="imp-bad-reason">识别失败：{{ r.reason }}</div>
            </div>
            <label v-if="r.ok"><input type="checkbox" :checked="checked[i] !== false" @change="checked[i] = $event.target.checked" /></label>
          </div>
        </div>

        <div class="sheet-actions">
          <button class="btn btn-ghost" @click="importShow = false">取消</button>
          <button class="btn btn-primary" :disabled="!importable.length" @click="doImport">
            导入 {{ importable.length || '' }} 门课程
          </button>
        </div>
      </div>
    </template>

    <!-- 学期设置弹层 -->
    <template v-if="termShow">
      <div class="dim" @click="termShow = false"></div>
      <div class="sheet">
        <div class="sheet-title">学期设置</div>
        <div class="field-label">学期名称</div>
        <input v-model="termForm.name" class="inp" placeholder="例如：2026 秋季学期" maxlength="20" />
        <div class="field-label">第 1 周周一（开学日期）</div>
        <input v-model="termForm.startDate" class="inp" type="date" />
        <div class="sheet-actions">
          <button class="btn btn-ghost" @click="termShow = false">取消</button>
          <button class="btn btn-primary" :disabled="!termForm.startDate" @click="saveTerm">保存</button>
        </div>
      </div>
    </template>
  </div>
</template>
