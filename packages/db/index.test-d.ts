import { buildServer } from ".";
import ConfigManager from "@platformatic/config"
import type { Database } from "@platformatic/sql-mapper";
import type { PlatformaticApp } from "@platformatic/types";
import { SQL } from "@databases/sql";
import { expectType } from 'tsd'
import { OpenAPI } from 'openapi-types'
import type { MercuriusPlugin } from 'mercurius'

async function main () {
  // TODO this configuration is incomplete, type it fully
  const server = await buildServer({
    server: {
      port: 3042,
      host: '127.0.0.1'
    }
  });

  expectType<PlatformaticApp>(server.platformatic);
  expectType<Database>(server.platformatic.db);
  expectType<SQL>(server.platformatic.sql);
  expectType<ConfigManager>(server.platformatic.configManager);
  expectType<OpenAPI.Document>(server.swagger());
  expectType<MercuriusPlugin>(server.graphql);
}
