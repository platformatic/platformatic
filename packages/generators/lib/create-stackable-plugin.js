'use strict'

const JS_PLUGIN_WITH_TYPES_SUPPORT = `\
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

const TS_PLUGIN_WITH_TYPES_SUPPORT = `\
/// <reference path="../index.d.ts" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  const config = fastify.platformatic.config
  const greeting = config.greeting
  fastify.log.info({ greeting }, 'Loading stackable greeting plugin.')
  fastify.decorate('greeting', greeting)
}
`

function generateStackablePlugins (typescript) {
  if (typescript) {
    return [{
      path: 'plugins',
      file: 'example.ts',
      contents: TS_PLUGIN_WITH_TYPES_SUPPORT
    }]
  }
  return [{
    path: 'plugins',
    file: 'example.js',
    contents: JS_PLUGIN_WITH_TYPES_SUPPORT
  }]
}

module.exports = {
  generateStackablePlugins
}
