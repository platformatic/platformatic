'use strict'

import { test, beforeEach, afterEach } from 'tap'
import { mkdtemp, rmdir, writeFile } from 'fs/promises'
import mkdirp from 'mkdirp'
import { join } from 'path'
import { tmpdir } from 'os'
import { isFileAccessible } from '../src/utils.mjs'
import { createGHAction } from '../src/ghaction.mjs'

let log = []
let tmpDir
const fakeLogger = {
  info: msg => { log.push(msg) },
  warn: msg => { log.push(msg) }
}

beforeEach(async () => {
  log = []
  tmpDir = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
})

afterEach(async () => {
  await rmdir(tmpDir, { recursive: true, force: true })
})

test('creates gh action', async ({ end, equal }) => {
  await createGHAction(fakeLogger, tmpDir)
  equal(log[0], `Github action file ${tmpDir}/.github/workflows/platformatic-deploy.yml successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-deploy.yml'))
  equal(accessible, true)
})

test('do not create gitignore file because already present', async ({ end, equal }) => {
  await mkdirp(join(tmpDir, '.github', 'workflows'))
  const ghaction = join(tmpDir, '.github', 'workflows', 'platformatic-deploy.yml')
  await writeFile(ghaction, 'TEST')
  await createGHAction(fakeLogger, tmpDir)
  equal(log[0], `Github action file ${tmpDir}/.github/workflows/platformatic-deploy.yml found, skipping creation of github action file.`)
})

test('creates gh action with a warn if a .git folder is not present', async ({ end, equal }) => {
  await createGHAction(fakeLogger, tmpDir)
  equal(log[0], `Github action file ${tmpDir}/.github/workflows/platformatic-deploy.yml successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-deploy.yml'))
  equal(accessible, true)
  equal(log[1], 'No git repository found. The Github action won\'t be triggered.')
})

test('creates gh action without a warn if a .git folder is present', async ({ end, equal }) => {
  await mkdirp(join(tmpDir, '.git'))
  await createGHAction(fakeLogger, tmpDir)
  equal(log[0], `Github action file ${tmpDir}/.github/workflows/platformatic-deploy.yml successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-deploy.yml'))
  equal(accessible, true)
  equal(log.length, 1)
})
