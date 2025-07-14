import { kMetadata } from '@platformatic/utils'
import fp from 'fastify-plugin'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { getJSPluginPath, isFileAccessible } from '../utils.js'
import { sandboxWrapper } from './sandbox-wrapper.js'

async function loadPluginsPlugin (app, context) {
  const config = app.platformatic.config

  let isOutDirAccessible = false
  let outDir = null

  const workingDir = context?.directory ?? config[kMetadata].root
  const tsConfigPath = config.plugins.typescript?.tsConfig || join(workingDir, 'tsconfig.json')

  // If the tsconfig.json file exists, then we need to adjust the plugin paths
  // to point to the compiled JS files.
  const isTsConfigAccessible = await isFileAccessible(tsConfigPath)
  if (isTsConfigAccessible) {
    const tsConfig = JSON.parse(await readFile(tsConfigPath, 'utf8'))
    outDir = resolve(workingDir, tsConfig.compilerOptions.outDir)
  }

  /* c8 ignore next 3 */
  if (config.plugins.typescript?.outDir) {
    outDir = config.plugins.typescript.outDir
  }

  if (outDir) {
    isOutDirAccessible = await isFileAccessible(outDir)

    if (context?.isProduction && !isOutDirAccessible) {
      throw new Error(
        `Cannot access directory '${outDir}'. Please run the 'build' command before running in production mode.`
      )
    }
  }

  if (config.plugins.paths && isOutDirAccessible) {
    config.plugins.paths = config.plugins.paths.map(plugin => {
      /* c8 ignore next 3 */
      const tmp =
        typeof plugin === 'string'
          ? getJSPluginPath(workingDir, plugin, outDir)
          : { ...plugin, path: getJSPluginPath(workingDir, plugin.path, outDir) }
      return tmp
    })
  }

  await app.register(sandboxWrapper, { packages: config.plugins.packages, paths: config.plugins.paths })
}

export const loadPlugins = fp(loadPluginsPlugin)
