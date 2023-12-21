'use strict'

const { tap, spec } = require('node:test/reporters')
const { run } = require('node:test')
const { join } = require('node:path')
const glob = require('glob').globSync

/* eslint-disable new-cap */
const reporter = process.stdout.isTTY ? new spec() : tap

const files = [
  ...glob('**/*.test.{js,mjs}', { cwd: __dirname }),
  ...glob('**/*.test.{js,mjs}', { cwd: __dirname })
].map(file => join(__dirname, file))

const stream = run({
  files,
  concurrency: 1,
  timeout: 2 * 60 * 1000
})

stream.on('test:fail', () => {
  process.exitCode = 1
})

stream.compose(reporter).pipe(process.stdout)
