import { create } from '@platformatic/db'
import { createDirectory } from '@platformatic/utils'
import { execa } from 'execa'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Start the DB server
const root = dirname(fileURLToPath(import.meta.url))
const app = await create(resolve(root, 'e2e/fixtures/platformatic.e2e.db.json'))
await app.start()

// Clean the generated code directory
const generatedCodeRoot = resolve(root, '../src/platformatic-generated-code')
await createDirectory(generatedCodeRoot, true)

// Generate the new code
process.chdir(generatedCodeRoot)
await execa('node', [
  resolve(root, '../../client-cli/cli.mjs'),
  'http://127.0.0.1:9999',
  '--frontend',
  '--language',
  'ts'
])

// Stop the server
await app.close()
