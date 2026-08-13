import { FormEvent, useState } from 'react';
import { useAuth } from '../../auth';

export function LoginPage({ loading }: { loading: boolean }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(''); setSubmitting(true);
    try { await login(email, password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in'); }
    finally { setSubmitting(false); }
  }

  return <main className="login-page"><form className="login-card" onSubmit={onSubmit}>
    <div className="brand"><span className="brand-mark">W</span><span><strong>WorkForce</strong><small>HR Operations</small></span></div>
    <h1>Welcome back</h1><p>Sign in to your HR portal to continue.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <label>Email or Username<input type="text" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    <button className="button primary" disabled={submitting || loading}>{submitting ? 'Signing in…' : 'Sign in'}</button>
  </form></main>;
}
