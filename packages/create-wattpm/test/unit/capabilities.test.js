'use strict'

import { equal } from 'node:assert'
import { test } from 'node:test'
import { defaultCapabilities } from '../../lib/index.js'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Helper function to navigate to the repo root
function getRepoRoot () {
  // From test/unit/capabilities.test.js to the repo root
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
}

test('internal packages should exist in packages directory', async () => {
  const packagesDir = join(getRepoRoot(), 'packages')

  for (const [pkgName, pkgInfo] of Object.entries(defaultCapabilities)) {
    if (!pkgInfo.external) {
      // Internal package - should exist in packages/
      const packageName = pkgName.replace('@platformatic/', '')
      const packagePath = join(packagesDir, packageName)
      equal(existsSync(packagePath), true, `Internal package ${pkgName} should exist at packages/${packageName}`)
    }
  }
})

test('external packages should NOT exist in packages directory', async () => {
  const packagesDir = join(getRepoRoot(), 'packages')

  for (const [pkgName, pkgInfo] of Object.entries(defaultCapabilities)) {
    if (pkgInfo.external) {
      // External package - should NOT exist in packages/
      const packageName = pkgName.replace('@platformatic/', '')
      const packagePath = join(packagesDir, packageName)
      equal(existsSync(packagePath), false, `External package ${pkgName} should NOT exist at packages/${packageName}`)
    }
  }
})
