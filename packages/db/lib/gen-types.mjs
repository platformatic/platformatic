import { resolve, join, dirname, relative, basename, posix, parse } from 'path'
import { createRequire } from 'module'
import { mkdir, writeFile, readFile, readdir, unlink } from 'fs/promises'
import { join as desmJoin } from 'desm'
import pino from 'pino'
import pretty from 'pino-pretty'
import camelcase from 'camelcase'
import dtsgenerator, { parseSchema } from 'dtsgenerator'
import { mapSQLEntityToJSONSchema } from '@platformatic/sql-json-schema-mapper'
import { setupDB, isFileAccessible } from './utils.js'
import loadConfig from './load-config.mjs'

const DEFAULT_TYPES_FOLDER_PATH = resolve(process.cwd(), 'types')

const GLOBAL_TYPES_TEMPLATE = `\
import { Entity } from '@platformatic/sql-mapper';
ENTITIES_IMPORTS_PLACEHOLDER

declare module '@platformatic/sql-mapper' {
  interface Entities {
    ENTITIES_DEFINITION_PLACEHOLDER
  }
}
`

async function removeUnusedTypeFiles (entities, dir) {
  const entityTypes = await readdir(dir)
  const entityNames = Object.values(entities).map((entity) => entity.name)
  const removedEntityNames = entityTypes.filter((file) => !entityNames.includes(basename(file, '.d.ts')))
  await Promise.all(removedEntityNames.map((file) => unlink(join(dir, file))))
}

function getTypesFolderPath (config) {
  if (config.types?.dir) {
    return resolve(process.cwd(), config.types.dir)
  }
  return DEFAULT_TYPES_FOLDER_PATH
}

async function generateEntityType (entity) {
  const jsonSchema = mapSQLEntityToJSONSchema(entity)
  jsonSchema.id = jsonSchema.$id

  const tsCode = await dtsgenerator.default({ contents: [parseSchema(jsonSchema)] })
  entity.name = camelcase(entity.name).replace(/^\w/, c => c.toUpperCase())
  return tsCode + `\nexport { ${entity.name} };\n`
}

async function generateEntityGroupExport (entities) {
  const completeTypesImports = []
  const interfaceRows = []
  for (const name of entities) {
    completeTypesImports.push(`import { ${name} } from './${name}'`)
    interfaceRows.push(`${name}:${name}`)
  }

  const content = `${completeTypesImports.join('\n')}
  
  interface EntityTypes  {
    ${interfaceRows.join('\n    ')}
  }
  
  export { EntityTypes ,${entities.join(',')} }`
  return content
}

async function generateGlobalTypes (entities, config) {
  const globalTypesImports = []
  const globalTypesInterface = []
  const completeTypesImports = []

  if (config.core.graphql) {
    globalTypesImports.push('import graphqlPlugin from \'@platformatic/sql-graphql\'')
  }

  let typesRelativePath = relative(process.cwd(), getTypesFolderPath(config))
  {
    const parsedPath = parse(typesRelativePath)
    typesRelativePath = posix.format(parsedPath) 
  }

  const schemaIdTypes = []
  const names = []
  for (const [key, { name }] of Object.entries(entities)) {
    schemaIdTypes.push(name)
    completeTypesImports.push(`import { ${name} } from './${typesRelativePath}/${name}'`)
    globalTypesInterface.push(`${key}: Entity<${name}>,`)
    names.push(name)
  }
  globalTypesImports.push(`import { EntityTypes, ${names.join(',')} } from './${typesRelativePath}'`)

  const schemaIdType = schemaIdTypes.length === 0 ? 'string' : schemaIdTypes.map(type => `'${type}'`).join(' | ')

  globalTypesImports.push(`
declare module 'fastify' {
  interface FastifyInstance {
    getSchema<T extends ${schemaIdType}>(schemaId: T): {
      '$id': string,
      title: string,
      description: string,
      type: string,
      properties: {
        [x in keyof EntityTypes[T]]: { type: string, nullable?: boolean }
      },
      required: string[]
    };
  }
}`)

  return GLOBAL_TYPES_TEMPLATE
    .replace('ENTITIES_IMPORTS_PLACEHOLDER', globalTypesImports.join('\n'))
    .replace('ENTITIES_DEFINITION_PLACEHOLDER', globalTypesInterface.join('\n    '))
}

async function generateGlobalTypesFile (entities, config) {
  const globalTypes = await generateGlobalTypes(entities, config)

  const typesPath = getTypesFolderPath(config)
  const typesRelativePath = relative(typesPath, process.cwd())
  const fileNameOrThen = join(typesPath, typesRelativePath, 'global.d.ts')

  await writeFileIfChanged(fileNameOrThen, globalTypes)
}

