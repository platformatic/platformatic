'use strict'

import { safeRemove } from '@platformatic/foundation'
import esmock from 'esmock'
import { mkdtemp, writeFile } from 'fs/promises'
import { deepEqual, equal } from 'node:assert'
import { test } from 'node:test'
import { tmpdir } from 'os'
import { join } from 'path'
import semver from 'semver'
import {
  addPrefixToEnv,
  convertApplicationNameToPrefix,
  findDBConfigFile,
  findGatewayConfigFile,
  findRuntimeConfigFile,
  findServiceConfigFile,
  getDependencyVersion,
  isFileAccessible,
  randomBetween,
  sleep
} from '../../lib/utils.js'

test('getUsername from git', async () => {
  const name = 'lukeskywalker'
  const { getUsername } = await esmock.strict('../../lib/utils.js', {
    execa: {
      execa: command => {
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

test('getUsername from whoami', async () => {
  const name = 'hansolo'
  const { getUsername } = await esmock.strict('../../lib/utils.js', {
    execa: {
      execa: command => {
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

test('if getUsername from git failed, it tries whoim', async () => {
  const name = 'lukeskywalker'

  const { getUsername } = await esmock.strict('../../lib/utils.js', {
    execa: {
      execa: command => {
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

test('if both git usern.ame and whoami fail, no username is set', async () => {
  const { getUsername } = await esmock.strict('../../lib/utils.js', {
    execa: {
      execa: command => {
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

test('getUsername - no username found', async () => {
  const { getUsername } = await esmock.strict('../../lib/utils.js', {
    execa: {
      execa: command => {
        return ''
      }
    }
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

  const platformaticConfig = await getDependencyVersion('@platformatic/runtime')
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
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-wattpm-'))
  const tmpDir2 = await mkdtemp(join(tmpdir(), 'test-create-wattpm-'))
  const config = join(tmpDir1, 'platformatic.db.yml')
  await writeFile(config, 'TEST')
  equal(await findDBConfigFile(tmpDir1), 'platformatic.db.yml')
  equal(await findDBConfigFile(tmpDir2), undefined)
  await safeRemove(tmpDir1)
  await safeRemove(tmpDir2)
})

test('findServiceConfigFile', async () => {
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-wattpm-'))
  const tmpDir2 = await mkdtemp(join(tmpdir(), 'test-create-wattpm-'))
  const config = join(tmpDir1, 'platformatic.service.toml')
  await writeFile(config, 'TEST')
  equal(await findServiceConfigFile(tmpDir1), 'platformatic.service.toml')
  equal(await findServiceConfigFile(tmpDir2), undefined)
  await safeRemove(tmpDir1)
  await safeRemove(tmpDir2)
})

test('findGatewayConfigFile', async () => {
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-wattpm-'))
  const tmpDir2 = await mkdtemp(join(tmpdir(), 'test-create-wattpm-'))
  const config = join(tmpDir1, 'platformatic.gateway.yml')
  await writeFile(config, 'TEST')
  equal(await findGatewayConfigFile(tmpDir1), 'platformatic.gateway.yml')
  equal(await findGatewayConfigFile(tmpDir2), undefined)
  await safeRemove(tmpDir1)
  await safeRemove(tmpDir2)
})

test('findRuntimeConfigFile', async () => {
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-wattpm-'))
  const tmpDir2 = await mkdtemp(join(tmpdir(), 'test-create-wattpm-'))
  const config = join(tmpDir1, 'platformatic.runtime.yml')
  await writeFile(config, 'TEST')
  equal(await findRuntimeConfigFile(tmpDir1), 'platformatic.runtime.yml')
  equal(await findRuntimeConfigFile(tmpDir2), undefined)
  await safeRemove(tmpDir1)
  await safeRemove(tmpDir2)
})

test('isFileAccessible', async () => {
  const tmpDir1 = await mkdtemp(join(tmpdir(), 'test-create-wattpm-'))
  const config = join(tmpDir1, 'platformatic.db.yml')
  await writeFile(config, 'TEST')
  equal(await isFileAccessible(config), true)
  const config2 = join(tmpDir1, 'platformatic2.db.yml')
  equal(await isFileAccessible(config2), false)
  await safeRemove(tmpDir1)
})

test('should convert application name to env prefix', async () => {
  const expectations = {
    'my-application': 'MY_APPLICATION',
    a: 'A',
    MY_APPLICATION: 'MY_APPLICATION',
    asderas123: 'ASDERAS123'
  }

  Object.entries(expectations).forEach(exp => {
    const converted = convertApplicationNameToPrefix(exp[0])
    equal(exp[1], converted)
  })
})

test('should add prefix to a key/value object', async () => {
  const prefix = 'MY_PREFIX'
  const env = {
    PLT_HOSTNAME: 'myhost',
    PORT: '3042'
  }
  deepEqual(addPrefixToEnv(env, prefix), {
    MY_PREFIX_PLT_HOSTNAME: 'myhost',
    MY_PREFIX_PORT: '3042'
  })
})
