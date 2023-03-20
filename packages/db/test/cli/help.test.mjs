import { cliPath } from './helper.js'
import { test } from 'tap'
import { execa } from 'execa'
import { join } from 'desm'
import { readFile } from 'fs/promises'
import { EOL } from 'os'

const CLI_COMMANDS = [
  'types',
  'start',
  'compile',
  'seed',
  'schema',
  'migrations',
  'migrations create',
  'migrations apply'
]

for (const cmd of CLI_COMMANDS) {
  test(`db help ${cmd}`, async (t) => {
    const { stdout } = await execa('node', [cliPath, 'help', cmd])
    const path = join(import.meta.url, '..', '..', 'help', `${cmd}.txt`)
    t.match(stdout + EOL, await readFile(path, 'utf8'))
  })
}

test('db help foobar', async (t) => {
  const { stdout } = await execa('node', [cliPath, 'help', 'foobar'])
  t.match(stdout, 'no such help file: foobar')
})
