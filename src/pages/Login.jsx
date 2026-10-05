import { useState } from 'react'

export default function Login({ mode = 'login', onBack, onSubmit }) {
  return <AuthForm mode={mode} onBack={onBack} onSubmit={onSubmit} />
}

function AuthForm({ mode, onBack, onSubmit }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    const form = new FormData(event.currentTarget)
    try {
      const result = await onSubmit({
        fullName: form.get('fullName'),
        email: form.get('email'),
        password: form.get('password'),
      })
      if (result?.message) setMessage(result.message)
    } catch (submitError) {
      setError(submitError.message || 'Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="auth-page"><button className="back-link" onClick={onBack}>← Back to home</button><div className="auth-card"><div className="auth-brand brand"><span className="brand-mark">S</span><span>SIWES<br /><b>TRACKER</b></span></div><span className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR ACCOUNT'}</span><h1>{mode === 'login' ? 'Pick up where<br />you left off.' : 'Start your journey.'}</h1><p className="muted">{mode === 'login' ? 'Your training record is waiting for you.' : 'A simpler way to document your SIWES experience.'}</p><form onSubmit={submit}>{mode === 'register' && <label>Full name<input name="fullName" required autoComplete="name" placeholder="Your full name" /></label>}<label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@university.edu" /></label><label>Password<input name="password" type="password" required minLength="6" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" /></label>{mode === 'register' && <label className="check-row"><input type="checkbox" required /> I agree to the terms of use</label>}{error && <p className="auth-feedback" role="alert">{error}</p>}{message && <p className="auth-feedback success" role="status">{message}</p>}<button className="button button-dark full" type="submit" disabled={submitting}>{submitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button></form></div></div>
}
