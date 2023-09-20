interface KeyValue {
  [key: string]: string
}
interface ProcessOpenApiOptions {
  schema: object
  name: string
  fullResponse: boolean
  fullRequest: boolean
  optionalHeaders: KeyValue
  validateRespons: boolean

}

interface ProcessOpenAPIOutput {
  types: string,
  implementation: string
}

export function processOpenAPI(options: ProcessOpenApiOptions): ProcessOpenAPIOutput

export function antani(opts: string): boolean