# Deploying on AWS Lambda

It is possible to deploy Platformatic applications to [AWS Lambda](https://aws.amazon.com/lambda/)
by leveraging [`@fastify/aws-lambda`](https://github.com/fastify/aws-lambda-fastify).

Once you set up your Platformatic DB application, such as following
[our tutorial](/getting-started/quick-start-guide.md), you can create a
`server.mjs` file as follows:

```js
import awsLambdaFastify from '@fastify/aws-lambda'
import { buildServer } from '@platformatic/db'

const app = await buildServer('./platformatic.db.json')
// You can use the same approach with both Platformatic DB and
// and service
// const app = await buildServer('./platformatic.service.json')

// The following also work for Platformatic Service applications
// import { buildServer } from '@platformatic/service'
export const handler = awsLambdaFastify(app)

// Loads the Application, must be after the call to `awsLambdaFastify`
await app.ready()
```

This would be the entry point for your AWS Lambda function.

## Avoiding cold start

### Caching the DB schema

If you use Platformatic DB, you want to turn on the `schemalock`
[configuration](/reference/db/configuration.md) to cache the schema
information on disk.

Set the `db.schemalock` configuration to `true`, start the application,
and a `schema.lock` file should appear. Make sure to commit that file and
deploy your lambda.

### Provisioned concurrency

> Since [AWS Lambda now enables the use of ECMAScript (ES) modules](https://aws.amazon.com/blogs/compute/using-node-js-es-modules-and-top-level-await-in-aws-lambda/) in Node.js 14 runtimes,
you could lower the cold start latency when used with [Provisioned Concurrency](https://aws.amazon.com/blogs/compute/new-for-aws-lambda-predictable-start-up-times-with-provisioned-concurrency/)
thanks to the top-level await functionality. (Excerpt taken from [`@fastify/aws-lambda`](https://github.com/fastify/aws-lambda-fastify#lower-cold-start-latency))
