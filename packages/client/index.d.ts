import { type FastifyPluginCallback } from 'fastify'

export type PltClientOptions = {
  url: string;
  path?: string;
  headers?: object;
  throwOnError: boolean;
  fullResponse: boolean;
  type: 'openapi' | 'graphql';
  name?: string;
  serviceId?: string;
  getHeaders?: Function;
}

export const pltClient: FastifyPluginCallback<NonNullable<PltClientOptions>>
export default pltClient
