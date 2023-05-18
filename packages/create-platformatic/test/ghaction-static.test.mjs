'use strict'

import { test, beforeEach, afterEach } from 'tap'
import { mkdtemp, rmdir, writeFile, readFile } from 'fs/promises'
import mkdirp from 'mkdirp'
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
  const workspaceId = '29aa2d07-e1c5-440f-bf3a-cd654d91f7ed'
  await createStaticWorkspaceGHAction(fakeLogger, workspaceId, env, 'db', tmpDir, false)
  equal(log[0], 'Github action successfully created, please add PLATFORMATIC_STATIC_WORKSPACE_API_KEY as repository secret.')
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
  const workspaceId = '29aa2d07-e1c5-440f-bf3a-cd654d91f7ed'
  await createStaticWorkspaceGHAction(fakeLogger, workspaceId, env, 'db', tmpDir, true)
  equal(log[0], 'Github action successfully created, please add PLATFORMATIC_STATIC_WORKSPACE_API_KEY as repository secret.')
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
  await mkdirp(join(tmpDir, '.github', 'workflows'))
  const ghaction = join(tmpDir, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml')
  await writeFile(ghaction, 'TEST')
  const workspaceId = '29aa2d07-e1c5-440f-bf3a-cd654d91f7ed'
  await createStaticWorkspaceGHAction(fakeLogger, workspaceId, env, 'db', tmpDir)
  equal(log[0], `Github action file ${join(tmpDir, '.github', 'workflows', 'platformatic-static-workspace-deploy.yml')} found, skipping creation of github action file.`)
})

test('creates gh action with a warn if a .git folder is not present', async ({ end, equal }) => {
  const workspaceId = '29aa2d07-e1c5-440f-bf3a-cd654d91f7ed'
  await createStaticWorkspaceGHAction(fakeLogger, workspaceId, env, 'db', tmpDir)
  equal(log[0], 'Github action successfully created, please add PLATFORMATIC_STATIC_WORKSPACE_API_KEY as repository secret.')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-static-workspace-deploy.yml'))
  equal(accessible, true)
  equal(log[1], 'No git repository found. The Github action won\'t be triggered.')
})

test('creates gh action without a warn if a .git folder is present', async ({ end, equal }) => {
  await mkdirp(join(tmpDir, '.git'))
  const workspaceId = '29aa2d07-e1c5-440f-bf3a-cd654d91f7ed'
  await createStaticWorkspaceGHAction(fakeLogger, workspaceId, env, 'db', tmpDir)
  equal(log[0], 'Github action successfully created, please add PLATFORMATIC_STATIC_WORKSPACE_API_KEY as repository secret.')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-static-workspace-deploy.yml'))
  equal(accessible, true)
  equal(log.length, 1)
})

test('do not creates gh action if workspace is empty', async ({ end, equal }) => {
  await mkdirp(join(tmpDir, '.git'))
  const workspaceId = ''
  await createStaticWorkspaceGHAction(fakeLogger, workspaceId, env, 'db', tmpDir)
  equal(log[0], 'No workspace ID provided, skipping creation of github action file.')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-static-workspace-deploy.yml'))
  equal(accessible, false)
  equal(log.length, 1)
})
