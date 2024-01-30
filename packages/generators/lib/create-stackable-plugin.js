'use strict'

function getJsStackablePluginFile () {
  return `\
/// <reference path="../index.d.ts" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  const config = fastify.platformatic.config
  const greeting = config.greeting
  fastify.log.info({ greeting }, 'Loading stackable greeting plugin.')
  fastify.decorate('greeting', greeting)
}
`
}

function getTsStackablePluginFile () {
  return `\
/// <reference path="../index.d.ts" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  const config = fastify.platformatic.config
  const greeting = config.greeting
  fastify.log.info({ greeting }, 'Loading stackable greeting plugin.')
  fastify.decorate('greeting', greeting)
}
`
}

function generateStackablePlugins (typescript) {
  if (typescript) {
    return [{
      path: 'plugins',
      file: 'example.ts',
      contents: getTsStackablePluginFile()
    }]
  }
  return [{
    path: 'plugins',
    file: 'example.js',
    contents: getJsStackablePluginFile()
  }]
}

module.exports = {
  generateStackablePlugins
}
