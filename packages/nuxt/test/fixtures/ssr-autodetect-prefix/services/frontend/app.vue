<template>
  <div>Hello from v{{ version }} t{{ time }}</div>
</template>

<script setup>
const version = 123
const time = Date.now()
</script>
