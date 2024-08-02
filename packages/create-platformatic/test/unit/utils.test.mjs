'use strict'

import { safeRemove } from '@platformatic/utils'
import esmock from 'esmock'
import { mkdtemp, writeFile } from 'fs/promises'
import { deepEqual, equal, notEqual } from 'node:assert'
import { test } from 'node:test'
import { tmpdir } from 'os'
import { join } from 'path'
import semver from 'semver'
import {
  addPrefixToEnv,
  convertServiceNameToPrefix,
  findComposerConfigFile,
  findDBConfigFile,
  findRuntimeConfigFile,
  findServiceConfigFile,
  getDependencyVersion,
  isCurrentVersionSupported,
  isFileAccessible,
  minimumSupportedNodeVersions,
  randomBetween,
  sleep,
} from '../../src/utils.mjs'

test('getUsername from git', async () => {
  const name = 'lukeskywalker'
  const { getUsername } = await esmock.strict('../../src/utils.mjs', {
    execa: {
      execa: command => {
        if (command === 'git') {
          return { stdout: name }
        }
        return ''
      },
    },
  })
  const username = await getUsername()
  equal(username, name)
})

test('getUsername from whoami', async () => {
  const name = 'hansolo'
  const { getUsername } = await esmock.strict('../../src/utils.mjs', {
    execa: {
      execa: command => {
        if (command === 'whoami') {
          return { stdout: name }
        }
        return ''
      },
    },
  })
  const username = await getUsername()
  equal(username, name)
})

test('if getUsername from git failed, it tries whoim', async () => {
  const name = 'lukeskywalker'

  const { getUsername } = await esmock.strict('../../src/utils.mjs', {
    execa: {
      execa: command => {
        if (command === 'git') {
          throw new Error('git failed')
        }
        if (command === 'whoami') {
          return { stdout: name }
        }

        return ''
      },
    },
  })
  const username = await getUsername()
  equal(username, name)
})

test('if both git usern.ame and whoami fail, no username is set', async () => {
  const { getUsername } = await esmock.strict('../../src/utils.mjs', {
    execa: {
      execa: command => {
        if (command === 'git') {
          throw new Error('git failed')
        }
        if (command === 'whoami') {
          throw new Error('whoami failed')
        }
        return ''
      },
    },
  })
  const username = await getUsername()
  equal(username, null)
})

test('getUsername - no username found', async () => {
  const { getUsername } = await esmock.strict('../../src/utils.mjs', {
    execa: {
      execa: command => {
        return ''
      },
    },
  })
  const username = await getUsername()
  equal(username, null)
})

test('randomBetween', async () => {
  const min = 1
  const max = 10
  const random = randomBetween(min, max)
  equal(random >= min && random <= max, true)
})

test('sleep', async () => {
  const start = Date.now()
  await sleep(100)
  const end = Date.now()
  // We cannot assert the exact drift because timers
  // are imprecise
  equal(end - start >= 90, true)
})

test('getDependencyVersion', async () => {
  const fastifyVersion = await getDependencyVersion('fastify')
  // We cannot assert the exact version because it changes
  equal(semver.valid(fastifyVersion), fastifyVersion)
  equal(semver.gt(fastifyVersion, '4.10.0'), true)

  const typescriptVersion = await getDependencyVersion('typescript')
  // We cannot assert the exact version because it changes
  equal(semver.valid(typescriptVersion), typescriptVersion)
  equal(semver.gt(typescriptVersion, '5.0.0'), true)

  const platformaticConfig = await getDependencyVersion('@platformatic/config')
  // We cannot assert the exact version because it changes
  equal(semver.valid(platformaticConfig), platformaticConfig)
  equal(semver.gt(platformaticConfig, '1.0.0'), true)

  const typesVersion = await getDependencyVersion('@types/node')
  // We cannot assert the exact version because it changes
  equal(semver.valid(typesVersion), typesVersion)
  equal(semver.gt(typesVersion, '20.0.0'), true)

  const unkownVersion = await getDependencyVersion('@types/npm')
  equal(unkownVersion, undefined)
})

