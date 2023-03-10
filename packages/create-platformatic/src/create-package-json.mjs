import pupa from 'pupa'
import { isFileAccessible } from './utils.mjs'
import { writeFile } from 'fs/promises'
import { join } from 'node:path'

const packageJsonTemplate = (addTSBuild = false) => (`\
{
  "scripts": {
    ${addTSBuild
? `"start": "npm run clean && platformatic {type} start",
    "clean": "rm -fr ./dist",
    "build": "npx tsc"`
: '"start": "platformatic {type} start"'}
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
}`)

export const createPackageJson = async (type, platVersion, fastifyVersion, logger, dir, addTSBuild = false) => {
  const packageJsonFileName = join(dir, 'package.json')
  const isPackageJsonExists = await isFileAccessible(packageJsonFileName)
  if (!isPackageJsonExists) {
    const packageJson = pupa(packageJsonTemplate(addTSBuild), { platVersion, fastifyVersion, type })
    await writeFile(packageJsonFileName, packageJson)
    logger.debug(`${packageJsonFileName} successfully created.`)
  } else {
    logger.debug(`${packageJsonFileName} found, skipping creation of package.json file.`)
  }
}
