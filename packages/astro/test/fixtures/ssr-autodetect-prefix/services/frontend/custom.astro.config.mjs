import node from '@astrojs/node'

export default {
  base: 'nested/base/dir/',
  output: 'server',
  adapter: node({
    mode: 'middleware'
  })
}
