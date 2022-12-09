import pupa from 'pupa'
import { isFileAccessible } from './utils.mjs'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const packageJsonTemplate = `\
{
  "scripts": {
    "start": "platformatic {type} start"
  },
  "devDependencies": {
    "fastify": "^{fastifyVersion}"
  },
  "dependencies": {
    "platformatic": "^{platVersion}"
  },
  "engines": {
    "node": "^16.17.0 || ^18.8.0 || >=19"
  }
}`

export const createPackageJson = async (type, platVersion, fastifyVersion, logger, dir = '.') => {
  const packageJsonFileName = join(dir, 'package.json')
  const isPackageJsonExists = await isFileAccessible(packageJsonFileName)
  if (!isPackageJsonExists) {
    const packageJson = pupa(packageJsonTemplate, { platVersion, fastifyVersion, type })
    writeFileSync(packageJsonFileName, packageJson)
    logger.debug(`${packageJsonFileName} successfully created.`)
  } else {
    logger.debug(`${packageJsonFileName} found, skipping creation of package.json file.`)
  }
}
