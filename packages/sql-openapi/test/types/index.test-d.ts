import { fastify, FastifyInstance } from 'fastify'
import plugin, { SQLOpenApiPluginOptions } from '../../index'

const instance: FastifyInstance = fastify()
const document: SQLOpenApiPluginOptions = {
  exposeRoute: true,
  ignore: {
    testEntity1: true,
    testEntity2: {
      fieldName: true
    }
  },
  info: {
    title: 'Test swagger',
    description: 'testing the fastify swagger api',
    version: '0.1.0'
  },
  servers: [
    {
      url: 'http://localhost'
    }
  ],
  tags: [
    { name: 'tag' }
  ],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        name: 'apiKey',
        in: 'header'
      }
    }
  },
  security: [{
    apiKey: []
  }],
  externalDocs: {
    description: 'Find more info here',
    url: 'https://swagger.io'
  }
}

instance.register(plugin, document)
