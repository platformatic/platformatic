import fp from 'fastify-plugin'
import { sandboxWrapper } from './sandbox-wrapper.js'

async function loadPluginsPlugin (app, context) {
  const config = app.platformatic.config

  await app.register(sandboxWrapper, { packages: config.plugins.packages, paths: config.plugins.paths })
}

export const loadPlugins = fp(loadPluginsPlugin)
