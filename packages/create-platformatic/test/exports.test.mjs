import { test } from 'tap'
import * as funcs from '../create-platformatic.mjs'
test('Should export functions', async ({ ok }) => {
  ok(funcs.createPackageJson)
  ok(funcs.createGitignore)
  ok(funcs.getDependencyVersion)
  ok(funcs.getVersion)
})
