
type Env = {
  [key: string]: string
}
async function safeMkdir(dir: string): Promise<void>
function stripVersion(version: string): string
function convertServiceNameToPrefix(serviceName: string): string
function addPrefixToEnv(env: Env, prefix: string): Env
function envObjectToString(env: Env): string
function extractEnvVariablesFromText(text: stirng): string[]
export {
  convertServiceNameToPrefix,
  extractEnvVariablesFromText,
  envObjectToString,
  addPrefixToEnv,
  safeMkdir,
  stripVersion
}