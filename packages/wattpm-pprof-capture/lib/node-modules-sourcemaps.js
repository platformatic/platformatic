import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import * as sourceMap from 'source-map'

const MAP_EXT = '.map'
const MAP_FILE_PATTERN = /\.[cm]?js\.map$/

/**
 * Check if an error is a non-fatal filesystem error that should be silently ignored.
 */
function isNonFatalError (error) {
  const nonFatalErrors = ['ENOENT', 'EPERM', 'EACCES', 'ELOOP']
  return error instanceof Error && error.code && nonFatalErrors.includes(error.code)
}

/**
 * Async generator that recursively walks a directory looking for .map files.
 * Similar to @datadog/pprof's walk function but without the node_modules exclusion.
 */
async function * walkForMapFiles (dir) {
  async function * walkRecursive (currentDir) {
    try {
      const dirHandle = await fs.opendir(currentDir)
      for await (const entry of dirHandle) {
        const entryPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
          // Skip .git directories but NOT node_modules (unlike @datadog/pprof)
          if (entry.name !== '.git') {
            yield * walkRecursive(entryPath)
          }
        } else if (entry.isFile() && MAP_FILE_PATTERN.test(entry.name)) {
          // Verify the file is readable
          try {
            await fs.access(entryPath, fs.constants.R_OK)
            yield entryPath
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch (error) {
      if (!isNonFatalError(error)) {
        throw error
      }
      // Silently ignore non-fatal errors (ENOENT, EPERM, etc.)
    }
  }
  yield * walkRecursive(dir)
}

/**
 * Process a single .map file and return the entry for the infoMap.
 * Returns { generatedPath, info } or null if processing fails.
 */
async function processSourceMapFile (mapPath, debug, logger) {
  if (!mapPath || !mapPath.endsWith(MAP_EXT)) {
    return null
  }

  mapPath = path.normalize(mapPath)

  let contents
  try {
    contents = await fs.readFile(mapPath, 'utf8')
  } catch (error) {
    if (debug && logger) {
      logger.debug({ mapPath, error: error.message }, 'Could not read source map file')
    }
    return null
  }

  let consumer
  try {
    consumer = await new sourceMap.SourceMapConsumer(contents)
  } catch (error) {
    if (debug && logger) {
      logger.debug({ mapPath, error: error.message }, 'Could not parse source map file')
    }
    return null
  }

  // Determine the generated file path
  // Same logic as @datadog/pprof: try consumer.file first, then basename without .map
  const dir = path.dirname(mapPath)
  const generatedPathCandidates = []

  if (consumer.file) {
    generatedPathCandidates.push(path.resolve(dir, consumer.file))
  }

  const samePath = path.resolve(dir, path.basename(mapPath, MAP_EXT))
  if (generatedPathCandidates.length === 0 || generatedPathCandidates[0] !== samePath) {
    generatedPathCandidates.push(samePath)
  }

  // Find the first candidate that exists
  for (const generatedPath of generatedPathCandidates) {
    try {
      await fs.access(generatedPath, fs.constants.F_OK)
      if (debug && logger) {
        logger.debug({ generatedPath, mapPath }, 'Loaded source map for node_modules file')
      }
      return {
        generatedPath,
        info: {
          mapFileDir: dir,
          mapConsumer: consumer
        }
      }
    } catch {
      if (debug && logger) {
        logger.debug({ generatedPath }, 'Generated path does not exist')
      }
    }
  }

  if (debug && logger) {
    logger.debug({ mapPath }, 'Unable to find generated file for source map')
  }
  return null
}

/**
 * Resolve a module path from the application directory.
 * Handles both regular and scoped packages (e.g., 'next' and '@next/next-server').
 */
function resolveModulePath (appPath, moduleName) {
  // Try using require.resolve from the app's context
  try {
    const require = createRequire(path.join(appPath, 'package.json'))
    const modulePath = require.resolve(moduleName)
    // Get the module's root directory
    // For regular packages: node_modules/next/dist/file.js -> node_modules/next
    // For scoped packages: node_modules/@next/next-server/dist/file.js -> node_modules/@next/next-server
    const nodeModulesIndex = modulePath.lastIndexOf('node_modules')
    if (nodeModulesIndex === -1) {
      return null
    }

    const afterNodeModules = modulePath.substring(nodeModulesIndex + 'node_modules'.length + 1)
    let moduleRoot
    if (moduleName.startsWith('@')) {
      // Scoped package: @scope/package
      const parts = afterNodeModules.split(path.sep)
      moduleRoot = path.join(modulePath.substring(0, nodeModulesIndex), 'node_modules', parts[0], parts[1])
    } else {
      // Regular package
      const parts = afterNodeModules.split(path.sep)
      moduleRoot = path.join(modulePath.substring(0, nodeModulesIndex), 'node_modules', parts[0])
    }

    return moduleRoot
  } catch {
    // Module not found, try walking up from appPath
  }

  // Fallback: walk up directory tree looking for node_modules
  let currentDir = appPath
  while (currentDir !== path.dirname(currentDir)) {
    const modulePath = path.join(currentDir, 'node_modules', moduleName)
    try {
      // Check if the module directory exists synchronously (we're in a sync context here)
      const stat = require('node:fs').statSync(modulePath)
      if (stat.isDirectory()) {
        return modulePath
      }
    } catch {
      // Not found, continue up
    }
    currentDir = path.dirname(currentDir)
  }

  return null
}

/**
 * Load source maps from specified node_modules packages.
 *
 * @param {string} appPath - The application root directory
 * @param {string[]} moduleNames - Array of module names to load sourcemaps from (e.g., ['next', '@next/next-server'])
 * @param {boolean} debug - Whether to enable debug logging
 * @returns {Promise<Map<string, {mapFileDir: string, mapConsumer: SourceMapConsumer}>>}
 */
export async function loadNodeModulesSourceMaps (appPath, moduleNames, debug = false) {
  const entries = new Map()
  const logger = globalThis.platformatic?.logger

  if (debug && logger) {
    logger.debug({ appPath, moduleNames }, 'Loading source maps from node_modules')
  }

  for (const moduleName of moduleNames) {
    const modulePath = resolveModulePath(appPath, moduleName)
    if (!modulePath) {
      if (logger) {
        logger.warn({ moduleName }, 'Could not resolve module path for sourcemap loading')
      }
      continue
    }

    if (debug && logger) {
      logger.debug({ moduleName, modulePath }, 'Scanning module for source maps')
    }

    let mapCount = 0
    try {
      for await (const mapFile of walkForMapFiles(modulePath)) {
        const entry = await processSourceMapFile(mapFile, debug, logger)
        if (entry) {
          entries.set(entry.generatedPath, entry.info)
          mapCount++
        }
      }
    } catch (error) {
      if (logger) {
        logger.warn({ moduleName, error: error.message }, 'Error scanning module for source maps')
      }
    }

    if (debug && logger) {
      logger.debug({ moduleName, mapCount }, 'Finished scanning module for source maps')
    }
  }

  if (debug && logger) {
    logger.debug({ totalMaps: entries.size }, 'Finished loading node_modules source maps')
  }

  return entries
}
