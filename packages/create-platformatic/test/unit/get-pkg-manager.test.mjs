import { test } from 'node:test'
import { equal } from 'node:assert'
import { getPkgManager } from '../../src/get-pkg-manager.mjs'

test.beforeEach(() => {
  delete process.env.npm_config_user_agent
})

test('detects npm', async () => {
  process.env.npm_config_user_agent = 'npm/7.18.1 node/v16.4.2 darwin x64'
  equal(getPkgManager(), 'npm')
})

test('detects yarn', async () => {
  process.env.npm_config_user_agent = 'yarn/1.22.10 npm/? node/v16.4.2 darwin x64'
  equal(getPkgManager(), 'yarn')
})

test('detects pnpm', async () => {
  process.env.npm_config_user_agent = 'pnpm/6.14.1 npm/? node/v16.4.2 darwin x64'
  equal(getPkgManager(), 'pnpm')
})

test('detects cnpm', async () => {
  process.env.npm_config_user_agent = 'cnpm/7.0.0 npminsall/1.0.0 node/v16.4.2 darwin x64'
  equal(getPkgManager(), 'cnpm')
})

test('defaults to npm if the user agent is unknown', async () => {
  process.env.npm_config_user_agent = 'xxxxxxxxxxxxxxxxxx'
  equal(getPkgManager(), 'npm')
})

test('defaults to npm if the user agent is not set', async () => {
  delete process.env.npm_config_user_agent
  equal(getPkgManager(), 'npm')
})
