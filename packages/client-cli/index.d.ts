import { FastifyError } from '@fastify/error'

declare namespace clientcli {
  /**
   * The available function you can call from the cli.
   */
  export function command(argv: string[]): Promise<void>
  
  /**
   * All the errors thrown by the plugin.
   */
  export module errors {
    export const UnknownTypeError: (type: string) => FastifyError
    export const TypeNotSupportedError: (type: string) => FastifyError
  }
}

export = clientcli
