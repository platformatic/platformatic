'use strict'

const { AmqplibInstrumentation } = require('@opentelemetry/instrumentation-amqplib')
const { AwsLambdaInstrumentation } = require('@opentelemetry/instrumentation-aws-lambda')
const { AwsInstrumentation } = require('@opentelemetry/instrumentation-aws-sdk')
const { BunyanInstrumentation } = require('@opentelemetry/instrumentation-bunyan')
const { CassandraDriverInstrumentation } = require('@opentelemetry/instrumentation-cassandra-driver')
const { ConnectInstrumentation } = require('@opentelemetry/instrumentation-connect')
const { CucumberInstrumentation } = require('@opentelemetry/instrumentation-cucumber')
const { DataloaderInstrumentation } = require('@opentelemetry/instrumentation-dataloader')
const { DnsInstrumentation } = require('@opentelemetry/instrumentation-dns')
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express')
const { FastifyInstrumentation } = require('@opentelemetry/instrumentation-fastify')
const { FsInstrumentation } = require('@opentelemetry/instrumentation-fs')
const { GenericPoolInstrumentation } = require('@opentelemetry/instrumentation-generic-pool')
const { GraphQLInstrumentation } = require('@opentelemetry/instrumentation-graphql')
const { GrpcInstrumentation } = require('@opentelemetry/instrumentation-grpc')
const { HapiInstrumentation } = require('@opentelemetry/instrumentation-hapi')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { IORedisInstrumentation } = require('@opentelemetry/instrumentation-ioredis')
const { KafkaJsInstrumentation } = require('@opentelemetry/instrumentation-kafkajs')
const { KnexInstrumentation } = require('@opentelemetry/instrumentation-knex')
const { KoaInstrumentation } = require('@opentelemetry/instrumentation-koa')
const { LruMemoizerInstrumentation } = require('@opentelemetry/instrumentation-lru-memoizer')
const { MemcachedInstrumentation } = require('@opentelemetry/instrumentation-memcached')
const { MongoDBInstrumentation } = require('@opentelemetry/instrumentation-mongodb')
const { MongooseInstrumentation } = require('@opentelemetry/instrumentation-mongoose')
const { MySQL2Instrumentation } = require('@opentelemetry/instrumentation-mysql2')
const { MySQLInstrumentation } = require('@opentelemetry/instrumentation-mysql')
const { NestInstrumentation } = require('@opentelemetry/instrumentation-nestjs-core')
const { NetInstrumentation } = require('@opentelemetry/instrumentation-net')
const { PgInstrumentation } = require('@opentelemetry/instrumentation-pg')
const { PinoInstrumentation } = require('@opentelemetry/instrumentation-pino')
const { RedisInstrumentation: RedisInstrumentationV2 } = require('@opentelemetry/instrumentation-redis')
const { RedisInstrumentation: RedisInstrumentationV4 } = require('@opentelemetry/instrumentation-redis-4')
const { RestifyInstrumentation } = require('@opentelemetry/instrumentation-restify')
const { RouterInstrumentation } = require('@opentelemetry/instrumentation-router')
const { SocketIoInstrumentation } = require('@opentelemetry/instrumentation-socket.io')
const { TediousInstrumentation } = require('@opentelemetry/instrumentation-tedious')
const { UndiciInstrumentation } = require('@opentelemetry/instrumentation-undici')
const { WinstonInstrumentation } = require('@opentelemetry/instrumentation-winston')

// This list is from: 'https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/metapackages/auto-instrumentations-node/src/utils.ts#L96
const InstrumentationMap = {
  amqplib: AmqplibInstrumentation,
  'aws-lambda': AwsLambdaInstrumentation,
  'aws-sdk': AwsInstrumentation,
  bunyan: BunyanInstrumentation,
  'cassandra-driver': CassandraDriverInstrumentation,
  connect: ConnectInstrumentation,
  cucumber: CucumberInstrumentation,
  dataloader: DataloaderInstrumentation,
  dns: DnsInstrumentation,
  express: ExpressInstrumentation,
  fastify: FastifyInstrumentation,
  fs: FsInstrumentation,
  'generic-pool': GenericPoolInstrumentation,
  graphql: GraphQLInstrumentation,
  grpc: GrpcInstrumentation,
  hapi: HapiInstrumentation,
  http: HttpInstrumentation,
  ioredis: IORedisInstrumentation,
  kafkajs: KafkaJsInstrumentation,
  knex: KnexInstrumentation,
  koa: KoaInstrumentation,
  'lru-memoizer': LruMemoizerInstrumentation,
  memcached: MemcachedInstrumentation,
  mongodb: MongoDBInstrumentation,
  mongoose: MongooseInstrumentation,
  mysql2: MySQL2Instrumentation,
  mysql: MySQLInstrumentation,
  'nestjs-core': NestInstrumentation,
  net: NetInstrumentation,
  pg: PgInstrumentation,
  pino: PinoInstrumentation,
  redis: RedisInstrumentationV2,
  'redis-4': RedisInstrumentationV4,
  restify: RestifyInstrumentation,
  router: RouterInstrumentation,
  'socket.io': SocketIoInstrumentation,
  tedious: TediousInstrumentation,
  undici: UndiciInstrumentation,
  winston: WinstonInstrumentation,
}

// The complete list of supportes instrumenter is: 'https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/metapackages/auto-instrumentations-node/src/utils.ts#L96
// to get the instrumentation. All the instrumentations are dependencies of "@opentelemetry/auto-instrumentations-node"
// meta-package, so we just imoprt it.

// Open telemetry instrumentations. The "label" is the package name of the instrumentation
// e.g. `gioredis` has a label of `ioredis`.
// Unforuntately every instrumenter has it own named export, e.g.:
// https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/plugins/node/opentelemetry-instrumentation-ioredis/src/instrumentation.ts#L43
// ...so we need to map the insturmentare packageto the named export.
const getInstrumenterInstance = (label) => {
  if (!InstrumentationMap[label]) {
    throw new Error(`Unknown instrumenter label: '${label}`)
  }
  const Constructor = InstrumentationMap[label]
  const instance = new Constructor()
  return instance
}

const getInstrumenters = (instrumenters = []) => instrumenters.map(getInstrumenterInstance)

module.exports = {
  getInstrumenters
}
