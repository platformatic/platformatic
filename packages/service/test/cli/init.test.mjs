import path from 'path'
import fs from 'fs/promises'
import { tmpdir } from 'os'
import t from 'tap'
import { execa } from 'execa'
import { cliPath } from './helper.mjs'

const examplePlugin = `\
'use strict'

/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.decorate('example', 'foobar')
}

module.exports[Symbol.for('skip-override')] = true
`

const rootPlugin = `\
'use strict'

/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/', async (request, reply) => {
    return { hello: app.example }
  })
}
`

t.jobs = 10

t.test('run db init with default options', async (t) => {
  const pathToFolder = await fs.mkdtemp(path.join(tmpdir(), 'init-1'))
  const pathToConfigFile = path.join(pathToFolder, 'platformatic.service.json')
  const pathToPluginsFolder = path.join(pathToFolder, 'plugins')
  const pathToPluginFile = path.join(pathToPluginsFolder, 'example.js')
  const pathToRoutesFolder = path.join(pathToFolder, 'routes')
  const pathToRoutesFile = path.join(pathToRoutesFolder, 'root.js')

  await execa('node', [cliPath, 'init'], { cwd: pathToFolder })

  const serviceConfigFile = await fs.readFile(pathToConfigFile, 'utf8')
  const serviceConfig = JSON.parse(serviceConfigFile)

  const { server, plugin } = serviceConfig

  t.equal(server.hostname, '127.0.0.1')
  t.equal(server.port, 3042)

  t.same(plugin, ['./plugins', './routes'])

  t.equal(await fs.readFile(pathToPluginFile, 'utf8'), examplePlugin)
  t.equal(await fs.readFile(pathToRoutesFile, 'utf8'), rootPlugin)

  // Running it again should succeed
  await execa('node', [cliPath, 'init'], { cwd: pathToFolder })
})
