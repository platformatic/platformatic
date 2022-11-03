# Transactions

Platformatic DB entites support transaction through the `tx` optional parameter. 
If the `tx` parameter is provided, the entity will join the transaction, e.g.:

```js

const { connect } = require('@platformatic/sql-mapper')
const logger = pino(pretty())

async function main() {
  const pgConnectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  const { db, entities} = await connect({
    connectionString: pgConnectionString,
    log: logger,
  })

  const result = await db.tx(async tx => {
    // these two operations will be executed in the same transaction
   const authorResult = await entities.author.save({
      fields: ['id', 'name'],
      input: { name: 'test'},
      tx
    })
    const res = await entities.page.save({
      fields: ['title', 'authorId'],
      input: { title: 'page title', authorId: authorResult.id },
      tx
    })
    return res
  })

}
```

Throwing an Error triggers a transaction rollback:

```js
    try {
      await db.tx(async tx => {
        await entities.page.save({
          input: { title: 'new page' },
          fields: ['title'],
          tx
        })

        // here we have `new page` 
        const findResult = await entities.page.find({ fields: ['title'], tx })
        
        // (...)

        // We force the rollback
        throw new Error('rollback')
      })
    } catch (e) {
      // rollback
    }
    
    // no 'new page' here...
    const afterRollback = await entities.page.find({ fields: ['title'] })

```
