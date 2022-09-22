
import toast from 'react-hot-toast'

function notify ({ message, type = 'success' }) {
  const opts = {
    position: 'top-right'
  }
  if (undefined === toast[type]) {
    return toast(message, opts)
  }
  return toast[type](message, opts)
}

export { notify }
