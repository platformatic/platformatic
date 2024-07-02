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
    'cli',
    {
      type: 'category',
      label: 'Platformatic Composer',
      collapsed: true,
      items: [
        'composer/overview',
        'composer/configuration',
        'composer/programmatic',
        'composer/api-modification',
        'composer/plugin', 
      ],
    },
    {
      type: 'category',
      label: 'Platformatic DB',
      collapsed: true,
      items: [
        'db/overview',
        'db/configuration',
        'db/migrations',
        {
          type: 'category',
          label: 'Authorization',
          collapsed: true,
          items: [
            'db/authorization/overview',
            'db/authorization/strategies',
            'db/authorization/user-roles-metadata',
            'db/authorization/rules',
          ],
        },
        'db/plugin',
        'db/logging',
        'db/programmatic',
        'db/schema-support',
      ],
    },
    {
      type: 'category',
      label: 'Platformatic Runtime',
      collapsed: true,
      items: [
        'runtime/overview',
        'runtime/configuration',
        'runtime/programmatic',
      ],
    },
    {
      type: 'category',
      label: 'Platformatic Service',
      collapsed: true,
      items: [
        'service/overview',
        'service/configuration',
        'service/plugin',
        'service/programmatic',
      ],
    },
    {
      type: 'category',
      label: 'Client',
      collapsed: true,
      items: [
        'client/overview',
        'client/programmatic',
        'client/frontend',
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      collapsed: true,
      items: [
        {
          type: 'category',
          label: 'SQL-to-OpenAPI',
          collapsed: true,
          items: [
            'packages/sql-openapi/overview',
            'packages/sql-openapi/api',
            'packages/sql-openapi/ignore',
            'packages/sql-openapi/explicit-include',
          ],
        },
        {
          type: 'category',
          label: 'SQL-to-GraphQL',
          collapsed: true,
          items: [
            'packages/sql-graphql/overview',
            'packages/sql-graphql/queries',
            'packages/sql-graphql/mutations',
            'packages/sql-graphql/many-to-many',
            'packages/sql-graphql/ignore',
          ],
        },
        {
          type: 'category',
          label: 'SQL-Mapper',
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
                'packages/sql-mapper/entities/transactions',
              ],
            },
          ],
        },
        {
          type: 'category',
          label: 'SQL-Events',
          collapsed: true,
          items: [
            'packages/sql-events/overview',
            'packages/sql-events/fastify-plugin',
          ],
        },
      ],
    },
    
    'FAQs'
  ],
  Learn: [
    'learn/overview',
    'getting-started/quick-start-guide',
    {
      type: 'category',
      label: 'Beginner Tutorials',
      collapsed: true,
      items: [
        'learn/beginner/crud-application',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Guides',
      collapsed: true,
      items: [
        'guides/movie-quotes-app-tutorial',
        {
          type: 'category',
          label: 'Deployment',
          collapsed: true,
          items: [
            'guides/deployment/overview',
            'guides/deployment/deploy-to-fly-io-with-sqlite',
            'guides/deployment/advanced-fly-io-deployment',
          ],
        },
        'guides/seed-a-database',
        {
          type: 'category',
          label: 'Add Custom Functionality',
          collapsed: true,
          items: [
            'guides/add-custom-functionality/overview',
            'guides/add-custom-functionality/prerequisites',
            'guides/add-custom-functionality/extend-graphql',
            'guides/add-custom-functionality/extend-rest',
          ],
        },
        'guides/securing-platformatic-db',
        'guides/jwt-auth0',
        'guides/monitoring',
        'guides/debug-platformatic-db',
        'guides/environment-variables',
        'guides/prisma',
        'guides/generate-frontend-code-to-consume-platformatic-rest-api',
        'guides/migrating-fastify-app-to-platformatic-service',
        "guides/migrating-express-app-to-platformatic-service",
        'guides/applications-with-stackables',
        'guides/telemetry',
        'guides/dockerize-platformatic-app',
        'guides/build-modular-monolith',
        'guides/logging-to-elasticsearch',
        "guides/jwt-keycloak",
        "guides/use-env-with-platformatic"
      ],
    },
    'learn/glossary',
    'FAQs'
  ]
};

module.exports = sidebars;