async function getDependencyVersion (dependencyName) {
  const require = createRequire(import.meta.url)
  const pathToPackageJson = join(dirname(require.resolve(dependencyName)), 'package.json')
  const packageJsonFile = await readFile(pathToPackageJson, 'utf-8')
  const packageJson = JSON.parse(packageJsonFile)
  return packageJson.version
}

async function getPlatformaticPackageVersion (packageFolderName) {
  const pathToPackageJson = desmJoin(import.meta.url, '..', '..', packageFolderName, 'package.json')
  const packageJsonFile = await readFile(pathToPackageJson, 'utf-8')
  const packageJson = JSON.parse(packageJsonFile)
  return packageJson.version
}

function hasDependency (packageJson, dependencyName) {
  const dependencies = packageJson.dependencies || {}
  const devDependencies = packageJson.devDependencies || {}

  return dependencies[dependencyName] !== undefined ||
    devDependencies[dependencyName] !== undefined
}

async function checkForDependencies (logger, args, config) {
  const requiredDependencies = {}
  requiredDependencies.fastify = await getDependencyVersion('fastify')
  requiredDependencies['@platformatic/sql-mapper'] = await getPlatformaticPackageVersion('sql-mapper')

  if (config.core.graphql) {
    requiredDependencies['@platformatic/sql-graphql'] = await getPlatformaticPackageVersion('sql-graphql')
  }

  const packageJsonPath = resolve(process.cwd(), 'package.json')
  const isPackageJsonExists = await isFileAccessible(packageJsonPath)

  if (isPackageJsonExists) {
    const packageJsonFile = await readFile(packageJsonPath, 'utf-8')
    const packageJson = JSON.parse(packageJsonFile)

    let allRequiredDependenciesInstalled = true
    for (const dependencyName in requiredDependencies) {
      if (!hasDependency(packageJson, dependencyName)) {
        allRequiredDependenciesInstalled = false
        break
      }
    }

    if (allRequiredDependenciesInstalled) return
  }

  let command = 'npm i --save'

  if (config.plugin?.typescript !== undefined) {
    command += ' @types/node'
  }
  for (const [depName, depVersion] of Object.entries(requiredDependencies)) {
    command += ` ${depName}@${depVersion}`
  }
  logger.warn(`Please run \`${command}\` to install types dependencies.`)
}

async function writeFileIfChanged (filename, content) {
  const isFileExists = await isFileAccessible(filename)
  if (isFileExists) {
    const fileContent = await readFile(filename, 'utf-8')
    if (fileContent === content) return false
  }
  await writeFile(filename, content)
  return true
}

async function execute (logger, _, config) {
  const { db, entities } = await setupDB(logger, config.core)

  const typesFolderPath = getTypesFolderPath(config)
  const isTypeFolderExists = await isFileAccessible(typesFolderPath)
  if (isTypeFolderExists) {
    await removeUnusedTypeFiles(entities, typesFolderPath)
  } else {
    await mkdir(typesFolderPath, { recursive: true })
  }

  let count = 0
  const entitiesValues = Object.values(entities)
  const entitiesNames = entitiesValues.map(({ name }) => name)
  for (const entity of entitiesValues) {
    count++
    const types = await generateEntityType(entity)

    const pathToFile = join(typesFolderPath, entity.name + '.d.ts')
    const isTypeChanged = await writeFileIfChanged(pathToFile, types)

    if (isTypeChanged) {
      logger.info(`Generated type for ${entity.name} entity.`)
    }
  }
  const pathToFile = join(typesFolderPath, 'index.d.ts')
  // maybe better to check here for changes
  const content = await generateEntityGroupExport(entitiesNames)
  const isTypeChanged = await writeFileIfChanged(pathToFile, content)
  if (isTypeChanged) {
    logger.info('Regenerating global.d.ts')
  }
  await generateGlobalTypesFile(entities, config)
  await db.dispose()
  return count
}

async function generateTypes (_args) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const { configManager, args } = await loadConfig({}, _args)

  await configManager.parseAndValidate()
  const config = configManager.current

  const count = await execute(logger, args, config)
  if (count === 0) {
    logger.warn('No table found. Please run `platformatic db migrations apply` to generate types.')
  }
  await checkForDependencies(logger, args, config)
}

export { execute, generateTypes, generateGlobalTypesFile, checkForDependencies }
