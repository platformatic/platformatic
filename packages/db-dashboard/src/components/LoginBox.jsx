import { useContext, useRef, useState } from 'react'
import { AppContext } from '../App'
export default function LoginBox () {
  const inputPasswordRef = useRef('platformatic')
  const { setLogged, setUsername, setAdminSecret, urlPrefix } = useContext(AppContext)
  const [loginError, setLoginError] = useState(null)
  async function onLoginButtonClicked (event) {
    event.preventDefault()
    const apiUrl = `${urlPrefix}/_admin/login`
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: inputPasswordRef.current.value })
    })

    if (res.status === 200) {
      const body = await res.json()
      if (body.authorized) {
        setLogged(true)
        setUsername('admin')
        setAdminSecret(inputPasswordRef.current.value)
      }
    } else {
      setLoginError('Wrong password.')
    }
  }
  return (
    <section className='hero is-success is-fullheight'>
      <div className='hero-body'>
        <div className='container has-text-centered'>
          <div className='column is-4 is-offset-4'>
            <h3 className='title has-text-black'>Login</h3>
            <hr className='login-hr' />
            <p className='subtitle has-text-black'>Please login to proceed.</p>
            <div className='box'>
              <form>
                <div className='field'>
                  <div className='control'>
                    <input className={`input is-large ${loginError !== null ? 'is-danger' : ''}`} type='password' placeholder='Your Password' onChange={(e) => setLoginError(null)} ref={inputPasswordRef} />
                    {loginError && <p className='help is-danger'>Wrong password.</p>}

                  </div>
                </div>
                <button className='button is-block is-info is-large is-fullwidth' onClick={onLoginButtonClicked}>Login <i className='fa fa-sign-in' aria-hidden='true' /></button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
