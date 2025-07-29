import compiler from '@platformatic/ts-compiler'
import { kMetadata } from '@platformatic/utils'
import fp from 'fastify-plugin'

async function setupTsCompilerPlugin (app, context) {
  const config = app.platformatic.config

  await compiler.compile({
    tsConfig: config.plugins?.typescript?.tsConfig,
    flags: config.plugins?.typescript?.flags,
    cwd: context?.directory ?? config[kMetadata].root,
    clean: false,
    logger: app.log
  })
}

export const setupTsCompiler = fp(setupTsCompilerPlugin)
