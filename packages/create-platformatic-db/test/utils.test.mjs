import { test, beforeEach } from 'tap'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { getVersion, randomBetween, sleep, validatePath } from '../src/utils.mjs'
import esmock from 'esmock'

let mockAgent

beforeEach(() => {
  mockAgent = new MockAgent()
  setGlobalDispatcher(mockAgent)
  mockAgent.disableNetConnect()
})

test('getUsername from git', async ({ end, equal }) => {
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

test('getUsername from whoami', async ({ end, equal }) => {
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

test('getUsername - no username found', async ({ end, equal }) => {
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

test('Get the version', async ({ end, equal, mock }) => {
  const client = mockAgent.get('https://registry.npmjs.org')
  const version = 'v1.2.3'

  client
    .intercept({
      path: '/platformatic/latest',
      method: 'GET'
    })
    .reply(200, {
      version
    })
  const versionFromNPM = await getVersion()
  equal(versionFromNPM, version)
})

test('Get the version as `null` if something goes wrong ', async ({ end, equal, mock }) => {
  const client = mockAgent.get('https://registry.npmjs.org')
  const version = 'v1.2.3'
  client
    .intercept({
      path: '/platformatic/latest',
      method: 'GET'
    })
    .reply(500, {
      version
    })
  const versionFromNPM = await getVersion()
  equal(versionFromNPM, null)
})

test('Get the version as `null` if body has no version', async ({ end, equal, mock }) => {
  const client = mockAgent.get('https://registry.npmjs.org')
  client
    .intercept({
      path: '/platformatic/latest',
      method: 'GET'
    })
    .reply(200, null)
  const versionFromNPM = await getVersion()
  equal(versionFromNPM, null)
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

test('validatePath', async ({ end, equal, rejects }) => {
  const ok = await validatePath('new-project')
  equal(ok, true)
  rejects(validatePath('test'), Error('Please, specify an empty directory or create a new one.'))
})
