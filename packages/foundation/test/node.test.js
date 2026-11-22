import { strictEqual, throws } from 'node:assert'
import test from 'node:test'
import { checkNodeVersionForApplications, features } from '../index.js'

test('checkNodeVersionForApplications - should pass for current Node.js version', () => {
  // Since we're running on a supported Node.js version, this should not throw
  checkNodeVersionForApplications()
})

test('checkNodeVersionForApplications - should throw for old Node.js version', t => {
  // Mock process.version to simulate an old version
  const originalVersion = process.version
  Object.defineProperty(process, 'version', {
    value: 'v18.0.0',
    configurable: true
  })

  t.after(() => {
    Object.defineProperty(process, 'version', {
      value: originalVersion,
      configurable: true
    })
  })

  throws(() => checkNodeVersionForApplications(), {
    name: 'FastifyError',
    code: 'PLT_UNSUPPORTED_NODE_VERSION',
    message:
      /Your current Node\.js version is v18\.0\.0, while the minimum supported version is v24\.20\.0\. Please upgrade Node\.js and try again\./
  })
})

test('features - should have node features object', () => {
  strictEqual(typeof features.node.reusePort, 'boolean')
  strictEqual(typeof features.node.permission.network, 'boolean')
})
