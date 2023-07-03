import pupa from 'pupa'
import { isFileAccessible } from './utils.mjs'
import { writeFile } from 'fs/promises'
import { join } from 'node:path'

const packageJsonTemplate = (addTSBuild = false) => (`\
{
  "scripts": {
    ${addTSBuild
? `"start": "npm run clean && platformatic start",
    "clean": "rm -fr ./dist",
    "build": "npx tsc"`
: '"start": "platformatic start"'}
  },
  "devDependencies": {
    "fastify": "^{fastifyVersion}"
  },
  "dependencies": {
    "platformatic": "^{platVersion}"
  },
  "engines": {
    "node": "^18.8.0 || >=19"
  }
}`)

/**
 * Creates a Platformatic app package.json file
 * @param {string} platVersion Platformatic Version
 * @param {string} fastifyVersion Fastify Version
 * @param {import('pino').BaseLogger} logger Logger Interface
 * @param {string} dir Target directory where to create the file
 * @param {boolean} addTSBuild Whether to add TS Build or not
 * @param {object} scripts Package.json scripts list
 */
export const createPackageJson = async (platVersion, fastifyVersion, logger, dir, addTSBuild = false, scripts = {}) => {
  const packageJsonFileName = join(dir, 'package.json')
  const isPackageJsonExists = await isFileAccessible(packageJsonFileName)
  if (!isPackageJsonExists) {
    const packageJson = pupa(packageJsonTemplate(addTSBuild), { platVersion, fastifyVersion })
    const parsed = JSON.parse(packageJson)
    Object.assign(parsed.scripts, scripts)
    await writeFile(packageJsonFileName, JSON.stringify(parsed, null, 2))
    logger.debug(`${packageJsonFileName} successfully created.`)
  } else {
    logger.debug(`${packageJsonFileName} found, skipping creation of package.json file.`)
  }
}
