import { test } from 'node:test'
import { ok } from 'node:assert'
import * as funcs from '../../create-platformatic.mjs'

test('Should export functions', async () => {
  ok(funcs.createPackageJson)
  ok(funcs.createGitignore)
  ok(funcs.getDependencyVersion)
  ok(funcs.getVersion)
})
