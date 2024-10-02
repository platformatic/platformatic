const { loaded } = await import(new URL('./non-existing.js', import.meta.url))

console.log('LOADED', loaded.toString())
