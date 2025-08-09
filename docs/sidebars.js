/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

// /** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'Overview',
    {
      type: 'category',
      label: 'wattpm',
      collapsed: true,
      items: ['packages/wattpm/overview', 'packages/wattpm/configuration', 'packages/wattpm/reference']
    },
    {
      type: 'category',
      label: 'wattpm-utils',
      collapsed: true,
      items: ['packages/wattpm-utils/overview', 'packages/wattpm-utils/reference']
    },
    {
      type: 'category',
      label: '@platformatic/composer',
      collapsed: true,
      items: [
        'packages/composer/overview',
        'packages/composer/configuration',
        'packages/composer/programmatic',
        'packages/composer/api-modification',
        'packages/composer/plugin'
      ]
    },
    {
      type: 'category',
      label: '@platformatic/db',
      collapsed: true,
      items: [
        'packages/db/overview',
        'packages/db/configuration',
        'packages/db/migrations',
        {
          type: 'category',
          label: 'Authorization',
          collapsed: true,
          items: [
            'packages/db/authorization/overview',
            'packages/db/authorization/strategies',
            'packages/db/authorization/user-roles-metadata',
            'packages/db/authorization/rules'
          ]
        },
        'packages/db/plugin',
        'packages/db/logging',
        'packages/db/programmatic',
        'packages/db/schema-support',
        'packages/db/seed',
        'packages/db/securing-platformatic-db',
        'packages/db/jwt-auth0',
        'packages/db/jwt-keycloak'
      ]
    },
    {
      type: 'category',
      label: '@platformatic/runtime',
      collapsed: true,
      items: [
        'packages/runtime/overview',
        'packages/runtime/configuration',
        'packages/runtime/multithread-architecture',
        'packages/runtime/programmatic'
      ]
    },
    {
      type: 'category',
      label: '@platformatic/service',
      collapsed: true,
      items: [
        'packages/service/overview',
        'packages/service/configuration',
        'packages/service/plugin',
        'packages/service/programmatic'
      ]
    },
    {
      type: 'category',
      label: '@platformatic/client',
      collapsed: true,
      items: ['packages/client/overview', 'packages/client/programmatic', 'packages/client/frontend']
    },
    {
      type: 'category',
      label: '@platformatic/node',
      collapsed: true,
      items: ['packages/node/overview', 'packages/node/configuration']
    },
    {
      type: 'category',
      label: '@platformatic/astro',
      collapsed: true,
      items: ['packages/astro/overview', 'packages/astro/configuration', 'packages/astro/caching']
    },
    {
      type: 'category',
      label: '@platformatic/next',
      collapsed: true,
      items: ['packages/next/overview', 'packages/next/configuration']
    },
    {
      type: 'category',
      label: '@platformatic/remix',
      collapsed: true,
      items: ['packages/remix/overview', 'packages/remix/configuration']
    },
    {
      type: 'category',
      label: '@platformatic/vite',
      collapsed: true,
      items: ['packages/vite/overview', 'packages/vite/configuration']
    },
    {
      type: 'category',
      label: '@platformatic/sql-openapi',
      collapsed: true,
      items: [
        'packages/sql-openapi/overview',
        'packages/sql-openapi/api',
        'packages/sql-openapi/ignore',
        'packages/sql-openapi/explicit-include'
      ]
    },
    {
      type: 'category',
      label: '@platformatic/sql-graphql',
      collapsed: true,
      items: [
        'packages/sql-graphql/overview',
        'packages/sql-graphql/queries',
        'packages/sql-graphql/mutations',
        'packages/sql-graphql/many-to-many',
        'packages/sql-graphql/ignore'
      ]
    },
    {
      type: 'category',
      label: '@platformatic/sql-mapper',
      collapsed: true,
      items: [
        'packages/sql-mapper/overview',
        'packages/sql-mapper/fastify-plugin',
        {
          type: 'category',
          label: 'Entities',
          collapsed: true,
          items: [
            'packages/sql-mapper/entities/overview',
            'packages/sql-mapper/entities/fields',
            'packages/sql-mapper/entities/api',
            'packages/sql-mapper/entities/example',
            'packages/sql-mapper/entities/hooks',
            'packages/sql-mapper/entities/relations',
            'packages/sql-mapper/entities/transactions'
          ]
        }
      ]
    },
    {
      type: 'category',
      label: '@platformatic/sql-events',
      collapsed: true,
      items: ['packages/sql-events/overview', 'packages/sql-events/fastify-plugin']
    },
    'FAQs'
  ],
  Learn: [
    'learn/overview',
    'getting-started/quick-start-watt',
    'getting-started/quick-start-guide',
    'getting-started/port-your-app',
    {
      type: 'category',
      label: 'Beginner Tutorials',
      collapsed: true,
      items: ['learn/beginner/crud-application', 'learn/beginner/environment-variables']
    },
    {
      type: 'category',
      label: 'Deployment',
      collapsed: true,
      items: ['guides/deployment/dockerize-a-watt-app', 'guides/deployment/k8s-readiness-liveness']
    },
    {
      type: 'category',
      label: 'Advanced Guides',
      collapsed: true,
      items: [
        'guides/cache-with-platformatic-watt',
        'guides/monitoring',
        'guides/generate-frontend-code-to-consume-platformatic-rest-api',
        'guides/telemetry',
        'guides/build-modular-monolith',
        'guides/logging-to-elasticsearch',
        'guides/using-watt-with-node-config',
        'guides/use-watt-multiple-repository',
        'guides/scheduler'
      ]
    },
    'learn/glossary',
    'FAQs'
  ]
}

module.exports = sidebars
