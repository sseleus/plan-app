import { smallToBig, slotCount } from '../stores/settings.js'

// 课程格/课程行的通用文本解析：从「课程名 / 老师 / 周次 / 单双周 / 节次 / 教室」混排文本里提取字段。
// 支持：2-17周、第2-17周、2-17[1-2]、1-16周单周、单周/双周、第1-2节、1-2节、[8-9]、2-17
// 老师识别为「短且无数字、无地点特征」的段；教室保留「麦三教3208(麦庐园校区)」整体。
// 返回 { name, teacher, classroom, weekStart, weekEnd, parity, periods }
//   periods = [小节起, 小节止] | null（来自 [a-b] / 第a-b节 / 裸 a-b）

const ROOM_HINT = /[教楼室馆场区院廊厅]|\d/

function teacherLike(s) {
  return s.length >= 2 && s.length <= 5 && !/\d/.test(s) && !ROOM_HINT.test(s) && !/周/.test(s)
}

// 中文数字（一~十九）→ 数值；不是中文数字返回 null
export function cnNum(s) {
  s = String(s).trim()
  const DIG = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  if (/^\d+$/.test(s)) return Number(s)
  if (s === '十') return 10
  if (s.startsWith('十')) return 10 + (DIG[s[1]] || 0)
  if (s.endsWith('十')) return (DIG[s[0]] || 0) * 10
  const m = s.match(/^([一二三四五六七八九])十([一二三四五六七八九])?$/)
  if (m) return DIG[m[1]] * 10 + (m[2] ? DIG[m[2]] : 0)
  return DIG[s] ?? null
}

export function parseCourseCell(text, { splitSpaces = false } = {}) {
  const out = { name: '', teacher: '', classroom: '', weekStart: 1, weekEnd: 30, parity: 'all', periods: null }
  let t = String(text ?? '').trim()
  if (!t) return out

  // 单双周：「单周/双周」或「（单）（双）」。要求带「周」或括号包裹，避免误伤课程名里的“单”（如单片机）
  const pm = t.match(/(单|双)\s*周/) || t.match(/[（(]\s*(单|双)\s*[)）]/)
  if (pm) {
    out.parity = pm[1] === '单' ? 'odd' : 'even'
    t = t.replace(pm[0], ' ')
  }

  // 括号小节范围：[1-2] / （3-5）——括号内必须紧跟纯「数字-数字」才当节次，避免把“(教1-101)”当节次
  const bm = t.match(/[（(\[]\s*(\d{1,2})\s*[-~—]\s*(\d{1,2})\s*[）)\]]/)
  if (bm) {
    out.periods = [Number(bm[1]), Number(bm[2])]
    t = t.replace(bm[0], ' ')
  }

  // 显式节次：第1-2节 / 1-2节 / 第3节 / 3节
  const jm =
    t.match(/第?\s*(\d{1,2})\s*[-~—到]\s*(\d{1,2})\s*节/) ||
    t.match(/第\s*(\d{1,2})\s*节/) ||
    t.match(/^(\d{1,2})\s*节/)
  if (jm && !out.periods) {
    const a = Number(jm[1])
    const b = jm[2] ? Number(jm[2]) : a
    out.periods = [Math.min(a, b), Math.max(a, b)]
    t = t.replace(jm[0], ' ')
  }

  // 周次：2-17周 / 第2-17周
  const wm = t.match(/第?\s*(\d{1,2})\s*[-~—到]\s*(\d{1,2})\s*周/)
  if (wm) {
    out.weekStart = Number(wm[1])
    out.weekEnd = Number(wm[2])
    t = t.replace(wm[0], ' ')
  } else {
    // 裸「a-b」：已识别出节次、或任一数超过常见小节数(12) → 周次；否则当节次（兼容「周一 1-2」老写法）
    // 前后不能贴着数字/地点特征字，避免吞掉教室里的「3-101」
    const rm = t.match(/(?<!\d)(?<![教楼室馆场区院廊厅A-Za-z])(\d{1,2})\s*[-~—到]\s*(\d{1,2})(?!\d)/)
    if (rm) {
      const a = Number(rm[1])
      const b = Number(rm[2])
      if (out.periods || a > 12 || b > 12) {
        out.weekStart = a
        out.weekEnd = b
      } else {
        out.periods = [Math.min(a, b), Math.max(a, b)]
      }
      t = t.replace(rm[0], ' ')
    }
  }

  // 清理残留的空括号
  t = t.replace(/[（(]\s*[)）]/g, ' ').replace(/\[\s*\]/g, ' ')

  // 剩余文本：课程名 / 老师 / 教室
  let segs = t
    .split(/\n|[,;，；|]+/)
    .map(s => s.trim())
    .filter(Boolean)
  if (splitSpaces) {
    // 行模式：整行可能用空格分隔字段
    segs = segs.flatMap(s => s.split(/\s+/)).filter(Boolean)
  }

  // 单段且含空格（如 Excel 里「概率论 概D120」）：最后一个像教室的 token 拆出来
  if (segs.length === 1 && segs[0].includes(' ')) {
    const tokens = segs[0].split(/\s+/)
    const last = tokens[tokens.length - 1]
    if (tokens.length > 1 && last.length <= 12 && ROOM_HINT.test(last)) {
      out.classroom = last
      segs = [tokens.slice(0, -1).join(' ')]
    }
  }

  if (!segs.length) return out
  out.name = segs[0].replace(/\s+/g, '')
  // 名字自带括号教室：「数据结构(C305)」→ 名字 + 教室
  const nm = out.name.match(/^(.+)[（(]([^（）()]{1,20})[)）]$/)
  if (nm && /\d|教|楼|室|馆|场/.test(nm[2])) {
    out.name = nm[1]
    out.classroom = out.classroom || nm[2]
  }
  for (const seg of segs.slice(1)) {
    const bare = seg.replace(/^[（(]+/, '').replace(/[)）]+$/, '')
    if (!out.teacher && teacherLike(bare)) {
      out.teacher = bare
      continue
    }
    if (!out.classroom && ROOM_HINT.test(seg)) out.classroom = seg
  }
  return out
}

// 小节范围 → 大节序号范围（按配置的节次归属换算并夹紧）
export function periodsToSlots(periods) {
  const count = slotCount()
  const a = smallToBig(Math.min(...periods))
  const b = smallToBig(Math.max(...periods))
  return [Math.min(Math.max(a, 1), count), Math.min(Math.max(b, 1), count)]
}
