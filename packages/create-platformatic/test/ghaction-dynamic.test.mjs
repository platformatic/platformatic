'use strict'

import { test, beforeEach, afterEach } from 'tap'
import { mkdtemp, rmdir, writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { isFileAccessible } from '../src/utils.mjs'
import { createDynamicWorkspaceGHAction } from '../src/ghaction.mjs'
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

test('creates gh action', async ({ equal, match }) => {
  await createDynamicWorkspaceGHAction(fakeLogger, env, 'db', tmpDir, false)
  equal(log[0], 'Github action successfully created, please add the following secrets as repository secrets: ')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-dynamic-workspace-deploy.yml'))
  equal(accessible, true)
  const ghFile = await readFile(join(tmpDir, '.github/workflows/platformatic-dynamic-workspace-deploy.yml'), 'utf8')
  const ghAction = parse(ghFile)
  const { steps, permissions, env: jobEnv } = ghAction.jobs.build_and_deploy
  equal(steps.length, 3)
  equal(steps[0].name, 'Checkout application project repository')
  equal(steps[1].name, 'npm install --omit=dev')
  equal(steps[2].name, 'Deploy project')
  match(jobEnv.DATABASE_URL, /\$\{\{ secrets.DATABASE_URL \}\}/)
  equal(jobEnv.PLT_SERVER_LOGGER_LEVEL, 'info')

  equal(permissions.contents, 'read')
  equal(permissions['pull-requests'], 'write')
})

test('creates gh action with TS build step', async ({ equal, match }) => {
  await createDynamicWorkspaceGHAction(fakeLogger, env, 'db', tmpDir, true)
  equal(log[0], 'Github action successfully created, please add the following secrets as repository secrets: ')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-dynamic-workspace-deploy.yml'))
  equal(accessible, true)
  const ghFile = await readFile(join(tmpDir, '.github/workflows/platformatic-dynamic-workspace-deploy.yml'), 'utf8')
  const ghAction = parse(ghFile)
  const { steps, permissions, env: jobEnv } = ghAction.jobs.build_and_deploy
  equal(steps.length, 4)
  equal(steps[0].name, 'Checkout application project repository')
  equal(steps[1].name, 'npm install --omit=dev')
  equal(steps[2].name, 'Build project')
  equal(steps[3].name, 'Deploy project')
  match(jobEnv.DATABASE_URL, /\$\{\{ secrets.DATABASE_URL \}\}/)
  equal(jobEnv.PLT_SERVER_LOGGER_LEVEL, 'info')

  equal(permissions.contents, 'read')
  equal(permissions['pull-requests'], 'write')
})

test('do not create gitignore file because already present', async ({ end, equal }) => {
  await mkdir(join(tmpDir, '.github', 'workflows'), { recursive: true })
  const ghaction = join(tmpDir, '.github', 'workflows', 'platformatic-dynamic-workspace-deploy.yml')
  await writeFile(ghaction, 'TEST')
  await createDynamicWorkspaceGHAction(fakeLogger, env, 'db', tmpDir)
  equal(log[0], `Github action file ${join(tmpDir, '.github', 'workflows', 'platformatic-dynamic-workspace-deploy.yml')} found, skipping creation of github action file.`)
})

test('creates gh action with a warn if a .git folder is not present', async ({ end, equal }) => {
  await createDynamicWorkspaceGHAction(fakeLogger, env, 'db', tmpDir)
  equal(log[0], 'Github action successfully created, please add the following secrets as repository secrets: ')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-dynamic-workspace-deploy.yml'))
  equal(accessible, true)
  const secretsLogLine = log[1].split('\n')
  equal(secretsLogLine[1].trim(), 'PLATFORMATIC_DYNAMIC_WORKSPACE_ID: your workspace id')
  equal(secretsLogLine[2].trim(), 'PLATFORMATIC_DYNAMIC_WORKSPACE_API_KEY: your workspace API key')
  equal(secretsLogLine[3].trim(), 'DATABASE_URL: mydbconnectionstring')
  equal(log[2], 'No git repository found. The Github action won\'t be triggered.')
})

test('creates gh action without a warn if a .git folder is present', async ({ end, equal }) => {
  await mkdir(join(tmpDir, '.git'), { recursive: true })
  await createDynamicWorkspaceGHAction(fakeLogger, env, 'db', tmpDir)
  equal(log[0], 'Github action successfully created, please add the following secrets as repository secrets: ')
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-dynamic-workspace-deploy.yml'))
  equal(accessible, true)
  equal(log.length, 2)
})
