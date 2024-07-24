import { buildServer } from '@platformatic/db'
import { execa } from 'execa'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Start the DB server
const root = dirname(fileURLToPath(import.meta.url))
const app = await buildServer(
  resolve(root, 'e2e/fixtures/platformatic.e2e.db.json')
)
await app.start()

// Clean the generated code directory
const generatedCodeRoot = resolve(root, '../src/platformatic-generated-code')
await rm(generatedCodeRoot, { force: true, recursive: true })
await mkdir(generatedCodeRoot, { recursive: true })

// Generate the new code
process.chdir(generatedCodeRoot)
await execa('node', [
  resolve(root, '../../client-cli/cli.mjs'),
  'http://127.0.0.1:9999',
  '--frontend',
  '--language',
  'ts',
])

// Stop the server
await app.close()
