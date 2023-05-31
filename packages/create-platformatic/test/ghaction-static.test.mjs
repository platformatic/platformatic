'use strict'

import { test, beforeEach, afterEach } from 'tap'
import { mkdtemp, rmdir, writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { isFileAccessible } from '../src/utils.mjs'
import { createStaticWorkspaceGHAction } from '../src/ghaction.mjs'
import { parse } from 'yaml'

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

const env = {
  DATABASE_URL: 'mydbconnectionstring',
  PLT_SERVER_LOGGER_LEVEL: 'info'
}

test('creates gh action', async ({ end, equal }) => {
  await createStaticWorkspaceGHAction(fakeLogger, env, 'db', tmpDir, false)
  equal(log[0], 'Github action successfully created, please add PLATFORMATIC_STATIC_WORKSPACE_ID and PLATFORMATIC_STATIC_WORKSPACE_API_KEY as repository secret.')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-static-workspace-deploy.yml'))
  equal(accessible, true)
  const ghFile = await readFile(join(tmpDir, '.github/workflows/platformatic-static-workspace-deploy.yml'), 'utf8')
  const ghAction = parse(ghFile)
  const { steps, permissions } = ghAction.jobs.build_and_deploy
  equal(steps.length, 3)
  equal(steps[0].name, 'Checkout application project repository')
  equal(steps[1].name, 'npm install --omit=dev')
  equal(steps[2].name, 'Deploy project')
  equal(steps[2].env.DATABASE_URL, 'mydbconnectionstring')
  equal(steps[2].env.PLT_SERVER_LOGGER_LEVEL, 'info')

  equal(permissions.contents, 'read')
})

test('creates gh action with TS build step', async ({ end, equal }) => {
  await createStaticWorkspaceGHAction(fakeLogger, env, 'db', tmpDir, true)
  equal(log[0], 'Github action successfully created, please add PLATFORMATIC_STATIC_WORKSPACE_ID and PLATFORMATIC_STATIC_WORKSPACE_API_KEY as repository secret.')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-static-workspace-deploy.yml'))
  equal(accessible, true)
  const ghFile = await readFile(join(tmpDir, '.github/workflows/platformatic-static-workspace-deploy.yml'), 'utf8')
  const ghAction = parse(ghFile)
  const { steps, permissions } = ghAction.jobs.build_and_deploy
  equal(steps.length, 4)
  equal(steps[0].name, 'Checkout application project repository')
  equal(steps[1].name, 'npm install --omit=dev')
  equal(steps[2].name, 'Build project')
  equal(steps[3].name, 'Deploy project')
  equal(steps[3].env.DATABASE_URL, 'mydbconnectionstring')
  equal(steps[3].env.PLT_SERVER_LOGGER_LEVEL, 'info')

  equal(permissions.contents, 'read')
})

test('do not create gitignore file because already present', async ({ end, equal }) => {
  await mkdir(join(tmpDir, '.github', 'workflows'), { recursive: true })
  const ghaction = join(tmpDir, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml')
  await writeFile(ghaction, 'TEST')
  await createStaticWorkspaceGHAction(fakeLogger, env, 'db', tmpDir)
  equal(log[0], `Github action file ${join(tmpDir, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml')} found, skipping creation of github action file.`)
})

test('creates gh action with a warn if a .git folder is not present', async ({ end, equal }) => {
  await createStaticWorkspaceGHAction(fakeLogger, env, 'db', tmpDir)
  equal(log[0], 'Github action successfully created, please add PLATFORMATIC_STATIC_WORKSPACE_ID and PLATFORMATIC_STATIC_WORKSPACE_API_KEY as repository secret.')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-static-workspace-deploy.yml'))
  equal(accessible, true)
  equal(log[1], 'No git repository found. The Github action won\'t be triggered.')
})

test('creates gh action without a warn if a .git folder is present', async ({ end, equal }) => {
  await mkdir(join(tmpDir, '.git'), { recursive: true })
  await createStaticWorkspaceGHAction(fakeLogger, env, 'db', tmpDir)
  equal(log[0], 'Github action successfully created, please add PLATFORMATIC_STATIC_WORKSPACE_ID and PLATFORMATIC_STATIC_WORKSPACE_API_KEY as repository secret.')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-static-workspace-deploy.yml'))
  equal(accessible, true)
  equal(log.length, 1)
})
