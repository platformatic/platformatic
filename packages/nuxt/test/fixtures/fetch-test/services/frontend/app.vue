<template>
  <div>
    Hello from v{{ version }} t{{ time }}
    <pre id="fetch-results">{{ JSON.stringify(fetchResults, null, 2) }}</pre>
  </div>
</template>

<script setup>
const version = 123
const time = Date.now()
const fetchResults = {}

try {
  const stringUrlResponse = await fetch('http://backend.plt.local/example')
  const stringUrlData = await stringUrlResponse.json()
  fetchResults.stringUrl = { ok: stringUrlResponse.ok, data: stringUrlData }
} catch (err) {
  fetchResults.stringUrl = { ok: false, error: String(err) }
}

try {
  const req = new Request('http://backend.plt.local/example')
  const requestObjectResponse = await fetch(req)
  const requestObjectData = await requestObjectResponse.json()
  fetchResults.requestObject = { ok: requestObjectResponse.ok, data: requestObjectData }
} catch (err) {
  fetchResults.requestObject = { ok: false, error: String(err) }
}
</script>
