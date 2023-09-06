import { test } from 'tap'
import { randomBetween, sleep, validatePath, getDependencyVersion, findDBConfigFile, findServiceConfigFile, isFileAccessible, isCurrentVersionSupported, minimumSupportedNodeVersions, findRuntimeConfigFile, findComposerConfigFile } from '../src/utils.mjs'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir, platform } from 'os'
import { join } from 'path'
import esmock from 'esmock'
import semver from 'semver'

// esmock is broken on Node v20.6.0+
// Resolve once https://github.com/iambumblehead/esmock/issues/234 is fixed.

const skip = semver.gte(process.version, '20.6.0')

test('getUsername from git', { skip }, async ({ end, equal }) => {
  const name = 'lukeskywalker'
  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        if (command === 'git') {
          return { stdout: name }
        }
        return ''
      }
    }
  })
  const username = await getUsername()
  equal(username, name)
})

test('getUsername from whoami', { skip }, async ({ end, equal }) => {
  const name = 'hansolo'
  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        if (command === 'whoami') {
          return { stdout: name }
        }
        return ''
      }
    }
  })
  const username = await getUsername()
  equal(username, name)
})

test('if getUsername from git failed, it tries whoim', { skip }, async ({ end, equal }) => {
  const name = 'lukeskywalker'

  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        if (command === 'git') {
          throw new Error('git failed')
        }
        if (command === 'whoami') {
          return { stdout: name }
        }

        return ''
      }
    }
  })
  const username = await getUsername()
  equal(username, name)
})

test('if both git usern.ame and whoami fail, no username is set', { skip }, async ({ end, equal }) => {
  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        if (command === 'git') {
          throw new Error('git failed')
        }
        if (command === 'whoami') {
          throw new Error('whoami failed')
        }
        return ''
      }
    }
  })
  const username = await getUsername()
  equal(username, null)
})

test('getUsername - no username found', { skip }, async ({ end, equal }) => {
  const { getUsername } = await esmock.strict('../src/utils.mjs', {
    execa: {
      execa: (command) => {
        return ''
      }
    }
  })
  const username = await getUsername()
  equal(username, null)
})

test('randomBetween', async ({ end, equal }) => {
  const min = 1
  const max = 10
  const random = randomBetween(min, max)
  equal(random >= min && random <= max, true)
})

test('sleep', async ({ equal }) => {
  const start = Date.now()
  await sleep(100)
  const end = Date.now()
  equal(end - start >= 100, true)
})

test('validatePath', async ({ end, equal, rejects, ok }) => {
  {
    // new folder
    const valid = await validatePath('new-project')
    ok(valid)
  }

  {
    // existing folder
    const valid = await validatePath('test')
    ok(valid)
  }

  {
    // current folder
    const valid = await validatePath('.')
    ok(valid)
  }

  if (platform().indexOf('win') < 0) {
    // not writeable folder
    const valid = await validatePath('/')
    ok(!valid)
  }
})

test('getDependencyVersion', async ({ equal }) => {
  const fastifyVersion = await getDependencyVersion('fastify')
  // We cannot assert the exact version because it changes
  equal(semver.valid(fastifyVersion), fastifyVersion)
  equal(semver.gt(fastifyVersion, '4.10.0'), true)
})

test('findDBConfigFile', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.db.yml')
  writeFileSync(config, 'TEST')
  equal(await findDBConfigFile(tmpDir1), 'platformatic.db.yml')
  equal(await findDBConfigFile(tmpDir2), undefined)
  rmSync(tmpDir1, { recursive: true, force: true })
  rmSync(tmpDir2, { recursive: true, force: true })
})

test('findServiceConfigFile', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.service.toml')
  writeFileSync(config, 'TEST')
  equal(await findServiceConfigFile(tmpDir1), 'platformatic.service.toml')
  equal(await findServiceConfigFile(tmpDir2), undefined)
  rmSync(tmpDir1, { recursive: true, force: true })
  rmSync(tmpDir2, { recursive: true, force: true })
})

test('findComposerConfigFile', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.composer.yml')
  writeFileSync(config, 'TEST')
  equal(await findComposerConfigFile(tmpDir1), 'platformatic.composer.yml')
  equal(await findComposerConfigFile(tmpDir2), undefined)
  rmSync(tmpDir1, { recursive: true, force: true })
  rmSync(tmpDir2, { recursive: true, force: true })
})

test('findRuntimeConfigFile', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.runtime.yml')
  writeFileSync(config, 'TEST')
  equal(await findRuntimeConfigFile(tmpDir1), 'platformatic.runtime.yml')
  equal(await findRuntimeConfigFile(tmpDir2), undefined)
  rmSync(tmpDir1, { recursive: true, force: true })
  rmSync(tmpDir2, { recursive: true, force: true })
})

test('isFileAccessible', async ({ end, equal, mock }) => {
  const tmpDir1 = mkdtempSync(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.db.yml')
  writeFileSync(config, 'TEST')
  equal(await isFileAccessible(config), true)
  const config2 = join(tmpDir1, 'platformatic2.db.yml')
  equal(await isFileAccessible(config2), false)
  rmSync(tmpDir1, { recursive: true, force: true })
})

test('minimumSupportedNodeVersions', async ({ equal, not }) => {
  equal(Array.isArray(minimumSupportedNodeVersions), true)
  not(minimumSupportedNodeVersions.length, 0)
})

test('isCurrentVersionSupported', async ({ equal }) => {
  const { major, minor, patch } = semver.minVersion(minimumSupportedNodeVersions[0])
  {
    // major - 1 not supported
    const nodeVersion = `${major - 1}.${minor}.${patch}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // minor - 1 not supported
    const nodeVersion = `${major}.${minor - 1}.${patch}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v16 more than minimum is supported
    const supported = isCurrentVersionSupported(`${major}.${minor + 2}.${patch}`)
    equal(supported, true)
  }

  // node version 19 test, to check greater and lesser major version
  const { major: major19, minor: minor19, patch: patch19 } = semver.minVersion(minimumSupportedNodeVersions[1])
  {
    // v18.0.0 is not supported
    const nodeVersion = `${major19 - 1}.${minor19}.${patch19}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v20 is not supported
    const nodeVersion = `${major19 + 1}.${minor19}.${patch19}`
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v19 supported
    const supported = isCurrentVersionSupported(`${major19}.${minor19 + 1}.${patch19}`)
    equal(supported, true)
  }
  for (const version of minimumSupportedNodeVersions) {
    const supported = isCurrentVersionSupported(version)
    equal(supported, true)
  }
})
