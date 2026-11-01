import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Commit, FileChange, GitSnapshot, Mode } from '../types'
import { DEFAULT_THEME, THEMES, hex, lerp, themeOf } from './themes'
import type { Theme } from './themes'

// The terminal's own color: cells keep your background, no gray fill.
const DEFAULT = 0x01000000
const SPARK = '▁▂▃▄▅▆▇█'
const SPIN = '◐◓◑◒'

const WINDOW_MS = 90_000
const CARD_MAX_W = 68

const EMPTY: GitSnapshot = {
  isRepo: false,
  branch: '',
  upstream: '',
  ahead: 0,
  behind: 0,
  files: [],
  commits: [],
}

const activity = atom({ plugin: 'ccradar', key: 'activity' } as const, [] as Activity[], {
  shape: 'activity-2',
})
const snapshot = atom({ plugin: 'ccradar', key: 'snapshot' } as const, EMPTY, {
  shape: 'snapshot-1',
})
const mode = atom({ plugin: 'ccradar', key: 'mode' } as const, 'overlay' as Mode)
const themeName = atom({ plugin: 'ccradar', key: 'theme' } as const, DEFAULT_THEME)
const now = atom({ plugin: 'ccradar', key: 'now' } as const, 0)

const MUTATING = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash', 'PowerShell'])

// ─── a tiny cell canvas, painted into one Raster ──────────────────────────
function isNarrowGlyph(cp: number) {
  if (cp < 0x20 || cp > 0xffff) return false
  if (cp >= 0x0300 && cp <= 0x036f) return false
  if (cp >= 0x1100 && cp <= 0x115f) return false
  if (cp >= 0x2e80 && cp <= 0xa4cf) return false
  if (cp >= 0xac00 && cp <= 0xd7a3) return false
  if (cp >= 0xd800 && cp <= 0xdfff) return false
  if (cp >= 0xf900 && cp <= 0xfaff) return false
  if (cp >= 0xfe30 && cp <= 0xfe4f) return false
  if (cp >= 0xff00 && cp <= 0xff60) return false
  return true
}

class Canvas {
  readonly cells: Uint32Array
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = new Uint32Array(w * h * 3)
    for (let i = 0; i < w * h; i++) {
      this.cells[i * 3] = 0x20
      this.cells[i * 3 + 1] = DEFAULT
      this.cells[i * 3 + 2] = DEFAULT
    }
  }
  put(x: number, y: number, ch: string, fg = DEFAULT) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const raw = ch.codePointAt(0) ?? 0x20
    const i = (y * this.w + x) * 3
    this.cells[i] = isNarrowGlyph(raw) ? raw : 0x3f
    this.cells[i + 1] = fg
  }
  text(x: number, y: number, s: string, fg = DEFAULT, max = Infinity) {
    let n = 0
    for (const ch of s) {
      if (n >= max) break
      this.put(x + n, y, ch, fg)
      n++
    }
    return x + n
  }
  /** Text whose color runs along a gradient. */
  grad(x: number, y: number, s: string, from: number, to: number) {
    const chars = [...s]
    chars.forEach((ch, i) => this.put(x + i, y, ch, lerp(from, to, chars.length > 1 ? i / (chars.length - 1) : 0)))
    return x + chars.length
  }
  base64() {
    const bytes = new Uint8Array(this.cells.buffer)
    const withB64 = bytes as unknown as { toBase64?: () => string }
    if (typeof withB64.toBase64 === 'function') return withB64.toBase64()
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    return btoa(bin)
  }
}

