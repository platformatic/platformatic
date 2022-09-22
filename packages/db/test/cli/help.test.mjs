import { cliPath } from './helper.mjs'
import { test } from 'tap'
import { execa } from 'execa'
import { join } from 'desm'
import { readFile } from 'fs/promises'
import { EOL } from 'os'

for (const cmd of ['start', 'seed', 'schema', 'migrate']) {
  test(`db help ${cmd}`, async (t) => {
    const { stdout } = await execa(cliPath, ['help', cmd])
    const path = join(import.meta.url, '..', '..', 'help', `${cmd}.txt`)
    t.match(stdout + EOL, await readFile(path, 'utf8'))
  })
}

test('db help foobar', async (t) => {
  const { stdout } = await execa(cliPath, ['help', 'foobar'])
  t.match(stdout, 'no such help file: foobar')
})
