import { test, beforeEach, afterEach } from 'tap'
import { tmpdir } from 'os'
import { isFileAccessible } from '../src/utils.mjs'
import { createGitignore } from '../src/create-gitignore.mjs'
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

test('creates gitignore file', async ({ end, equal }) => {
  await createGitignore(fakeLogger, tmpDir)
  equal(log, `Gitignore file ${join(tmpDir, '.gitignore')} successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, '.gitignore'))
  equal(accessible, true)
})

test('do not create gitignore file because already present', async ({ end, equal }) => {
  const gitignore = join(tmpDir, '.gitignore')
  writeFileSync(gitignore, 'TEST')
  await createGitignore(fakeLogger, tmpDir)
  equal(log, `Gitignore file ${join(tmpDir, '.gitignore')} found, skipping creation of gitignore file.`)
})
