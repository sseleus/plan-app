// 解析器自检：node scripts/parse-check.mjs
// 在 node 里用最小浏览器全局桩直接运行真实解析代码（不启动浏览器），对
// 仓库样例课表.xlsx、图示格式合成网格、若干文本行做断言。
const noop = () => {}
const fakeEl = () => ({
  setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
  addEventListener: noop, removeEventListener: noop,
  appendChild: noop, removeChild: noop, insertBefore: noop,
  style: {}, dataset: {}, classList: { add: noop, remove: noop },
  textContent: '', innerHTML: ''
})
globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop })
}
globalThis.document = {
  documentElement: fakeEl(),
  createElement: fakeEl,
  createElementNS: fakeEl,
  createTextNode: fakeEl,
  querySelector: () => null,
  querySelectorAll: () => [],
  head: fakeEl(),
  body: fakeEl()
}
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop, clear: noop, key: () => null, length: 0 }

import fs from 'node:fs'
const { parseTimetableText, recognizeGrid, parseExcelTimetable } = await import('../src/utils/excelTimetable.js')
const { settingsStore, smallToBig, slotCount } = await import('../src/stores/settings.js')

let failed = 0
function check(name, cond, extra = '') {
  if (cond) console.log('  ok   ' + name)
  else {
    failed++
    console.log('  FAIL ' + name + (extra ? '  ← ' + extra : ''))
  }
}
function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

// 大节结构按图示学校配置：大节一=1-2小节、二=3-5、三=6-7、四=8-9、五=10-12
function useSchoolConfig() {
  settingsStore.init() // 先完成初始化，避免默认值覆盖下面的自定义配置
  settingsStore.slotTimes = [
    { from: 1, to: 2, start: '08:00', end: '10:35', label: '' },
    { from: 3, to: 5, start: '10:45', end: '12:30', label: '' },
    { from: 6, to: 7, start: '14:00', end: '15:40', label: '' },
    { from: 8, to: 9, start: '16:00', end: '17:40', label: '' },
    { from: 10, to: 12, start: '19:00', end: '21:30', label: '晚' }
  ]
}

console.log('== 1. 文本行解析（按图示学校的大节结构）==')
useSchoolConfig()
check('slotCount = 5', slotCount() === 5)
check('smallToBig(3)=2 / (5)=2 / (6)=3 / (8)=4 / (9)=4 / (10)=5 / (12)=5',
  [3, 5, 6, 8, 9, 10, 12].map(smallToBig).join() === '2,2,3,4,4,5,5')

