import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'
import { SharedContext } from '../lib/worker/shared-context.js'
import {
  DEFAULT_COOKIE_MAX_AGE,
  DEFAULT_COOKIE_NAME,
  buildCookie,
  createVersionResolver,
  resolveSkewConfig,
  shouldIssueCookie
} from '../lib/worker/skew-protection.js'

test('the schema supplies the defaults, so a config that says nothing leaves it off', async () => {
  const config = await loadConfiguration(join(import.meta.dirname, '..', 'fixtures', 'configs', 'monorepo.json'))

  assert.deepStrictEqual(config.skewProtection, {
    enabled: false,
    cookieName: DEFAULT_COOKIE_NAME,
    maxAge: DEFAULT_COOKIE_MAX_AGE
  })
  assert.strictEqual(resolveSkewConfig(config.skewProtection), null)
})

test('skew protection stays off unless it is enabled', () => {
  assert.strictEqual(resolveSkewConfig(undefined), null)
  assert.strictEqual(resolveSkewConfig({}), null)
  assert.strictEqual(resolveSkewConfig({ enabled: false }), null)
  assert.strictEqual(resolveSkewConfig({ cookieName: '__custom' }), null)
})

test('skew protection defaults the cookie name and lifetime', () => {
  assert.deepStrictEqual(resolveSkewConfig({ enabled: true }), {
    cookieName: DEFAULT_COOKIE_NAME,
    maxAge: DEFAULT_COOKIE_MAX_AGE
  })
})

test('the version comes from the environment at boot', () => {
  const resolve = createVersionResolver(new SharedContext(), { PLT_DEPLOYMENT_VERSION: 'v1' })
  assert.strictEqual(resolve(), 'v1')
})

test('the shared context wins, so a version arriving after boot is used', () => {
  const sharedContext = new SharedContext()
  const resolve = createVersionResolver(sharedContext, { PLT_DEPLOYMENT_VERSION: 'stale' })

  assert.strictEqual(resolve(), 'stale')
  sharedContext._set({ deploymentVersion: 'v2', iccAuthHeaders: {} })
  assert.strictEqual(resolve(), 'v2')
})

test('no version anywhere resolves to null, and nothing is pinned', () => {
  const resolve = createVersionResolver(new SharedContext(), {})
  assert.strictEqual(resolve(), null)
})

test('a pending shared context read is not mistaken for a version', () => {
  const sharedContext = new SharedContext()
  // get() caches a promise; reading it synchronously must not yield one.
  sharedContext.sharedContext = Promise.resolve({ deploymentVersion: 'v2' })

  assert.strictEqual(sharedContext.getSync(), null)
  assert.strictEqual(createVersionResolver(sharedContext, { PLT_DEPLOYMENT_VERSION: 'v1' })(), 'v1')
})

test('the cookie name and max age can be overridden, and bad values fall back', () => {
  const base = { enabled: true }

  assert.strictEqual(resolveSkewConfig({ ...base, cookieName: '__custom' }).cookieName, '__custom')
  assert.strictEqual(resolveSkewConfig({ ...base, maxAge: 60 }).maxAge, 60)
  assert.strictEqual(resolveSkewConfig({ ...base, maxAge: 0 }).maxAge, DEFAULT_COOKIE_MAX_AGE)
  assert.strictEqual(resolveSkewConfig({ ...base, maxAge: undefined }).maxAge, DEFAULT_COOKIE_MAX_AGE)
})

test('the cookie matches the attributes the Kubernetes gateway sets', () => {
  const cookie = buildCookie({ cookieName: '__plt_dpl', version: 'v3', path: '/', maxAge: 43200 })
  assert.strictEqual(cookie, '__plt_dpl=v3; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200')
})

test('the cookie path follows the base path so it is scoped like the gateway rule', () => {
  const cookie = buildCookie({ cookieName: '__plt_dpl', version: 'v3', path: '/my-app', maxAge: 43200 })
  assert.ok(cookie.includes('Path=/my-app'))
})

test('a request with no pin is issued one', () => {
  assert.strictEqual(shouldIssueCookie({}, '__plt_dpl'), true)
  assert.strictEqual(shouldIssueCookie({ cookie: 'other=1' }, '__plt_dpl'), true)
})

test('an existing pin is never refreshed, so a draining version can finish draining', () => {
  // The gateway sets the cookie only on the default (active) rule; the draining
  // and preview rules set nothing. A draining version that refreshed its own pin
  // would hold an active browser on it forever.
  assert.strictEqual(shouldIssueCookie({ cookie: '__plt_dpl=v1' }, '__plt_dpl'), false)
  assert.strictEqual(shouldIssueCookie({ cookie: 'a=1; __plt_dpl=v1; b=2' }, '__plt_dpl'), false)
  assert.strictEqual(shouldIssueCookie({ cookie: '__plt_dpl=v1;' }, '__plt_dpl'), false)
})

test('a cookie whose name merely contains ours does not count as a pin', () => {
  assert.strictEqual(shouldIssueCookie({ cookie: 'x__plt_dpl=v1' }, '__plt_dpl'), true)
  assert.strictEqual(shouldIssueCookie({ cookie: '__plt_dpl_other=v1' }, '__plt_dpl'), true)
  // A value that looks like our cookie must not be mistaken for one.
  assert.strictEqual(shouldIssueCookie({ cookie: 'other=__plt_dpl=v1' }, '__plt_dpl'), true)
})

test('a preview request is never pinned to the version it previews', () => {
  assert.strictEqual(shouldIssueCookie({ 'x-deployment-id': 'v2' }, '__plt_dpl'), false)
  assert.strictEqual(shouldIssueCookie({ 'x-deployment-id': 'v2', cookie: 'a=1' }, '__plt_dpl'), false)
})

test('a custom cookie name is what gets looked for', () => {
  assert.strictEqual(shouldIssueCookie({ cookie: '__plt_dpl=v1' }, '__custom'), true)
  assert.strictEqual(shouldIssueCookie({ cookie: '__custom=v1' }, '__custom'), false)
})
