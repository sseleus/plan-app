<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { settingsStore, DEFAULT_CATEGORIES, CATEGORY_COLORS } from '../stores/settings'
import { plansStore } from '../stores/plans'
import { coursesStore } from '../stores/courses'
import { exportAll, importAll } from '../stores/storage'
import { requestNotifyPermission, notificationState } from '../utils/reminders'
import { todayStr } from '../utils/date'

const router = useRouter()
plansStore.init()
coursesStore.init()

const THEMES = [
  { v: 'auto', t: '跟随系统' },
  { v: 'light', t: '浅色' },
  { v: 'dark', t: '深色' }
]
const REMIND_OPTIONS = [5, 10, 15, 30]

const notifState = ref(notificationState())

async function toggleReminders() {
  settingsStore.remindersOn = !settingsStore.remindersOn
  if (settingsStore.remindersOn && notifState.value !== 'granted') {
    const r = await requestNotifyPermission()
    notifState.value = r
    if (r !== 'granted') alert('浏览器未授权通知，提醒只在 App 打开时尝试弹出。')
  }
}

/* 分类管理 */
const newCat = reactive({ name: '' })
function addCategory() {
  const name = newCat.name.trim()
  if (!name) return
  settingsStore.addCategory(name, CATEGORY_COLORS[settingsStore.categories.length % CATEGORY_COLORS.length])
  newCat.name = ''
}
function removeCategory(id) {
  const used = plansStore.plans.some(p => p.categoryId === id)
  if (used) {
    alert('该分类下还有计划，先把计划改到其他分类再删除。')
    return
  }
  if (confirm('删除该自定义分类？')) settingsStore.removeCategory(id)
}
function isBuiltin(id) {
  return DEFAULT_CATEGORIES.some(c => c.id === id)
}

/* 数据导出 / 导入 / 清空 */
function exportData() {
  const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `计划表备份-${todayStr()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const fileEl = ref(null)
function pickImport() {
  fileEl.value.click()
}
function onImportFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      if (typeof data !== 'object' || data == null) throw new Error('bad')
      if (!confirm('导入会覆盖当前所有数据，确定继续？')) return
      importAll(data)
      location.reload()
    } catch {
      alert('备份文件格式不对，导入失败。')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

function clearAll() {
  if (!confirm('将清空所有计划、课程与设置，且无法恢复，确定？')) return
  if (!confirm('再次确认：真的要清空全部数据吗？')) return
  localStorage.clear()
  location.reload()
}
</script>

<template>
  <div class="page">
    <div class="page-hd">
      <div>
        <div class="page-title">我的</div>
        <div class="page-sub">设置与数据</div>
      </div>
    </div>

    <!-- 外观 -->
    <div class="group">
      <div class="row-plain">
        <div>
          <div class="row-title">外观</div>
          <div class="row-sub">深色模式可跟随系统自动切换</div>
        </div>
      </div>
      <div class="row-plain">
        <div class="chip-row">
          <button
            v-for="t in THEMES"
            :key="t.v"
            class="chip"
            :class="{ on: settingsStore.theme === t.v }"
            @click="settingsStore.setTheme(t.v)"
          >
            {{ t.t }}
          </button>
        </div>
      </div>
    </div>

    <!-- 提醒 -->
    <div class="group">
      <div class="row-plain">
        <div>
          <div class="row-title">到点提醒</div>
          <div class="row-sub">
            {{
              notifState === 'granted'
                ? '已授权浏览器通知'
                : notifState === 'denied'
                  ? '通知被浏览器拒绝，请到浏览器设置里开启'
                  : 'App 打开期间弹浏览器通知'
            }}
          </div>
        </div>
        <button class="switch" :class="{ on: settingsStore.remindersOn }" @click="toggleReminders"></button>
      </div>
      <div v-if="settingsStore.remindersOn" class="row-plain">
        <div class="row-title">提前提醒</div>
        <select v-model.number="settingsStore.reminderMinutes" class="inp" style="width: 110px">
          <option v-for="m in REMIND_OPTIONS" :key="m" :value="m">提前 {{ m }} 分钟</option>
        </select>
      </div>
    </div>

    <!-- 分类管理 -->
    <div class="group">
      <div class="row-plain">
        <div class="row-title">分类管理</div>
      </div>
      <div v-for="c in settingsStore.categories" :key="c.id" class="cat-item">
        <span class="cat-dot" :style="{ background: c.color }"></span>
        <span class="cat-name">{{ c.name }}</span>
        <button v-if="!isBuiltin(c.id)" class="cat-x" @click="removeCategory(c.id)">✕</button>
      </div>
      <div class="cat-item">
        <input v-model="newCat.name" class="inp" style="flex: 1" placeholder="新分类名称" maxlength="6" @keyup.enter="addCategory" />
        <button class="btn btn-primary" style="flex: none; padding: 9px 16px" @click="addCategory">添加</button>
      </div>
    </div>

    <!-- 课程表 -->
    <div class="group">
      <div class="row-plain" style="cursor: pointer" @click="router.push('/timetable')">
        <div>
          <div class="row-title">课程表</div>
          <div class="row-sub">{{ settingsStore.term.name }} · 共 {{ coursesStore.courses.length }} 门课</div>
        </div>
        <span class="row-chev">›</span>
      </div>
    </div>

    <!-- 数据 -->
    <div class="group">
      <div class="row-plain">
        <div>
          <div class="row-title">数据导出 / 备份</div>
          <div class="row-sub">导出 JSON 备份文件，可导入恢复</div>
        </div>
        <button class="btn btn-primary" style="flex: none; padding: 9px 16px" @click="exportData">导出</button>
      </div>
      <div class="row-plain">
        <div>
          <div class="row-title">从备份导入</div>
          <div class="row-sub">会覆盖当前数据</div>
        </div>
        <button class="btn btn-ghost" style="flex: none; padding: 9px 16px" @click="pickImport">选择文件</button>
        <input ref="fileEl" type="file" accept=".json,application/json" style="display: none" @change="onImportFile" />
      </div>
      <div class="row-plain">
        <div>
          <div class="row-title" style="color: var(--danger)">清空全部数据</div>
        </div>
        <button class="btn btn-danger" style="flex: none; padding: 9px 16px" @click="clearAll">清空</button>
      </div>
    </div>

    <!-- 添加到主屏幕 -->
    <div class="imp-tip">
      📱 添加到手机桌面：手机浏览器打开本页 → 菜单 →「添加到主屏幕」，即可像 App 一样全屏使用；长按图标可快捷打开「今日待办」。
    </div>

    <!-- 关于 -->
    <div class="group">
      <div class="row-plain">
        <div>
          <div class="row-title">关于</div>
          <div class="row-sub">计划表 v1.0.0 · 纯本地存储，无需登录</div>
        </div>
      </div>
    </div>
  </div>
</template>
