import { expectError, expectType } from 'tsd';
import {
  FastifyInstance,
  LightMyRequestResponse,
} from 'fastify';
import { pltServiceHandlerBuildServer } from '.';

const server: pltServiceHandlerBuildServer = {
  app: {} as FastifyInstance,
  address: 'localhost',
  port: 3000,
  restart: async () => {},
  listen: async () => ({ address: 'localhost', port: 3000 }),
  stop: async () => {},
  inject: async () => ({} as LightMyRequestResponse),
};

expectType<pltServiceHandlerBuildServer>(server);
expectError<pltServiceHandlerBuildServer>({...server, app: 'WRONG' });
expectError<pltServiceHandlerBuildServer>({...server, address: 42 });
expectError<pltServiceHandlerBuildServer>({...server, port: 'WRONG' });
expectError<pltServiceHandlerBuildServer>({...server, restart: 'WRONG' });
expectError<pltServiceHandlerBuildServer>({...server, listen: 'WRONG' });
expectError<pltServiceHandlerBuildServer>({...server, listen: async () => ({ address: 42, port: 3000 }), });
expectError<pltServiceHandlerBuildServer>({...server, listen: async () => ({ address: 'localhost', port: 'WRONG' }), });
expectError<pltServiceHandlerBuildServer>({...server, stop: 'WRONG' });
expectError<pltServiceHandlerBuildServer>({...server, inject: 'WRONG' });
