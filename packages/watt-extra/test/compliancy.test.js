
import { readFileSync } from 'node:fs'
import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import { randomUUID } from 'node:crypto'
import { start } from '../index.js'
import {
  setUpEnvironment,
  startICC,
  installDeps
} from './helper.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const platformaticVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

test('should retrieve and send compliancy metadata', async (t) => {
  const applicationName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'service-1')

  await installDeps(t, applicationPath, null, [
    { name: '@foo/bar-1', version: '1.2.3' }
  ])

  const receivedMetadata = []

  const icc = await startICC(t, {
    applicationId,
    saveComplianceMetadata: async (applicationId, data) => {
      receivedMetadata.push({ applicationId, data })
    },
    getComplianceReport: async () => {
      return { compliant: true }
    }
  })

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
    PLT_DISABLE_COMPLIANCE_CHECK: false
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  assert.strictEqual(receivedMetadata.length, 1)

  const [metadata] = receivedMetadata
  assert.strictEqual(metadata.applicationId, applicationId)
  assert.deepStrictEqual(metadata.data, {
    npmDependencies: {
      runtime: {
        current: {
          '@platformatic/runtime': platformaticVersion,
          '@foo/bar-1': '1.2.3'
        },
        dependencies: {
          '@platformatic/runtime': '^2.58.0',
          '@foo/bar-1': '^1.0.0',
          missing: '^1.33.3'
        }
      },
      services: {
        main: {
          current: {
            '@platformatic/runtime': platformaticVersion,
            '@foo/bar-1': '1.2.3'
          },
          dependencies: {
            '@platformatic/runtime': '^2.58.0',
            '@foo/bar-1': '^1.0.0',
            missing: '^1.33.3'
          }
        }
      }
    }
  })
})
