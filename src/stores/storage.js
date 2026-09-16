// 本地存储统一入口：所有读写走这里，将来接云同步只需替换此模块实现
const PREFIX = 'planapp:'

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.error('本地保存失败', e)
  }
}

export function exportAll() {
  const data = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) {
      try {
        data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k))
      } catch {
        /* 跳过损坏项 */
      }
    }
  }
  return data
}

export function importAll(data) {
  for (const [k, v] of Object.entries(data)) save(k, v)
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
