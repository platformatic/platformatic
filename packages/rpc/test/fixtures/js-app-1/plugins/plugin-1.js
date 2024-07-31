const users = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 }
]
const plugin = async (app) => {
  app.rpc('addUser', async (options) => {
    users.push(options.user)
  })

  app.rpc('getUsers', async (options) => {
    return users.filter(user => user.age <= options.maxAge)
  })

  app.rpc('getGroupByName', async (options) => {
    return { name: options.name, users }
  })

  app.rpc('getRecursiveNode', async () => {
    return {
      id: 'root',
      nodes: [
        null,
        { id: 'node-1', nodes: [null, { id: 'node-2', nodes: [] }] },
        { id: 'node-3', nodes: [] }
      ]
    }
  })
}

module.exports = plugin
