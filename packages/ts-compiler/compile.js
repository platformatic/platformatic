'use strict'

const { join, dirname } = require('path')
const { readFile } = require('fs/promises')
const setup = require('./lib/setup')
const { safeRemove } = require('@platformatic/utils')

async function compile (options = {}) {
  const { execa, logger, tscExecutablePath, tsConfigPath, tsConfigExists } = await setup(options)

  if (tscExecutablePath === undefined) {
    const msg = 'The tsc executable was not found.'
    logger.warn(msg)
    return false
  }

  if (!tsConfigExists) {
    const msg = 'No typescript configuration file was found, skipping compilation.'
    logger.info(msg)
    return true
  }

  try {
    const tsFlags = options.flags || ['--project', tsConfigPath, '--rootDir', dirname(tsConfigPath)]
    const env = {
      ...process.env,
    }
    // Adding code coverage to the massive tsc executable will
    // slow things down massively. So we skip it
    delete env.NODE_V8_COVERAGE
    if (options && options.clean) {
      // delete outdir directory
      const tsConfigContents = JSON.parse(await readFile(tsConfigPath, 'utf8'))
      const outDir = tsConfigContents.compilerOptions.outDir
      if (outDir) {
        const outDirFullPath = join(dirname(tsConfigPath), outDir)
        logger.info(`Removing build directory ${outDirFullPath}`)
        await safeRemove(outDirFullPath)
      }
    }
    await execa(tscExecutablePath, tsFlags, { cwd: options.cwd, env })
    logger.info('Typescript compilation completed successfully.')
    return true
  } catch (error) {
    logger.error(error.message)
    return false
  }
}

module.exports.compile = compile
