'use strict'

import { MockAgent, setGlobalDispatcher } from 'undici'
import { test, beforeEach, afterEach } from 'tap'
import { parse } from 'yaml'
import { mkdtemp, rmdir, writeFile } from 'fs/promises'
import mkdirp from 'mkdirp'
import { join } from 'path'
import { tmpdir } from 'os'
import { isFileAccessible } from '../src/utils.mjs'
import { getGHAction, getOneStepVersion, createGHAction } from '../src/ghaction.mjs'

let mockAgent
let log = ''
let tmpDir
const fakeLogger = {
  info: msg => { log = msg }
}

beforeEach(async () => {
  log = ''
  tmpDir = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  mockAgent = new MockAgent()
  setGlobalDispatcher(mockAgent)
  mockAgent.disableNetConnect()
})

afterEach(async () => {
  await rmdir(tmpDir, { recursive: true, force: true })
})

test('getOnestepVersion, latest available', async ({ same, plan }) => {
  const client = mockAgent.get('https://api.github.com')
  client
    .intercept({
      path: '/repos/platformatic/onestep/releases/latest',
      method: 'GET'
    })
    .reply(200, {
      version: '1.0.0'
    })
  const version = await getOneStepVersion()
  same(version, '1.0.0')
})

test('getOnestepVersion, no latest but tags available', async ({ same, plan, end }) => {
  const client = mockAgent.get('https://api.github.com')
  client
    .intercept({
      path: '/repos/platformatic/onestep/releases/latest',
      method: 'GET'
    })
    .reply(404)

  client
    .intercept({
      path: '/repos/platformatic/onestep/tags',
      method: 'GET'
    })
    .reply(200, [{
      name: '1.2.3'
    }])

  const version = await getOneStepVersion()
  same(version, '1.2.3')
})

test('getOnestepVersion, no latest and no tags available', async ({ same, plan, end }) => {
  const client = mockAgent.get('https://api.github.com')
  client
    .intercept({
      path: '/repos/platformatic/onestep/releases/latest',
      method: 'GET'
    })
    .reply(404)

  client
    .intercept({
      path: '/repos/platformatic/onestep/tags',
      method: 'GET'
    })
    .reply(200, [])

  const version = await getOneStepVersion()
  same(version, 'CHANGE-ME-TO-LATEST-VERSION')
})

test('getOnestepVersion, http/403 response from gh', async ({ same, plan, end }) => {
  const client = mockAgent.get('https://api.github.com')
  client
    .intercept({
      path: '/repos/platformatic/onestep/releases/latest',
      method: 'GET'
    })
    .reply(403)

  client
    .intercept({
      path: '/repos/platformatic/onestep/tags',
      method: 'GET'
    })
    .reply(200, [{
      name: '1.2.3'
    }])

  const version = await getOneStepVersion()
  same(version, 'CHANGE-ME-TO-LATEST-VERSION')
})

test('getOnestepVersion, http/403 response from gh', async ({ same, plan, end }) => {
  const client = mockAgent.get('https://api.github.com')
  client
    .intercept({
      path: '/repos/platformatic/onestep/releases/latest',
      method: 'GET'
    })
    .reply(403)

  client
    .intercept({
      path: '/repos/platformatic/onestep/tags',
      method: 'GET'
    })
    .reply(200, [{
      name: '1.2.3'
    }])

  const version = await getOneStepVersion()
  same(version, 'CHANGE-ME-TO-LATEST-VERSION')
})

test('getOnestepVersion, return CHANGEME if error', async ({ same, plan, end }) => {
  const client = mockAgent.get('https://api.github.com')
  client
    .intercept({
      path: '/repos/platformatic/onestep/releases/latest',
      method: 'GET'
    })
    .reply(200, null) // this will throw an error because we try to destructure null

  const version = await getOneStepVersion()
  same(version, 'CHANGE-ME-TO-LATEST-VERSION')
})

test('getGHAction, no version', async ({ same, plan }) => {
  const client = mockAgent.get('https://api.github.com')
  client
    .intercept({
      path: '/repos/platformatic/onestep/releases/latest',
      method: 'GET'
    })
    .reply(200, {
      version: 'v3.2.1'
    })
  const githubAction = await getGHAction()
  const action = parse(githubAction)
  const onestep = action.jobs.build_and_deploy.steps[2].uses
  same(onestep, 'platformatic/onestep@v3.2.1')
})

test('creates gh action', async ({ end, equal }) => {
  await createGHAction(fakeLogger, tmpDir)
  equal(log, `Github action file ${tmpDir}/.github/workflows/platformatic-deploy.yml successfully created.`)
  const accessible = await isFileAccessible(join(tmpDir, '.github/workflows/platformatic-deploy.yml'))
  equal(accessible, true)
})

test('do not create gitignore file because already present', async ({ end, equal }) => {
  await mkdirp(join(tmpDir, '.github', 'workflows'))
  const ghaction = join(tmpDir, '.github', 'workflows', 'platformatic-deploy.yml')
  await writeFile(ghaction, 'TEST')
  await createGHAction(fakeLogger, tmpDir)
  equal(log, `Github action file ${tmpDir}/.github/workflows/platformatic-deploy.yml found, skipping creation of github action file.`)
})
