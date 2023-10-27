import { tap, spec } from 'node:test/reporters'
import { run } from 'node:test'
import { join } from 'desm'
import { globSync } from 'glob'

/* eslint-disable new-cap */
const reporter = process.stdout.isTTY ? new spec() : tap

const files = [
  ...globSync(join(import.meta.url, '*.test.js'))
]

run({
  files,
  concurrency: 1,
  timeout: 30000
}).compose(reporter).pipe(process.stdout)
