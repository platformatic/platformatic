'use strict'

const assert = require('node:assert')
const { beforeEach, test } = require('tap')
const { MockAgent, setGlobalDispatcher } = require('undici')
const makePrewarmRequest = require('../lib/prewarm')

let mockAgent
beforeEach(() => {
  mockAgent = new MockAgent()
  setGlobalDispatcher(mockAgent)
  mockAgent.disableNetConnect()
})

test('prewarm request passes on first try', async (t) => {
  const svc = 'https://name-name-name-name.deploy.space'
  const warmMe = mockAgent.get(svc)
  warmMe.intercept({
    path: '/',
    method: 'GET'
  }).reply(200, {})

  await makePrewarmRequest(svc)

  mockAgent.assertNoPendingInterceptors()
})

test('prewarm request passes on second try', async (t) => {
  const svc = 'https://name-name-name-name.deploy.space'
  const warmMe = mockAgent.get(svc)
  warmMe.intercept({
    path: '/',
    method: 'GET'
  }).reply(500, {})
  warmMe.intercept({
    path: '/',
    method: 'GET'
  }).reply(200, {})

  await makePrewarmRequest(svc)

  mockAgent.assertNoPendingInterceptors()
})

test('prewarm throws error when all retries attempted', async (t) => {
  t.plan(4)

  const svc = 'https://name-name-name-name.deploy.space'
  const warmMe = mockAgent.get(svc)
  warmMe.intercept({
    path: '/',
    method: 'GET'
  }).reply(500, {})

  const logger = {
    warn: (message) => t.match(message, /Could not make a prewarm call/)
  }

  await assert.rejects(
    makePrewarmRequest(svc, logger),
    /Could not make a prewarm call/
  )
  mockAgent.assertNoPendingInterceptors()
})

test('prewarm successful on 302', async (t) => {
  const svc = 'https://name-name-name-name.deploy.space'
  const warmMe = mockAgent.get(svc)
  warmMe.intercept({
    path: '/',
    method: 'GET'
  }).reply(302, {})

  await makePrewarmRequest(svc)

  mockAgent.assertNoPendingInterceptors()
})
