'use strict'

const { MockAgent, setGlobalDispatcher } = require('undici')
const { test, beforeEach } = require('tap')
const { getGHAction, getOneStepVersion } = require('../lib/ghaction')
const { parse } = require('yaml')

let mockAgent

beforeEach(() => {
  mockAgent = new MockAgent()
  setGlobalDispatcher(mockAgent)
  mockAgent.disableNetConnect()
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
