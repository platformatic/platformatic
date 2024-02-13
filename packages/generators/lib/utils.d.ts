type Env = {
  [key: string]: string
}

export type PackageConfiguration = {
  type: 'number' | 'string' | 'boolean' | 'path'
  path: string
  value: number | string | boolean
}

export namespace GeneratorUtils {
  export function safeMkdir(dir: string): Promise<void>
  export function stripVersion(version: string): string
  export function convertServiceNameToPrefix(serviceName: string): string
  export function envObjectToString(env: Env): string
  export function extractEnvVariablesFromText(text: string): string[]
  export function getPackageConfigurationObject(config: PackageConfiguration[]): object
  export const PLT_ROOT: string
}
