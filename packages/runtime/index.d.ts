import { InjectOptions, LightMyRequestResponse } from 'fastify'
import { FastifyError } from '@fastify/error'

export type pltRuntimeBuildServer = {
  address: string
  port: number
  restart: () => Promise<void>
  stop: () => Promise<void>
  inject: (opts: InjectOptions | string) => Promise<LightMyRequestResponse>
}

declare module '@platformatic/runtime' {
  export function buildServer(opts: object): Promise<pltRuntimeBuildServer>
}

/**
 * All the errors thrown by the plugin.
 */
export module errors {
  export const RuntimeExitedError: () => FastifyError
  export const UnknownRuntimeAPICommandError: (command: string) => FastifyError
  export const ServiceNotFoundError: (id: string) => FastifyError
  export const ServiceNotStartedError: (id: string) => FastifyError
  export const FailedToRetrieveOpenAPISchemaError: (id: string, error: string) => FastifyError
  export const ApplicationAlreadyStartedError: () => FastifyError
  export const ApplicationNotStartedError: () => FastifyError
  export const ConfigPathMustBeStringError: () => FastifyError
  export const NoConfigFileFoundError: (id: string) => FastifyError
  export const InvalidEntrypointError: (entrypoint: string) => FastifyError
  export const MissingDependencyError: (dependency: string) => FastifyError
  export const InspectAndInspectBrkError: () => FastifyError
  export const InspectorPortError: () => FastifyError
  export const InspectorHostError: () => FastifyError
  export const CannotMapSpecifierToAbsolutePathError: (specifier: string) => FastifyError
  export const NodeInspectorFlagsNotSupportedError: () => FastifyError
}

