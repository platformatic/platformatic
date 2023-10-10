import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { isFileAccessible } from '../src/utils.mjs'
import { createGitignore } from '../src/create-gitignore.mjs'
import { join } from 'path'
import { mkdtemp, rm } from 'fs/promises'

let log = ''
const fakeLogger = {
  debug: msg => { log = msg }
}

let tmpDir
beforeEach(async () => {
  log = ''
  tmpDir = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

test('creates gitignore file', async ({ end, equal }) => {
  await createGitignore(fakeLogger, tmpDir)
  equal(log, `Gitignore file ${join(tmpDir, '.gitignore')} successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, '.gitignore'))
  equal(accessible, true)
})
