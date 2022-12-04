import pupa from 'pupa'
import { isFileAccessible } from './utils.mjs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const packageJsonTemplate = `\
{
  "name": "platformatic-db-api-example",
  "version": "0.0.1",
  "description": "Platformatic DB API",
  "scripts": {
    "start": "platformatic db start"
  },
  "devDependencies": {
    "fastify": "^{fastifyVersion}",
    "platformatic": "^{platVersion}"
  },
  "engines": {
    "node": ">=16"
  }
}`

export const createPackageJson = async (platVersion, fastifyVersion, logger, dir = '.') => {
  const packageJsonFileName = join(dir, 'package.json')
  const isPackageJsonExists = await isFileAccessible(packageJsonFileName)
  if (!isPackageJsonExists) {
    const packageJson = pupa(packageJsonTemplate, { platVersion, fastifyVersion })
    writeFileSync(packageJsonFileName, packageJson)
    logger.debug(`${packageJsonFileName} successfully created.`)
  } else {
    logger.debug(`${packageJsonFileName} found, skipping creation of package.json file.`)
  }
}
