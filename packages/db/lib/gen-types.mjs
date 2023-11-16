import { resolve, join, relative, basename, posix, parse } from 'path'
import { mkdir, writeFile, readFile, readdir, unlink } from 'fs/promises'
import { createRequire } from 'node:module'
import pino from 'pino'
import pretty from 'pino-pretty'
import camelcase from 'camelcase'
import { mapSQLEntityToJSONSchema, mapOpenAPItoTypes } from '@platformatic/sql-json-schema-mapper'
import { setupDB, isFileAccessible } from './utils.js'
import { loadConfig } from '@platformatic/config'
import { platformaticDB } from '../index.js'
import utils from '@platformatic/utils'

const checkForDependencies = utils.checkForDependencies

const DEFAULT_TYPES_FOLDER_PATH = resolve(process.cwd(), 'types')

const GLOBAL_TYPES_TEMPLATE = `\
import type { PlatformaticApp, PlatformaticDBMixin, PlatformaticDBConfig, Entity, Entities, EntityHooks } from '@platformatic/db'
ENTITIES_IMPORTS_PLACEHOLDER

interface AppEntities extends Entities {
  ENTITIES_DEFINITION_PLACEHOLDER
}

interface AppEntityHooks {
  HOOKS_DEFINITION_PLACEHOLDER
}

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticDBConfig> &
      PlatformaticDBMixin<AppEntities> &
      AppEntityHooks
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
  const fieldDefinitions = Object.fromEntries(Object.entries(entity.fields).map(([, value]) => [value.camelcase, value]))
  const tsCode = mapOpenAPItoTypes(jsonSchema, fieldDefinitions)
  entity.name = camelcase(entity.name).replace(/^\w/, c => c.toUpperCase())
  return tsCode + `\nexport { ${entity.name} };\n`
}

async function generateEntityGroupExport (entities) {
  const completeTypesImports = []
  const interfaceRows = []
  for (const name of entities) {
    completeTypesImports.push(`import { ${name} } from './${name}'`)
    interfaceRows.push(`${name}: ${name}`)
  }

  const content = `${completeTypesImports.join('\n')}
  
interface EntityTypes  {
  ${interfaceRows.join('\n    ')}
}
  
export { EntityTypes, ${entities.join(', ')} }`
  return content
}

async function generateGlobalTypes (entities, config) {
  const globalTypesImports = []
  const globalTypesInterface = []
  const globalHooks = []
  const completeTypesImports = []

  let typesRelativePath = relative(process.cwd(), getTypesFolderPath(config))
  {
    const parsedPath = parse(typesRelativePath)
    typesRelativePath = posix.format(parsedPath)
  }

  const schemaIdTypes = []
  const names = []
  const keys = Object.keys(entities).sort()
  for (const key of keys) {
    const { name, singularName } = entities[key]
    schemaIdTypes.push(name)
    completeTypesImports.push(`import { ${name} } from './${typesRelativePath}/${name}'`)
    globalTypesInterface.push(`${key}: Entity<${name}>,`)
    globalHooks.push(`addEntityHooks(entityName: '${singularName}', hooks: EntityHooks<${name}>): any`)
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
    .replace('HOOKS_DEFINITION_PLACEHOLDER', globalHooks.join('\n    '))
}

async function generateGlobalTypesFile (entities, config) {
  const globalTypes = await generateGlobalTypes(entities, config)

  const typesPath = getTypesFolderPath(config)
  const typesRelativePath = relative(typesPath, process.cwd())
  const fileNameOrThen = join(typesPath, typesRelativePath, 'global.d.ts')

  await writeFileIfChanged(fileNameOrThen, globalTypes)
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

async function execute ({ logger, config }) {
  const wrap = await setupDB(logger, config.db)
  const { db, entities } = wrap
  if (Object.keys(entities).length === 0) {
    // do not generate types if no schema is found
    return 0
  }
  const typesFolderPath = getTypesFolderPath(config)
  const isTypeFolderExists = await isFileAccessible(typesFolderPath)
  if (isTypeFolderExists) {
    await removeUnusedTypeFiles(entities, typesFolderPath)
  } else {
    await mkdir(typesFolderPath, { recursive: true })
  }

  let count = 0
  const entitiesValues = Object.values(entities)
  const entitiesNames = entitiesValues.map(({ name }) => name).sort()
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

  const { configManager, args } = await loadConfig({}, _args, platformaticDB)

  await configManager.parseAndValidate()
  const config = configManager.current

  const count = await execute({ logger, config })
  if (count === 0) {
    logger.warn('No entities found in your schema. Types were NOT generated.')
    logger.warn('Please run `platformatic db migrations apply` to generate types.')
  }
  await checkForDependencies(logger, args, createRequire(import.meta.url), config, ['@platformatic/db'])
}

export { execute, generateTypes, generateGlobalTypesFile }
