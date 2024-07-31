type Env = {
  [key: string]: string
}

export type PackageConfiguration = {
  type: 'number' | 'string' | 'boolean' | 'path'
  path: string
  value: number | string | boolean
}

export namespace GeneratorUtils {
  export function stripVersion (version: string): string
  export function convertServiceNameToPrefix (serviceName: string): string
  export function envObjectToString (env: Env): string
  export function envStringToObject (env: string): Env
  export function extractEnvVariablesFromText (text: string): string[]
  export function getPackageConfigurationObject (config: PackageConfiguration[]): object
  export function flattenObject (obj: object): object
  export function getServiceTemplateFromSchemaUrl (schemaUrl: string): string
  export const PLT_ROOT: string
}
