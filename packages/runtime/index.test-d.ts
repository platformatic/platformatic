import { expectError, expectType } from 'tsd';
import { LightMyRequestResponse } from 'fastify';
import { pltRuntimeBuildServer } from '.';

const server: pltRuntimeBuildServer = {
  address: 'localhost',
  port: 3000,
  restart: async () => {},
  stop: async () => {},
  inject: async () => ({} as LightMyRequestResponse),
};

expectType<pltRuntimeBuildServer>(server);
expectError<pltRuntimeBuildServer>({...server, address: 42 });
expectError<pltRuntimeBuildServer>({...server, port: 'WRONG' });
expectError<pltRuntimeBuildServer>({...server, restart: 'WRONG' });
expectError<pltRuntimeBuildServer>({...server, stop: 'WRONG' });
expectError<pltRuntimeBuildServer>({...server, inject: 'WRONG' });