test('findDBConfigFile', async () => {
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.db.yml')
  await writeFile(config, 'TEST')
  equal(await findDBConfigFile(tmpDir1), 'platformatic.db.yml')
  equal(await findDBConfigFile(tmpDir2), undefined)
  await safeRemove(tmpDir1)
  await safeRemove(tmpDir2)
})

test('findServiceConfigFile', async () => {
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.service.toml')
  await writeFile(config, 'TEST')
  equal(await findServiceConfigFile(tmpDir1), 'platformatic.service.toml')
  equal(await findServiceConfigFile(tmpDir2), undefined)
  await safeRemove(tmpDir1)
  await safeRemove(tmpDir2)
})

test('findComposerConfigFile', async () => {
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.composer.yml')
  await writeFile(config, 'TEST')
  equal(await findComposerConfigFile(tmpDir1), 'platformatic.composer.yml')
  equal(await findComposerConfigFile(tmpDir2), undefined)
  await safeRemove(tmpDir1)
  await safeRemove(tmpDir2)
})

test('findRuntimeConfigFile', async () => {
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  const tmpDir2 = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.runtime.yml')
  await writeFile(config, 'TEST')
  equal(await findRuntimeConfigFile(tmpDir1), 'platformatic.runtime.yml')
  equal(await findRuntimeConfigFile(tmpDir2), undefined)
  await safeRemove(tmpDir1)
  await safeRemove(tmpDir2)
})

test('isFileAccessible', async () => {
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-platformatic-'))
  const config = join(tmpDir1, 'platformatic.db.yml')
  await writeFile(config, 'TEST')
  equal(await isFileAccessible(config), true)
  const config2 = join(tmpDir1, 'platformatic2.db.yml')
  equal(await isFileAccessible(config2), false)
  await safeRemove(tmpDir1)
})

test('minimumSupportedNodeVersions', async () => {
  equal(Array.isArray(minimumSupportedNodeVersions), true)
  notEqual(minimumSupportedNodeVersions.length, 0)
})

test('isCurrentVersionSupported', async () => {
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

  // node version 20 test, to check greater and lesser major version
  {
    // v18.0.0 is not supported
    const nodeVersion = '18.0.0'
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, false)
  }
  {
    // v18.8.0 is supported
    const nodeVersion = '18.8.0'
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, true)
  }
  {
    // v20.5.1 is not supported
    const supported = isCurrentVersionSupported('20.5.1')
    equal(supported, false)
  }
  {
    // v20.6.0 is supported
    const nodeVersion = '20.6.0'
    const supported = isCurrentVersionSupported(nodeVersion)
    equal(supported, true)
  }
  {
    // v19.0.0 is not supported
    const supported = isCurrentVersionSupported('19.0.0')
    equal(supported, false)
  }
  {
    // v19.9.0 is not supported
    const supported = isCurrentVersionSupported('19.9.0')
    equal(supported, false)
  }
  for (const version of minimumSupportedNodeVersions) {
    const supported = isCurrentVersionSupported(version)
    equal(supported, true)
  }
})

test('should convert service name to env prefix', async () => {
  const expectations = {
    'my-service': 'MY_SERVICE',
    a: 'A',
    MY_SERVICE: 'MY_SERVICE',
    asderas123: 'ASDERAS123',
  }

  Object.entries(expectations).forEach(exp => {
    const converted = convertServiceNameToPrefix(exp[0])
    equal(exp[1], converted)
  })
})

test('should add prefix to a key/value object', async () => {
  const prefix = 'MY_PREFIX'
  const env = {
    PLT_HOSTNAME: 'myhost',
    PORT: '3042',
  }
  deepEqual(addPrefixToEnv(env, prefix), {
    MY_PREFIX_PLT_HOSTNAME: 'myhost',
    MY_PREFIX_PORT: '3042',
  })
})
