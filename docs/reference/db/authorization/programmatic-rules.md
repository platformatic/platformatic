# Programmatic Rules
If it's necessary to have more control over the authorizations, it's possible to specify the rules programmatically, e.g.:

```js

  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    rules: [{
      role: 'user',
      entity: 'page',
      async find ({ user, ctx, where }) {
        return {
          ...where,
          userId: {
            eq: user['X-PLATFORMATIC-USER-ID']
          }
        }
      },
      async delete ({ user, ctx, where }) {
        return {
          ...where,
          userId: {
            eq: user['X-PLATFORMATIC-USER-ID']
          }
        }
      },
      defaults: {
        userId: async function ({ user, ctx, input }) {
          match(user, {
            'X-PLATFORMATIC-USER-ID': generated.shift(),
            'X-PLATFORMATIC-ROLE': 'user'
          })
          return user['X-PLATFORMATIC-USER-ID']
        }

      },
      async save ({ user, ctx, where }) {
        return {
          ...where,
          userId: {
            eq: user['X-PLATFORMATIC-USER-ID']
          }
        }
      }
    }]
  })

```

In this example, the `user` role can delete all the posts edited before yesterday:

```js
 app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: true,
      save: true,
      async delete ({ user, ctx, where }) {
        return {
          ...where,
          editedAt: {
            lt: yesterday
          }
        }
      },
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      }
    }]
  })
```