const len = (s: string) => [...s].length
function fit(s: string, w: number) {
  const one = s.replace(/\s+/g, ' ').trim()
  if (w <= 0) return ''
  return len(one) <= w ? one : [...one].slice(0, w - 1).join('') + '…'
}
function fitPath(p: string, w: number) {
  if (len(p) <= w) return p
  return w <= 1 ? '' : '…' + [...p].slice(len(p) - w + 1).join('')
}
function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}h`
}

/** Tool calls per slice of the window. */
function buckets(list: Activity[], t: number, n: number) {
  const counts = new Array<number>(n).fill(0)
  const size = WINDOW_MS / n
  for (const a of list) {
    const i = Math.floor((a.start - (t - WINDOW_MS)) / size)
    if (i >= 0 && i < n) counts[i]! += 1
  }
  return counts
}

// ─── the card ─────────────────────────────────────────────────────────────
function paintCard(W: number, snap: GitSnapshot, list: Activity[], t: number, th: Theme) {
  const inner = W - 4
  const lanes: string[] = ['main']
  for (const a of list) if (!lanes.includes(a.who)) lanes.push(a.who)
  const isRecent = (a: Activity) => !a.isDone || t - a.end < WINDOW_MS
  const shownLanes = lanes.filter(w => w === 'main' || list.some(a => a.who === w && isRecent(a))).slice(0, 6)
  const laneColor = (who: string) => th.lanes[Math.max(0, lanes.indexOf(who)) % th.lanes.length]!

  const files = snap.files.slice(0, 6)
  const commits = snap.commits.slice(0, 3)
  const rows =
    2 + // frame
    1 + shownLanes.length + // agents
    1 + 3 + // gap + activity (label row + 2-row sparkline)
    (snap.isRepo ? 2 + Math.max(1, files.length) : 0) +
    (snap.isRepo && commits.length > 0 ? 2 + commits.length : 0)
  const c = new Canvas(W, rows)

  // Frame: rounded, its color running across the theme's gradient.
  const [f0, f1] = th.frame
  for (let x = 0; x < W; x++) {
    const col = lerp(f0, f1, x / (W - 1))
    c.put(x, 0, x === 0 ? '╭' : x === W - 1 ? '╮' : '─', col)
    c.put(x, rows - 1, x === 0 ? '╰' : x === W - 1 ? '╯' : '─', col)
  }
  for (let y = 1; y < rows - 1; y++) {
    c.put(0, y, '│', f0)
    c.put(W - 1, y, '│', f1)
  }
  let x = c.text(2, 0, ' ✻ ', th.accent)
  x = c.grad(x, 0, 'ccradar', f0, f1)
  c.text(x, 0, ' ', DEFAULT)
  if (snap.isRepo) {
    const branch = fit(snap.branch, 22)
    const tail = ` ⎇ ${branch}${snap.ahead ? ` ↑${snap.ahead}` : ''}${snap.behind ? ` ↓${snap.behind}` : ''} `
    const tx = W - 2 - len(tail)
    if (tx > x + 2) {
      let p = c.text(tx, 0, ' ⎇ ', th.accent)
      p = c.text(p, 0, branch, DEFAULT)
      if (snap.ahead) p = c.text(p, 0, ` ↑${snap.ahead}`, th.add[1])
      if (snap.behind) p = c.text(p, 0, ` ↓${snap.behind}`, th.warn)
      c.text(p, 0, ' ', DEFAULT)
    }
  }

  const label = (y: number, icon: string, name: string, iconColor: number) => {
    c.put(2, y, icon, iconColor)
    return c.text(4, y, name, th.dim)
  }

  let y = 1
  // ── Agents: one lane per agent over the last 90 seconds, fading with age ──
  const nameW = Math.min(12, Math.max(6, ...shownLanes.map(len)))
  const nowW = Math.min(22, Math.max(10, Math.floor(inner * 0.32)))
  const graphW = Math.max(8, inner - 2 - nameW - 1 - nowW - 1)
  label(y, '◆', 'AGENTS', th.accent)
  c.grad(2 + inner - 10, y, `${WINDOW_MS / 1000}s ⟶ now`, th.ghost, th.faint)
  y++
  const start = t - WINDOW_MS
  const size = WINDOW_MS / graphW
  shownLanes.forEach((who, li) => {
    const col = laneColor(who)
    const isMain = who === 'main'
    c.put(2, y, isMain ? '●' : li === shownLanes.length - 1 ? '╰' : '├', isMain ? col : th.ghost)
    c.text(4, y, fit(who, nameW), col)
    const gx = 4 + nameW + 1
    const mine = list.filter(a => a.who === who)
    const first = mine.length ? Math.min(...mine.map(a => a.start)) : t
    for (let i = 0; i < graphW; i++) {
      const b0 = start + i * size
      const b1 = b0 + size
      const age = i / Math.max(1, graphW - 1) // 0 = oldest, 1 = now
      const lit = lerp(th.ghost, col, 0.3 + 0.7 * age)
      const busy = mine.filter(a => a.start < b1 && (a.isDone ? a.end : t) >= b0)
      const began = busy.some(a => a.start >= b0 && a.start < b1)
      const failed = busy.some(a => a.isError && a.end >= b0 && a.end < b1)
      if (failed) c.put(gx + i, y, '✕', th.del[1])
      else if (began) c.put(gx + i, y, '●', lerp(col, 0xffffff, 0.15 * age))
      else if (busy.length) c.put(gx + i, y, '━', lit)
      else if (b1 > first) c.put(gx + i, y, '─', th.ghost)
      else c.put(gx + i, y, '·', th.ghost)
    }
    const nx = gx + graphW + 1
    const live = mine.filter(a => !a.isDone)
    if (live.length) {
      const a = live[live.length - 1]!
      let p = c.text(nx, y, SPIN[Math.floor(t / 250) % 4]! + ' ', th.warn)
      p = c.text(p, y, a.tool, col, nowW - 2)
      c.text(p + 1, y, fit(a.target, nowW - 3 - len(a.tool)), th.faint)
    } else if (mine.length) {
      const a = mine[mine.length - 1]!
      const p = c.text(nx, y, a.isError ? '✕ ' : '✓ ', a.isError ? th.del[1] : th.add[1])
      c.text(p, y, fit(`${a.tool} ${ago(t - a.end)}`, nowW - 2), th.faint)
    } else {
      c.text(nx, y, 'idle', th.ghost)
    }
    y++
  })

  // ── Activity: a 2-row sparkline (16 levels), colored hot by level ──
  y++
  const total = list.filter(a => a.start >= start).length
  let p = label(y, '◆', 'ACTIVITY', th.spark[5]!)
  c.text(p + 2, y, `${total} calls · ${WINDOW_MS / 1000}s`, th.faint)
  y++
  const sparkW = inner - 2
  const counts = buckets(list, t, sparkW)
  const peak = Math.max(1, ...counts)
  counts.forEach((n, i) => {
    const v = n === 0 ? 0 : Math.max(1, Math.round((n / peak) * 16))
    const color = th.spark[Math.min(7, Math.floor((v - 1) / 2))] ?? th.ghost
    if (v === 0) {
      c.put(4 + i, y + 1, '▁', th.ghost)
      return
    }
    c.put(4 + i, y + 1, v >= 8 ? '█' : SPARK[v - 1]!, color)
    if (v > 8) c.put(4 + i, y, SPARK[v - 9]!, color)
  })
  y += 2

  // ── Changes: gradient bars, added then removed ──
  if (snap.isRepo) {
    y++
    const add = snap.files.reduce((s, f) => s + f.added, 0)
    const del = snap.files.reduce((s, f) => s + f.removed, 0)
    p = label(y, '◆', 'CHANGES', th.add[1])
    p = c.text(p + 2, y, `${snap.files.length} files`, th.faint)
    p = c.text(p + 2, y, `+${add}`, th.add[1])
    c.text(p + 1, y, `−${del}`, th.del[1])
    y++
    if (files.length === 0) {
      c.text(4, y, '✓ working tree clean', th.faint)
      y++
    }
    const maxChurn = Math.max(1, ...files.map(f => f.added + f.removed))
    const barW = Math.max(6, Math.min(20, Math.floor(inner * 0.32)))
    const numW = 11
    const pathW = Math.max(6, inner - 2 - 1 - barW - 1 - numW)
    for (const f of files) {
      const isNew = f.code === '??'
      const letter = isNew ? '+' : (f.code.trim()[0] ?? ' ')
      const lc = isNew ? th.info : letter === 'A' ? th.add[1] : letter === 'D' ? th.del[1] : th.warn
      c.put(2, y, letter, lc)
      c.text(4, y, fitPath(f.path, pathW), DEFAULT)
      const bx = 4 + pathW + 1
      const churn = f.added + f.removed
      const exact = isNew ? barW * 0.2 : (churn / maxChurn) * barW
      const addPart = churn ? (f.added / churn) * exact : 0
      for (let i = 0; i < barW; i++) {
        const fill = Math.max(0, Math.min(1, exact - i))
        if (fill <= 0) {
          c.put(bx + i, y, '─', th.ghost)
          continue
        }
        const ch = fill >= 1 ? '█' : ('▏▎▍▌▋▊▉'[Math.max(0, Math.round(fill * 8) - 1)] ?? '▏')
        const k = i / Math.max(1, barW - 1)
        const color = isNew
          ? lerp(th.info, th.accent, k)
          : i < addPart
            ? lerp(th.add[0], th.add[1], k)
            : lerp(th.del[0], th.del[1], k)
        c.put(bx + i, y, ch, color)
      }
      if (isNew) c.text(bx + barW + 1, y, 'new', th.info)
      else {
        const q = c.text(bx + barW + 1, y, `+${f.added}`, th.add[1])
        c.text(q + 1, y, `−${f.removed}`, th.del[1])
      }
      y++
    }
    if (snap.files.length > files.length) {
      c.text(W - 2 - 12, y - 1, ` +${snap.files.length - files.length} more `, th.faint)
    }
  }

  // ── Commits ──
  if (snap.isRepo && commits.length > 0) {
    y++
    label(y, '◆', 'COMMITS', th.info)
    y++
    commits.forEach((cm, i) => {
      c.put(2, y, i === 0 ? '◉' : '○', i === 0 ? th.accent : th.lanes[(i + 1) % th.lanes.length])
      const q = c.text(4, y, cm.hash, th.info)
      const whenW = len(cm.when)
      c.text(q + 1, y, fit(cm.subject, inner - 2 - len(cm.hash) - 2 - whenW), i === 0 ? DEFAULT : th.faint)
      c.text(W - 2 - whenW, y, cm.when, th.faint)
      y++
    })
  }

  return { cells: c.base64(), columns: W, rows }
}

// ─── git ─────────────────────────────────────────────────────────────────
async function git($: EngineInterface, args: string[]) {
  try {
    return await $.process.run(['git', ...args], { timeoutMs: 8000 })
  } catch {
    return { exitCode: 1, stdout: '', stderr: '' }
  }
}

function parseNumstat(text: string, into: Map<string, { added: number; removed: number }>) {
  for (const line of text.split('\n')) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
    if (!m) continue
    let path = m[3]!
    const brace = path.match(/^(.*)\{(.*) => (.*)\}(.*)$/)
    if (brace) path = `${brace[1]}${brace[3]}${brace[4]}`
    else if (path.includes(' => ')) path = path.split(' => ')[1]!
    const cur = into.get(path) ?? { added: 0, removed: 0 }
    cur.added += m[1] === '-' ? 0 : Number(m[1])
    cur.removed += m[2] === '-' ? 0 : Number(m[2])
    into.set(path, cur)
  }
}

function shortWhen(when: string) {
  return when
    .replace(/ ago$/, '')
    .replace(/ seconds?/, 's')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ weeks?/, 'w')
    .replace(/ months?/, 'mo')
    .replace(/ years?/, 'y')
}

async function readGit($: EngineInterface): Promise<GitSnapshot> {
  const status = await git($, ['status', '--porcelain=v1', '-b'])
  if (status.exitCode !== 0) return EMPTY
  const lines = status.stdout.split('\n').filter(l => l.length > 0)
  const head = lines[0]?.startsWith('## ') ? lines.shift()!.slice(3) : ''
  let branch = head
  let upstream = ''
  let ahead = 0
  let behind = 0
  const noCommits = head.match(/^No commits yet on (.+)$/)
  if (noCommits) branch = noCommits[1]!
  else {
    const m = head.match(/^(.+?)(?:\.\.\.(\S+))?(?: \[(.+)\])?$/)
    if (m) {
      branch = m[1]!
      upstream = m[2] ?? ''
      ahead = Number(m[3]?.match(/ahead (\d+)/)?.[1] ?? 0)
      behind = Number(m[3]?.match(/behind (\d+)/)?.[1] ?? 0)
    }
  }
  const counts = new Map<string, { added: number; removed: number }>()
  parseNumstat((await git($, ['diff', '--numstat'])).stdout, counts)
  parseNumstat((await git($, ['diff', '--numstat', '--cached'])).stdout, counts)
  const files: FileChange[] = lines.map(line => {
    const code = line.slice(0, 2)
    let path = line.slice(3)
    if (path.includes(' -> ')) path = path.split(' -> ')[1]!
    path = path.replace(/^"(.*)"$/, '$1')
    const c = counts.get(path) ?? { added: 0, removed: 0 }
    return { path, code, added: c.added, removed: c.removed }
  })
  files.sort((a, b) => b.added + b.removed - (a.added + a.removed))
  const log = await git($, ['log', '-3', '--pretty=format:%h%x09%s%x09%cr'])
  const commits: Commit[] =
    log.exitCode !== 0
      ? []
      : log.stdout
          .split('\n')
          .filter(l => l.length > 0)
          .map(l => {
            const [hash = '', subject = '', when = ''] = l.split('\t')
            return { hash, subject, when: shortWhen(when) }
          })
  return { isRepo: true, branch, upstream, ahead, behind, files, commits }
}

let lastJson = ''
let isRefreshing = false
let isRefreshQueued = false
const agentNames = new Map<string, string>()

async function refresh($: EngineInterface) {
  if (isRefreshing) {
    isRefreshQueued = true
    return
  }
  isRefreshing = true
  try {
    do {
      isRefreshQueued = false
      const fresh = await readGit($)
      const json = JSON.stringify(fresh)
      if (json !== lastJson) {
        lastJson = json
        await update($, snapshot, () => fresh)
      }
    } while (isRefreshQueued)
  } catch {
  } finally {
    isRefreshing = false
  }
}

async function whoIs($: EngineInterface, agentId: string | undefined) {
  if (!agentId) return 'main'
  const known = agentNames.get(agentId)
  if (known) return known
  try {
    for (const a of await $.agent.list()) {
      agentNames.set(a.id, a.name || a.description || a.type || a.id.slice(0, 6))
    }
  } catch {}
  return agentNames.get(agentId) ?? `agent-${agentId.slice(0, 4)}`
}

function targetOf(e: Record<string, unknown>) {
  const pick = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  const t =
    pick('file_path') ||
    pick('notebook_path') ||
    pick('command') ||
    pick('description') ||
    pick('pattern') ||
    pick('url') ||
    pick('query')
  if (/[\\/]/.test(t) && !/\s/.test(t)) return t.split(/[\\/]/).slice(-1)[0] ?? t
  return t
}

const THEME_NAMES = Object.keys(THEMES)

// ─── wiring ──────────────────────────────────────────────────────────────
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ccradar',
      description: 'ccradar view: /ccradar [overlay|strip|off] or /ccradar theme <name>',
      argumentHint: `overlay | strip | off | theme ${THEME_NAMES.join('|')}`,
    })
    const keptMode = (await $.store.get('mode').catch(() => undefined)) as Mode | undefined
    if (keptMode === 'overlay' || keptMode === 'strip' || keptMode === 'off') await update($, mode, () => keptMode)
    const keptTheme = (await $.store.get('theme').catch(() => undefined)) as string | undefined
    if (keptTheme && THEMES[keptTheme]) await update($, themeName, () => keptTheme)
    void refresh($)
    $.clock.every(4000, () => refresh($))
    // Move the graphs along while anything happened lately.
    $.clock.every(1000, async () => {
      const t = Date.now()
      const list = await read($, activity)
      const lively = list.some(a => !a.isDone || t - a.end < WINDOW_MS)
      const last = await read($, now)
      if (lively || t - last > 15_000) await update($, now, () => t)
    })
    return next(e)
  })

  on('command.run', { command: 'ccradar' }, async ($, e) => {
    const [first = '', second = ''] = e.args.trim().toLowerCase().split(/\s+/)
    if (first === 'theme' || first === 'themes') {
      const current = await read($, themeName)
      const picked = second.replace(/[^a-z]/g, '')
      const chosen = THEMES[picked]
        ? picked
        : THEME_NAMES[(THEME_NAMES.indexOf(current) + 1) % THEME_NAMES.length]!
      if (second && !THEMES[picked]) {
        return { text: `Unknown theme "${second}". Themes: ${THEME_NAMES.join(', ')}` }
      }
      await update($, themeName, () => chosen)
      await $.store.set('theme', chosen).catch(() => undefined)
      return { text: `ccradar theme: ${chosen}  (themes: ${THEME_NAMES.join(', ')})` }
    }
    const current = await read($, mode)
    const nextMode: Mode =
      first === 'overlay' || first === 'strip' || first === 'off'
        ? first
        : current === 'overlay'
          ? 'strip'
          : current === 'strip'
            ? 'off'
            : 'overlay'
    await update($, mode, () => nextMode)
    await $.store.set('mode', nextMode).catch(() => undefined)
    void refresh($)
    return { text: `ccradar: ${nextMode}` }
  })

  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id ?? `${Date.now()}-${Math.random()}`
    try {
      const t = Date.now()
      const item: Activity = {
        id,
        who: await whoIs($, e.agentId),
        tool: String(e.tool).replace(/^mcp__.+?__/, ''),
        target: targetOf(e as unknown as Record<string, unknown>),
        start: t,
        end: t,
        isDone: false,
        isError: false,
      }
      await update($, activity, list => [...(list ?? []), item].slice(-200))
      await update($, now, () => t)
    } catch {}

    const ran = await next(e)

    try {
      const t = Date.now()
      const isError = ran.deny !== undefined || (ran as { isError?: boolean }).isError === true
      await update($, activity, list =>
        (list ?? []).map(one => (one.id === id ? { ...one, isDone: true, isError, end: t } : one)),
      )
      if (MUTATING.has(String(e.tool))) void refresh($)
    } catch {}
    return ran
  }).catch(($, e, next) => next(e))

  // The strip above the prompt, with the card floating over the transcript.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const m = await read($, mode)
    if (e.props.hasSurvey || m === 'off') return next(e)
    const { Box, Text, Raster } = $.ui.resolve(e) as unknown as {
      Box: any
      Text: any
      Raster?: any
    }
    const th = themeOf(await read($, themeName))
    const snap = await read($, snapshot)
    const list = await read($, activity)
    const t = (await read($, now)) || Date.now()
    const W = e.props.bodyColumns

    const running = list.filter(a => !a.isDone)
    const whoRunning = [...new Set(running.map(a => a.who))]
    const add = snap.files.reduce((s, f) => s + f.added, 0)
    const del = snap.files.reduce((s, f) => s + f.removed, 0)
    const counts = buckets(list, t, 14)
    const peak = Math.max(1, ...counts)
    const sep = <Text color={hex(th.ghost)}>  │  </Text>

    const strip = (
      <Text wrap="truncate">
        <Text color={hex(th.accent)}>✻ </Text>
        {snap.isRepo && (
          <Text>
            <Text color={hex(th.frame[0])}>⎇ </Text>
            <Text bold>{fit(snap.branch, 24)}</Text>
          </Text>
        )}
        {snap.ahead > 0 && <Text color={hex(th.add[1])}> ↑{snap.ahead}</Text>}
        {snap.behind > 0 && <Text color={hex(th.warn)}> ↓{snap.behind}</Text>}
        {sep}
        {whoRunning.length === 0 ? (
          <Text color={hex(th.faint)}>idle</Text>
        ) : (
          <Text>
            <Text color={hex(th.warn)}>{SPIN[Math.floor(t / 250) % 4]} </Text>
            {whoRunning.slice(0, 3).map((w, i) => (
              <Text color={hex(th.lanes[(i + (w === 'main' ? 0 : 1)) % th.lanes.length]!)}>
                {i > 0 ? ', ' : ''}
                {fit(w, 14)}
              </Text>
            ))}
          </Text>
        )}
        {snap.isRepo && (
          <Text>
            {sep}
            <Text color={hex(th.faint)}>{snap.files.length} files </Text>
            <Text color={hex(th.add[1])}>+{add}</Text>
            <Text> </Text>
            <Text color={hex(th.del[1])}>−{del}</Text>
          </Text>
        )}
        {sep}
        {counts.map(n => {
          const lvl = n === 0 ? -1 : Math.min(7, Math.round((n / peak) * 7))
          return <Text color={hex(lvl < 0 ? th.ghost : th.spark[lvl]!)}>{lvl < 0 ? '▁' : SPARK[lvl]}</Text>
        })}
      </Text>
    )

    if (m === 'strip' || !Raster || W < 40) return <Box flexDirection="column">{strip}</Box>

    const card = paintCard(Math.min(CARD_MAX_W, W), snap, list, t, th)
    return (
      <Box flexDirection="column">
        <Box position="absolute" bottom={1} right={0}>
          <Raster key="card" columns={card.columns} rows={card.rows} cells={card.cells} />
        </Box>
        {strip}
      </Box>
    )
  })
}
