import { FastifyPluginAsync } from 'fastify';

type User = {
  name: string
  age: number
}

type Group = {
  name: string
  users: User[]
}

const users = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 },
]
const plugin: FastifyPluginAsync = async (app) => {
  app.rpc('addUser', async (options: { user: User }): Promise<void> => {
    users.push(options.user)
  })

  app.rpc('getUsers', async (options: { maxAge: number }): Promise<User[]> => {
    return users.filter(user => user.age <= options.maxAge)
  })

  app.rpc('getGroupByName', async (options: { name: string }): Promise<Group> => {
    return { name: options.name, users: users }
  })
}

export default plugin;
