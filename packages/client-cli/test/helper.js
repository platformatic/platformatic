'use strict'

const { setGlobalDispatcher, Agent, request } = require('undici')
const fs = require('fs/promises')
const { tmpdir } = require('os')
const fastify = require('fastify')
const { join } = require('path')

setGlobalDispatcher(new Agent({
  keepAliveMaxTimeout: 1,
  keepAliveTimeout: 1
}))

module.exports.request = request

let counter = 0

async function moveToTmpdir (teardown) {
  const cwd = process.cwd()
  const dir = join(tmpdir(), `platformatic-client-${process.pid}-${Date.now()}-${counter++}`)
  await fs.mkdir(dir)
  process.chdir(dir)
  teardown(() => process.chdir(cwd))
  teardown(() => fs.rm(dir, { recursive: true }).catch(() => {}))
  return dir
}

module.exports.moveToTmpdir = moveToTmpdir

async function installDeps (dir) {
  const { execa } = await import('execa')
  await fs.writeFile(join(dir, 'package.json'), JSON.stringify({}, null, 2))
  await execa('pnpm', ['add', `fastify@${fastify().version}`, 'fastify-tsconfig'])
  await execa('pnpm', ['link', join(__dirname, '..', '..', 'client')])
}

module.exports.installDeps = installDeps
