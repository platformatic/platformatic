import { FastifyError } from '@fastify/error'

declare module '@platformatic/client-cli' {
  export function command(argv: string[]): Promise<void>
}

/**
 * All the errors thrown by the plugin.
 */
export module errors {
  export const UknonwnTypeError: (type: string) => FastifyError
  export const TypeNotSupportedError: (type: string) => FastifyError
}

