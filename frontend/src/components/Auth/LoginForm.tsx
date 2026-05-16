import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface Props { mode: 'login' | 'signup' }

export function LoginForm({ mode }: Props) {
  const { loginWithEmail, signupWithEmail } = useAuth();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        if (!name.trim()) { setError('Please enter your name'); return; }
        await signupWithEmail(email, password, name);
      }
    } catch (err: any) {
      // Map Firebase error codes to friendly messages
      const code = err?.code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password')
        setError('Incorrect email or password');
      else if (code === 'auth/email-already-in-use')
        setError('An account with this email already exists');
      else if (code === 'auth/weak-password')
        setError('Password must be at least 6 characters');
      else if (code === 'auth/invalid-email')
        setError('Please enter a valid email address');
      else
        setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: mode === 'login' ? -10 : 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleSubmit}
      className="space-y-3"
    >
      {mode === 'signup' && (
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full bg-panel border border-white/8 rounded-xl px-4 py-3
                     text-text-main text-sm placeholder:text-muted
                     focus:outline-none focus:border-accent transition-colors"
        />
      )}

      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="w-full bg-panel border border-white/8 rounded-xl px-4 py-3
                   text-text-main text-sm placeholder:text-muted
                   focus:outline-none focus:border-accent transition-colors"
      />

      <div className="relative">
        <input
          type={showPw ? 'text' : 'password'}
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full bg-panel border border-white/8 rounded-xl px-4 py-3
                     text-text-main text-sm placeholder:text-muted pr-11
                     focus:outline-none focus:border-accent transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowPw(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted
                     hover:text-text-main transition-colors"
        >
          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {error && (
        <p className="text-danger text-xs bg-danger/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent hover:bg-accent-dark disabled:opacity-60
                   text-white font-medium py-3 rounded-xl text-sm transition-all
                   flex items-center justify-center gap-2"
      >
        {loading
          ? <><Loader2 size={15} className="animate-spin" /> Please wait...</>
          : mode === 'login' ? 'Sign In' : 'Create Account'
        }
      </button>
    </motion.form>
  );
}
