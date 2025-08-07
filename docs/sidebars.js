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
    // Overview - What Platformatic is and core concepts
    {
      type: 'category',
      label: 'Overview',
      collapsed: false,
      items: [
        'Overview'
      ]
    },
    
    // Learning - Tutorials and getting started (Diátaxis: Learning-oriented)
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/quick-start-watt',
        'getting-started/quick-start-guide',
        'getting-started/port-your-app',
        {
          type: 'category',
          label: 'Tutorials',
          collapsed: true,
          items: [
            'learn/beginner/crud-application',
            'learn/beginner/environment-variables'
          ]
        },
      ]
    },

    // How-to Guides - Problem-solving for experienced users (Diátaxis: Problem-oriented)
    {
      type: 'category',
      label: 'How-to Guides',
      collapsed: true,
      items: [
        {
          type: 'category',
          label: 'Application Development',
          collapsed: true,
          items: [
            'guides/build-modular-monolith',
            'guides/cache-with-platformatic-watt',
            'guides/generate-frontend-code-to-consume-platformatic-rest-api',
            'guides/using-watt-with-node-config',
            'guides/use-watt-multiple-repository',
            'guides/scheduler'
          ]
        },
        {
          type: 'category',
          label: 'Deployment & Operations',
          collapsed: true,
          items: [
            'guides/deployment/dockerize-a-watt-app',
            'guides/deployment/compiling-typescript',
            'guides/deployment/k8s-readiness-liveness'
          ]
        },
        {
          type: 'category',
          label: 'Monitoring & Observability',
          collapsed: true,
          items: [
            'guides/monitoring',
            'guides/telemetry',
            'guides/logging-to-elasticsearch'
          ]
        }
      ]
    },

    // Reference - Technical specifications organized by user mental model (Diátaxis: Information-oriented)
    {
      type: 'category',
      label: 'Reference',
      collapsed: true,
      items: [
        'reference-overview',
        {
          type: 'category',
          label: 'Watt (Node.js Application Server)',
          collapsed: true,
          items: [
            'reference/watt/overview',
            'reference/watt/configuration',
            'reference/watt/reference'
          ]
        },
        {
          type: 'category',
          label: 'CLI Tools',
          collapsed: true,
          items: [
            'reference/platformatic/cli',
            'file-formats'
          ]
        },
        {
          type: 'category',
          label: 'Services & APIs',
          collapsed: true,
          items: [
            {
              type: 'category',
              label: 'HTTP Service',
              collapsed: true,
              items: [
                'reference/service/overview',
                'reference/service/configuration',
                'reference/service/plugin',
                'reference/service/programmatic'
              ]
            },
            {
              type: 'category',
              label: 'API Gateway (Composer)',
              collapsed: true,
              items: [
                'reference/composer/overview',
                'reference/composer/configuration',
                'reference/composer/api-modification',
                'reference/composer/plugin',
                'reference/composer/programmatic'
              ]
            },
            {
              type: 'category',
              label: 'Client SDK',
              collapsed: true,
              items: [
                'reference/client/overview',
                'reference/client/programmatic',
                'reference/client/frontend'
              ]
            },
            {
              type: 'category',
              label: 'Database Service',
              collapsed: true,
              items: [
                'reference/db/overview',
                'reference/db/configuration',
                'reference/db/migrations',
                'reference/db/schema-support',
                'reference/db/seed',
                {
                  type: 'category',
                  label: 'Authorization',
                  collapsed: true,
                  items: [
                    'reference/db/authorization/overview',
                    'reference/db/authorization/strategies',
                    'reference/db/authorization/user-roles-metadata',
                    'reference/db/authorization/rules'
                  ]
                },
                {
                  type: 'category',
                  label: 'Security',
                  collapsed: true,
                  items: [
                    'reference/db/securing-platformatic-db',
                    'reference/db/jwt-auth0',
                    'reference/db/jwt-keycloak'
                  ]
                },
                'reference/db/plugin',
                'reference/db/logging',
                'reference/db/programmatic'
              ]
            }
          ]
        },
        {
          type: 'category',
          label: 'Framework Integrations (Stackables)',
          collapsed: true,
          items: [
            {
              type: 'category',
              label: 'Node.js',
              collapsed: true,
              items: [
                'reference/node/overview',
                'reference/node/configuration'
              ]
            },
            {
              type: 'category',
              label: 'Next.js',
              collapsed: true,
              items: [
                'reference/next/overview', 
                'reference/next/configuration'
              ]
            },
            {
              type: 'category',
              label: 'Nest.js',
              collapsed: true,
              items: [
                'reference/nest/overview',
                'reference/nest/configuration'
              ]
            },
            {
              type: 'category',
              label: 'Astro',
              collapsed: true,
              items: [
                'reference/astro/overview',
                'reference/astro/configuration',
                'reference/astro/caching'
              ]
            },
            {
              type: 'category',
              label: 'Remix',
              collapsed: true,
              items: [
                'reference/remix/overview', 
                'reference/remix/configuration',
                'reference/remix/caching'
              ]
            },
            {
              type: 'category',
              label: 'Vite',
              collapsed: true,
              items: [
                'reference/vite/overview', 
                'reference/vite/configuration'
              ]
            }
          ]
        },
        {
          type: 'category',
          label: 'Runtime & Orchestration',
          collapsed: true,
          items: [
            'reference/runtime/overview',
            'reference/runtime/configuration',
            'reference/runtime/multithread-architecture',
            'reference/runtime/programmatic'
          ]
        },
        {
          type: 'category',
          label: 'SQL Data Layer',
          collapsed: true,
          items: [
            'reference/sql-mapper/overview',
            'reference/sql-mapper/fastify-plugin',
            {
              type: 'category',
              label: 'SQL Mapper - Entities',
              collapsed: true,
              items: [
                'reference/sql-mapper/entities/overview',
                'reference/sql-mapper/entities/fields',
                'reference/sql-mapper/entities/api',
                'reference/sql-mapper/entities/example',
                'reference/sql-mapper/entities/hooks',
                'reference/sql-mapper/entities/relations',
                'reference/sql-mapper/entities/transactions',
                'reference/sql-mapper/entities/timestamps'
              ]
            },
            {
              type: 'category',
              label: 'GraphQL API Generation',
              collapsed: true,
              items: [
                'reference/sql-graphql/overview',
                'reference/sql-graphql/queries',
                'reference/sql-graphql/mutations',
                'reference/sql-graphql/many-to-many',
                'reference/sql-graphql/subscriptions',
                'reference/sql-graphql/ignore'
              ]
            },
            {
              type: 'category',
              label: 'REST API Generation',
              collapsed: true,
              items: [
                'reference/sql-openapi/overview',
                'reference/sql-openapi/api',
                'reference/sql-openapi/ignore',
                'reference/sql-openapi/explicit-include'
              ]
            },
            {
              type: 'category',
              label: 'SQL Events',
              collapsed: true,
              items: [
                'reference/sql-events/overview',
                'reference/sql-events/fastify-plugin'
              ]
            }
          ]
        },
        'reference/errors'
      ]
    },

    // Contributing - Community and development resources
    {
      type: 'category',
      label: 'Contributing',
      collapsed: true,
      items: [
        'contributing/contributing',
        'contributing/documentation-style-guide'
      ]
    }
  ]
}

module.exports = sidebars
