module.exports = async function (app, opts) {
  app.graphql.defineResolvers({
    Query: {
      names: async function (root, args, context) {
        return [
          'John',
          'Jane'
        ]
      }
    }
  })
}
