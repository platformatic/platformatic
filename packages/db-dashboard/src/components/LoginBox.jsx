import { Button } from '@platformatic/ui-components'
import { MAIN_GREEN, MAIN_DARK_BLUE, BOX_SHADOW } from '@platformatic/ui-components/src/components/constants'
import { useContext, useRef, useState } from 'react'
import { AppContext } from '../App'
import styles from './LoginBox.module.css'
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
    <section className={styles.container}>
      <h3 className={styles.title}>Login</h3>
      <form className={styles.form}>
        <input className={styles.input} type='password' placeholder='Your Password' onChange={(e) => setLoginError(null)} ref={inputPasswordRef} />
        <div className={styles.button}>
          <Button color={MAIN_DARK_BLUE} backgroundColor={MAIN_GREEN} bordered={false} bold label='Login' onClick={onLoginButtonClicked} hoverEffect={BOX_SHADOW} />
        </div>
      </form>
      {loginError && <p className='help is-danger'>Wrong password.</p>}
    </section>
  )
}
