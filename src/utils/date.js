// 日期工具：一律用本地时区，日期字符串统一 'YYYY-MM-DD'
export const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function toStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayStr() {
  return toStr(new Date())
}

export function fromStr(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s, n) {
  const d = fromStr(s)
  d.setDate(d.getDate() + n)
  return toStr(d)
}

// 0=周日
export function weekdaySun0(s) {
  return fromStr(s).getDay()
}

// 1=周一 … 7=周日
export function weekdayMon1(s) {
  const w = weekdaySun0(s)
  return w === 0 ? 7 : w
}

export function fmtCN(s) {
  const d = fromStr(s)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function weekCN(s) {
  return WEEK_CN[weekdaySun0(s)]
}

// 月视图格子：周日起，前面补 null，尾部补齐整周
export function monthGrid(year, month) {
  const startPad = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// 某天所在周的周一到周日
export function weekDatesOf(s) {
  const mon = addDays(s, -(weekdayMon1(s) - 1))
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

export function timeToMinutes(t) {
  if (!t) return 24 * 60
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
