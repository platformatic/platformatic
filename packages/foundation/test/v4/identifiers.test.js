import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { test } from 'node:test'
import {
  assertValidApplicationId,
  deriveApplicationId,
  findTopologyVariableCollisions,
  getApplicationUrl,
  isValidApplicationId,
  stripPackageScope,
  topologyVariableName
} from '../../lib/v4/index.js'

test('the derivation is explicit id, then package name with the scope stripped, then directory', () => {
  deepStrictEqual(deriveApplicationId({ id: 'api', packageName: '@acme/frontend', directory: '/proj/web/x' }), {
    id: 'api',
    source: 'configuration'
  })

  deepStrictEqual(deriveApplicationId({ packageName: '@acme/frontend', directory: '/proj/web/x' }), {
    id: 'frontend',
    source: 'package.json'
  })

  deepStrictEqual(deriveApplicationId({ directory: '/proj/web/frontend' }), {
    id: 'frontend',
    source: 'directory'
  })
})

test('stripping the scope is not cosmetic', () => {
  // The id becomes a DNS label in http://<id>.plt.local, so keeping @acme/frontend would emit
  // http://@acme/frontend.plt.local, where @acme parses as userinfo.
  strictEqual(stripPackageScope('@acme/frontend'), 'frontend')
  strictEqual(stripPackageScope('frontend'), 'frontend')
  strictEqual(getApplicationUrl('frontend'), 'http://frontend.plt.local')
})

test('the test is the DNS label grammar itself, not a list of bad characters', () => {
  ok(isValidApplicationId('api'))
  ok(isValidApplicationId('api-v2'))
  ok(isValidApplicationId('a'))
  ok(isValidApplicationId('a'.repeat(63)))

  // An enumeration of @, / and whitespace would have admitted the first two of these.
  ok(!isValidApplicationId('my_app'))
  ok(!isValidApplicationId('api.v2'))
  ok(!isValidApplicationId('-api'))
  ok(!isValidApplicationId('api-'))
  ok(!isValidApplicationId(''))
  ok(!isValidApplicationId('a'.repeat(64)))
  ok(!isValidApplicationId('@acme/frontend'))
})

test('an invalid id names the entry and asks for an explicit id rather than sanitizing', () => {
  // Silently rewriting my_app to my-app would move the mesh hostname, the injected variable and
  // the metrics label without the user asking.
  throws(() => assertValidApplicationId('my_app', 'the directory name'), error => {
    strictEqual(error.code, 'PLT_INVALID_APPLICATION_ID')
    ok(error.message.includes('my_app'))
    ok(error.message.includes('the directory name'))
    ok(error.message.includes('explicit id'))
    return true
  })

  strictEqual(assertValidApplicationId('api-v2', 'configuration'), 'api-v2')
})

test('the topology variable uses the same normalization injection uses', () => {
  strictEqual(topologyVariableName('api'), 'PLT_API_URL')
  strictEqual(topologyVariableName('api-v2'), 'PLT_API_V2_URL')
})

test('two ids normalizing to one variable name is a collision, and case is what remains', () => {
  // The label grammar removes most of the ways this could happen — api_v2 is not a legal id at all
  // — so what remains is a case difference, and DNS labels being case-insensitive those are the
  // same mesh hostname too. One check catches both.
  deepStrictEqual(findTopologyVariableCollisions(['api-v2', 'API-v2']), [
    { name: 'PLT_API_V2_URL', ids: ['api-v2', 'API-v2'] }
  ])

  deepStrictEqual(findTopologyVariableCollisions(['api', 'frontend']), [])
})
