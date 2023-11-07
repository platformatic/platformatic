import { writeFile, readFile } from 'fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Creates a package.json template file
 * @param {boolean} addTSBuild Whether to add TS Build or not
 * @param {string} fastifyVersion Fastify Version
 * @param {string} platVersion Platformatic Version
 */
const packageJsonTemplate = async (addTSBuild, fastifyVersion, platVersion) => {
  const __dirname = fileURLToPath(new URL('.', import.meta.url))

  const pkg = {
    scripts: {
      start: 'platformatic start',
      test: 'node --test test/**'
    },
    devDependencies: {
      fastify: `^${fastifyVersion}`
    },
    dependencies: {
      platformatic: `^${platVersion}`
    },
    engines: {
      node: '^18.8.0 || >=20.6.0'
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
 * @param {boolean} addTSBuild Whether to add TS Build or not
 * @param {object} scripts Package.json scripts list
 * @param {object} dependencies Package.json dependencies list
 */
export const createPackageJson = async (platVersion, fastifyVersion, logger, dir, addTSBuild = false, scripts = {}, dependencies = {}, devDependencies = {}) => {
  const packageJsonFileName = join(dir, 'package.json')
  const pkg = await packageJsonTemplate(addTSBuild, fastifyVersion, platVersion)
  Object.assign(pkg.scripts, scripts)
  Object.assign(pkg.dependencies, dependencies)
  Object.assign(pkg.devDependencies, devDependencies)
  await writeFile(packageJsonFileName, JSON.stringify(pkg, null, 2))
  logger.debug(`${packageJsonFileName} successfully created.`)
}
