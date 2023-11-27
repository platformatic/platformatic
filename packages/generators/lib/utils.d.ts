type Env = {
  [key: string]: string
}

export namespace GeneratorUtils {
  export function safeMkdir(dir: string): Promise<void>
  export function stripVersion(version: string): string
  export function convertServiceNameToPrefix(serviceName: string): string
  export function addPrefixToEnv(env: Env, prefix: string): Env
  export function envObjectToString(env: Env): string
  export function extractEnvVariablesFromText(text: string): string[]
}
