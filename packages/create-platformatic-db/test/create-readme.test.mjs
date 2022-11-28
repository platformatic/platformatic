import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { isFileAccessible } from '../src/utils.mjs'
import { createReadme } from '../src/create-readme.mjs'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

let log = ''
const fakeLogger = {
  debug: msg => { log = msg }
}

let tmpDir
beforeEach(() => {
  log = ''
  tmpDir = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

test('create README.md file', async ({ end, equal }) => {
  await createReadme(fakeLogger, tmpDir)
  equal(log, `${tmpDir}/README.md successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, 'README.md'))
  equal(accessible, true)
})

test('do not create README.md file because already present', async ({ end, equal }) => {
  const readme = join(tmpDir, 'README.md')
  writeFileSync(readme, 'TEST')
  await createReadme(fakeLogger, tmpDir)
  equal(log, `${tmpDir}/README.md found, skipping creation of README.md file.`)
})