{
  const r = parseTimetableText('Java程序设计 周一 2-17[1-2] 数字经济实训大楼S403(麦庐园校区)')[0]
  check('周次+括号节次行：ok', r.ok, r.reason)
  check('  星期一 / 大节1', r.dow === 1 && r.slotStart === 1 && r.slotEnd === 1, eq([r.dow, r.slotStart, r.slotEnd], ''))
  check('  周次 2-17', r.weekStart === 2 && r.weekEnd === 17)
  check('  教室整体保留', r.classroom === '数字经济实训大楼S403(麦庐园校区)', r.classroom)
  check('  课程名', r.name === 'Java程序设计', r.name)
}
{
  const r = parseTimetableText('大学英语 星期二 3-4节 B202 1-16周')[0]
  check('显式节次+周次行：大节2 / 1-16周 / 教室B202', r.ok && r.dow === 2 && r.slotStart === 2 && r.slotEnd === 2 && r.weekStart === 1 && r.weekEnd === 16 && r.classroom === 'B202', JSON.stringify(r))
}
{
  const r = parseTimetableText('数据结构 周三 1-16周单周 1-2节 教一A101')[0]
  check('单周关键词：parity=odd', r.ok && r.parity === 'odd' && r.slotStart === 1 && r.weekStart === 1 && r.weekEnd === 16, JSON.stringify(r))
}
{
  const r = parseTimetableText('毛概 周四 1-16周双周 3-4节 A202')[0]
  check('双周关键词：parity=even', r.ok && r.parity === 'even' && r.slotStart === 2, JSON.stringify(r))
}
{
  const r = parseTimetableText('体育3 周四 2-17周')[0]
  check('只有周次没有节次 → 标红且原因正确', !r.ok && /节次/.test(r.reason), r.reason)
}
{
  const r = parseTimetableText('高等数学 周一 1-2')[0]
  check('裸 1-2 仍按节次（兼容老写法）', r.ok && r.slotStart === 1 && r.slotEnd === 1 && r.weekStart === 1 && r.weekEnd === 30, JSON.stringify(r))
}
{
  const r = parseTimetableText('开会 周五 08:30')[0]
  check('时间就近匹配大节1', r.ok && r.slotStart === 1 && r.slotEnd === 1, JSON.stringify(r))
}
{
  const r = parseTimetableText('形势与政策III 周三 9-12[8-9] 麦三教3305(麦庐园校区)')[0]
  check('[8-9] → 大节4（不溢出到晚上）', r.ok && r.slotStart === 4 && r.slotEnd === 4 && r.weekStart === 9 && r.weekEnd === 12, JSON.stringify(r))
}
{
  const r = parseTimetableText('C++程序设计语言 周三 2-17[10-12] 数字经济实训大楼S307(麦庐园校区)')[0]
  check('[10-12] → 晚上大节5', r.ok && r.slotStart === 5 && r.slotEnd === 5, JSON.stringify(r))
}
{
  const r = parseTimetableText('Java程序设计\n王颖\n2-17[1-2]\n数字经济实训大楼S403(麦庐园校区)\n周一')[0]
  check('多行块（星期在末行）：老师=王颖 / 大节1 / 2-17周', r.ok && r.dow === 1 && r.teacher === '王颖' && r.name === 'Java程序设计' && r.classroom === '数字经济实训大楼S403(麦庐园校区)' && r.weekStart === 2 && r.weekEnd === 17 && r.slotStart === 1, JSON.stringify(r))
}
{
  const r = parseTimetableText('数据库系统原理（软件） 周一 2-17[3-5] 麦三教3107(麦庐园校区)')[0]
  check('[3-5] → 大节2（跨3小节的大节）', r.ok && r.slotStart === 2 && r.slotEnd === 2, JSON.stringify(r))
}
{
  const rows = parseTimetableText('Java程序设计 周一 2-17 数字经济实训大楼S403')
  check('裸 2-17 按周次、不占满 1-5 节', rows[0].weekStart === 2 && rows[0].weekEnd === 17 && !(rows[0].ok && rows[0].slotEnd === 5 && rows[0].slotStart === 1), JSON.stringify(rows[0]))
}

