import net from 'net'
import { pipeline } from 'stream'

const addr = process.argv[2]
console.log(addr)
if (!addr) {
  console.log('Usage: <to>')
  process.exit(1)
}

const ports = [
  5432,
  3307,
  3306,
  3308
]

for (const port of ports) {
  net.createServer(function (from) {
    console.log('connecting to', port)
    const to = net.createConnection({
      host: addr,
      port
    })
    pipeline(from, to, from, (err) => {
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        console.error(err)
      } else {
        console.log('connection closed')
      }
    })
  }).listen(port)
}
