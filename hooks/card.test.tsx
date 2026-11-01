import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'ccradar',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 12,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 11 },
    view: {},
  },
} as const

const STATUS = '## main...origin/main [ahead 2]\n M src/auth.ts\n?? notes.md\n'

test('the strip and the floating card draw on the terminal', async ($, on) => {
  on('command.register', () => ({ value: { command: 'ccradar' } }))
  on('agent.list', () => ({ value: [] }))
  on('clock.every', () => ({ value: { cancel() {} } }))
  on('process.run', (_, e) => {
    const argv = (e as unknown as { argv: string[] }).argv
    const out =
      argv[1] === 'status'
        ? STATUS
        : argv[1] === 'diff' && argv.length === 3
          ? '12\t3\tsrc/auth.ts\n'
          : argv[1] === 'log'
            ? 'a1b2c3d\tfix: session refresh\t5 minutes ago'
            : ''
    return { value: { exitCode: 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/x/src/auth.ts', old_string: 'a', new_string: 'b' })

  for (const theme of ['catppuccin', 'tokyonight', 'gruvbox', 'rosepine', 'kanagawa', 'nord', 'dracula', 'claude']) {
    await $.command.run({ command: 'ccradar', args: `theme ${theme}` } as never)
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /✻/ })).toBeDefined()
    expect(await ui.find({ type: 'Raster' })).toBeDefined()
    await ui.unmount()
  }
})
