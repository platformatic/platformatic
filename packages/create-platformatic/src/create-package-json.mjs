import { isFileAccessible } from './utils.mjs'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageJsonTemplate = async (projectType, addTSBuild, fastifyVersion, platVersion) => {
  const __dirname = fileURLToPath(new URL('.', import.meta.url))

  const pkg = {
    scripts: {
      start: 'platformatic start'
    },
    devDependencies: {
      fastify: `^${fastifyVersion}`
    },
    dependencies: {
      platformatic: `^${platVersion}`
    },
    engines: {
      node: '^18.8.0'
    }
  }

  if (projectType === 'db') {
    pkg.dependencies = {
      ...pkg.dependencies,
      '@platformatic/db': `^${platVersion}`
    }
  }

  if (addTSBuild) {
    const typescriptVersion = JSON.parse(await readFile(join(__dirname, '..', 'package.json'), 'utf-8')).devDependencies.typescript
    pkg.scripts.clean = 'rm -fr ./dist'
    pkg.scripts.build = 'platformatic compile'
    pkg.devDependencies.typescript = typescriptVersion
  }

  return pkg
}

/**
 * Creates a Platformatic app package.json file
 * @param {string} platVersion Platformatic Version
 * @param {string} fastifyVersion Fastify Version
 * @param {import('pino').BaseLogger} logger Logger Interface
 * @param {string} dir Target directory where to create the file
 * @param {string} projectType Project Type (null, db, service, runtime, composer, etc)
 * @param {boolean} addTSBuild Whether to add TS Build or not
 * @param {object}dependencies (db, service, etc)
 * @param {boolean} addTSBuild Whether to add TS Build or not
 * @param {object} scripts Package.json scripts list
 */
export const createPackageJson = async (platVersion, fastifyVersion, logger, dir, projectType = null, addTSBuild = false, scripts = {}) => {
  const packageJsonFileName = join(dir, 'package.json')
  const isPackageJsonExists = await isFileAccessible(packageJsonFileName)
  if (!isPackageJsonExists) {
    const pkg = await packageJsonTemplate(projectType, addTSBuild, fastifyVersion, platVersion)
    Object.assign(pkg.scripts, scripts)
    await writeFile(packageJsonFileName, JSON.stringify(pkg, null, 2))
    logger.debug(`${packageJsonFileName} successfully created.`)
  } else {
    logger.debug(`${packageJsonFileName} found, skipping creation of package.json file.`)
  }
}
