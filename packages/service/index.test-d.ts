import { expectType } from 'tsd';
import { FastifyInstance } from 'fastify';
import { buildServer } from '.';
import ConfigManager from '@platformatic/config';

const server = await buildServer({
})

expectType<FastifyInstance>(server);
expectType<ConfigManager>(server.platformatic.configManager);
expectType<Promise<void>>(server.restart());
