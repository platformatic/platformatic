<template>
  <div>Hello from v{{ version }} t{{ time }}</div>
</template>

<script setup>
import { getLogger } from '@platformatic/globals'

const logger = getLogger()
logger?.info('Log from Nuxt App page')
const version = 123
const time = Date.now()
</script>
