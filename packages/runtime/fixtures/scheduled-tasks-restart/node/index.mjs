import fastify from 'fastify'

export const scheduledTasks = {
  '0 0 1 1 *': ['report']
}

export const tasks = {
  report () {}
}

export function create () {
  return fastify()
}
