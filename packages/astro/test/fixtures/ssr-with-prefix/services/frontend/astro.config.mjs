import node from '@astrojs/node'

export default {
  output: 'server',
  adapter: node({
    mode: 'middleware'
  })
}
