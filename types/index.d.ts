export type Activity = {
  id: string
  who: string
  tool: string
  target: string
  start: number
  end: number
  isDone: boolean
  isError: boolean
}

export type FileChange = {
  path: string
  code: string
  added: number
  removed: number
}

export type Commit = { hash: string; subject: string; when: string }

export type GitSnapshot = {
  isRepo: boolean
  branch: string
  upstream: string
  ahead: number
  behind: number
  files: FileChange[]
  commits: Commit[]
}

/** overlay: strip + floating card; strip: one line only; off: nothing. */
export type Mode = 'overlay' | 'strip' | 'off'

declare module 'claude-code' {
  interface PluginState {
    'ccradar': {
      activity: Shaped<Activity[]>
      snapshot: Shaped<GitSnapshot>
      mode: Mode
      theme: string
      now: number
    }
  }
}
