'use strict'

const { connInfo, isPg } = require('./helper')
const { test } = require('node:test')
const { deepEqual: same, equal, ok: pass } = require('node:assert')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')

async function runMigrations (db, sql) {
  await db.query(sql`
create table company (
  id SERIAL primary key,
  name varchar(60)
);

create table social_medias (
  id SERIAL primary key,
  name varchar(60)
);

create table company_social_medias (
  id SERIAL primary key,
  username varchar not null,
  social_medias_id integer not null,
  company_id integer not null,
  constraint "fk_company_id" foreign key ("company_id") references company,
  constraint "fk_social_medias_id" foreign key ("social_medias_id") references social_medias
);
  `)
}

async function clean (db, sql) {
  await db.query(sql`
drop table if exists company_social_medias;
drop table if exists company;
drop table if exists social_medias;
  `)
}

test('do not crash', { skip: !isPg }, async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      await clean(db, sql)

      await runMigrations(db, sql)
      t.after(() => async () => {
        await clean(db, sql)
      })
    }
  })
  await app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveCompany(input: { name: "Platformatic" }) {
              id
              name
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveCompany status code')
    same(res.json(), {
      data: {
        saveCompany: {
          id: 1,
          name: 'Platformatic'
        }
      }
    }, 'saveCompany response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveSocialMedia(input: { name: "Twitter" }) {
              id
              name
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveSocialMedia status code')
    same(res.json(), {
      data: {
        saveSocialMedia: {
          id: 1,
          name: 'Twitter'
        }
      }
    }, 'saveSocialMedia response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveCompanySocialMedia(input: { companyId: 1, socialMediasId: 1, username: "platformatic" }) {
              id
              username
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveCompanySocialMedia status code')
    same(res.json(), {
      data: {
        saveCompanySocialMedia: {
          id: 1,
          username: 'platformatic'
        }
      }
    }, 'saveCompanySocialMedia response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            company {
              name
              companySocialMedias {
                username
                socialMedias {
                  name
                }
              }
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'complex status code')
    same(res.json(), {
      data: {
        company: [{
          name: 'Platformatic',
          companySocialMedias: [{
            username: 'platformatic',
            socialMedias: {
              name: 'Twitter'
            }
          }]
        }]
      }
    }, 'complex response')
  }
})