console.log('== 2. 合成网格（图示课表格式的表格粘贴）==')
useSchoolConfig()
const C = (...lines) => lines.join('\n')
const grid = [
  ['', '', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
  ['上午', '一',
    C('Java程序设计', '王颖', '2-17[1-2]', '数字经济实训大楼S403(麦庐园校区)'),
    C('英语视听说', '甘仙女', '2-17[1-2]', '麦三教3208(麦庐园校区)'),
    C('Java程序设计', '王颖', '2-17[1-2]', '数字经济实训大楼S403(麦庐园校区)'),
    C('创业概论', '万敏琳', '2-9[1-2]', '麦三教3113(麦庐园校区)'), '', '', ''],
  ['上午', '二', C('数据库系统原理（软件）', '熊碧舟', '2-17[3-5]', '麦三教3107(麦庐园校区)'), '', '', C('概率论', '刘艺媛', '2-17[3-5]', '麦三教3207(麦庐园校区)'), '', '', ''],
  ['下午', '三', C('数据库开发实践', '熊碧舟 双', '2-17[6-7]', '麦工商楼G206(麦庐园校区)'), C('Python程序设计基础', '洪侃', '2-17[6-8]', '数字经济实训大楼S404(麦庐园校区)'), '', C('软件工程', '胡淇昌', '2-17[6-7]', '数字经济实训大楼S402(麦庐园校区)'), '', '', ''],
  ['下午', '四', C('体育3', '钟文韬', '2-17[8-9]', '麦羽毛球场T046(麦庐园校区)'), '', C('形势与政策III', '黄颖', '9-12[8-9]', '麦三教3305(麦庐园校区)'), C('会计学', '辜伟', '2-17[8-9]', '麦三教3201(麦庐园校区)'), '', '', ''],
  ['晚上', '五', '', '', C('C++程序设计语言', '涂丽琴', '2-17[10-12]', '数字经济实训大楼S307(麦庐园校区)'), '', '', '', '']
]
{
  const res = recognizeGrid(grid)
  check('识别成功且 13 门课', !res.error && res.rows.length === 13, res.error || '实际 ' + (res.rows || []).length)
  const by = (dow, name) => res.rows.find(r => r.dow === dow && r.name.includes(name))
  const java = by(1, 'Java')
  check('周一 Java：大节1 / 2-17周 / 老师王颖 / 教室整体', java && eq([java.slotStart, java.slotEnd, java.weekStart, java.weekEnd], [1, 1, 2, 17]) && java.teacher === '王颖' && java.classroom === '数字经济实训大楼S403(麦庐园校区)', JSON.stringify(java))
  const db = by(1, '数据库系统原理')
  check('周一 数据库：大节2', db && db.slotStart === 2 && db.slotEnd === 2, JSON.stringify(db))
  const py = by(2, 'Python')
  check('周二 Python [6-8]：跨大节三~四（3-4）', py && py.slotStart === 3 && py.slotEnd === 4, JSON.stringify(py))
  const sx = by(3, '形势')
  check('周三 形势与政策 [8-9]：大节4 / 9-12周', sx && sx.slotStart === 4 && sx.slotEnd === 4 && sx.weekStart === 9 && sx.weekEnd === 12, JSON.stringify(sx))
  const cpp = by(3, 'C++')
  check('周三 C++：晚上大节5', cpp && cpp.slotStart === 5 && cpp.slotEnd === 5, JSON.stringify(cpp))
  const zc = by(4, '创业')
  check('周四 创业概论：2-9周', zc && zc.weekStart === 2 && zc.weekEnd === 9, JSON.stringify(zc))
  check('老师/教室归类正确（周一4门）', by(1, '数据库开发')?.classroom === '麦工商楼G206(麦庐园校区)' && by(1, '体育')?.teacher === '钟文韬')
}

console.log('== 3. 文本表格粘贴模式（Tab 分列）==')
{
  const tsv = [
    ['课程名称', '星期一', '星期二', '星期三', '星期四'].join('\t'),
    ['1-2节', C('Java程序设计', '王颖', '2-17[1-2]', 'S403'), '', C('英语视听说', '甘仙女', '2-17[1-2]', 'S3208'), ''].join('\t'),
    ['3-4节', '', C('概率论', '刘艺媛', '2-17[3-5]', 'S3207'), '', ''].join('\t')
  ].join('\n')
  const rows = parseTimetableText(tsv)
  check('表格模式识别出 3 门', rows.length === 3 && rows.every(r => r.ok), JSON.stringify(rows.map(r => [r.raw, r.ok, r.reason])))
  const j = rows.find(r => r.name.includes('Java'))
  check('表格模式：Java 大节1 / 2-17周', j && j.dow === 1 && j.slotStart === 1 && j.weekStart === 2 && j.weekEnd === 17, JSON.stringify(j))
  const g = rows.find(r => r.name.includes('概率论'))
  check('表格模式：概率论 大节2（表头 3-4节 → 小节3起）', g && g.dow === 2 && g.slotStart === 2 && g.slotEnd === 2, JSON.stringify(g))
}

console.log('== 4. 仓库样例课表.xlsx ==')
{
  const file = { arrayBuffer: async () => fs.readFileSync(new URL('../样例课表.xlsx', import.meta.url)) }
  const res = await parseExcelTimetable(file)
  if (res.error) {
    check('样例 xlsx 解析', false, res.error)
  } else {
    check('样例 xlsx 识别出课程 ≥ 6 门', res.rows.length >= 6, '实际 ' + res.rows.length + '，skipped ' + res.skipped)
    for (const r of res.rows) {
      console.log(`    · 周${r.dow} 大节${r.slotStart}${r.slotEnd !== r.slotStart ? '-' + r.slotEnd : ''} ${r.name} | ${r.teacher || '无老师'} | ${r.classroom || '无教室'} | ${r.weekStart}-${r.weekEnd}周${r.parity !== 'all' ? (r.parity === 'odd' ? ' 单周' : ' 双周') : ''}`)
    }
    const bad = res.rows.filter(r => !r.name || r.slotStart < 1 || r.slotEnd > slotCount() || r.slotEnd < r.slotStart)
    check('全部行节次范围合法', bad.length === 0, JSON.stringify(bad))
  }
}

console.log(failed ? `\n${failed} 项断言失败` : '\n全部断言通过')
process.exit(failed ? 1 : 0)
