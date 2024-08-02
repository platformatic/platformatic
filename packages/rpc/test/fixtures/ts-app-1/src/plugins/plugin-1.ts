import { FastifyPluginAsync } from 'fastify'

type User = {
  name: string
  age: number
}

type Group = {
  name?: string
  users: User[]
}

type Node = {
  id: string
  nodes: (Node | null)[]
}

const users = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 },
]

const plugin: FastifyPluginAsync = async (app) => {
  // These lines are needed to test avoiding types collision
  /* eslint-disable-next-line */
  type addUserArgs = { user: User }
  /* eslint-disable-next-line */
  type addUserReturnType = void

  app.rpc('addUser', async (options: { user: User }): Promise<void> => {
    users.push(options.user)
  })

  app.rpc('getUsers', async (options: { maxAge: number }): Promise<User[]> => {
    return users.filter(user => user.age <= options.maxAge)
  })

  app.rpc('getGroupByName', async (options: { name: string }): Promise<Group> => {
    return { name: options.name, users }
  })

  app.rpc('getRecursiveNode', async (): Promise<Node> => {
    return {
      id: 'root',
      nodes: [
        null,
        { id: 'node-1', nodes: [null, { id: 'node-2', nodes: [] }] },
        { id: 'node-3', nodes: [] },
      ],
    }
  })
}

export default plugin
