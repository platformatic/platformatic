await new Promise(resolve => setTimeout(resolve, 500))

export default function setup ({ onRequest }) {
  onRequest(({ addResponseHeader }) => {
    addResponseHeader('x-slow-extension', 'loaded')
  })
}
