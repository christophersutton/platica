import { useState } from 'react';
import { api } from '@/lib/api';
import type { ApiError } from '@types';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);

    try {
      const result = await api.auth.requestMagicLink(email);
      setStatus('sent');
      
      // In development, we get the token directly
      if (result.token) {
        await handleVerifyToken(result.token);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || 'Failed to send magic link');
      setStatus('idle');
    }
  };

  const handleVerifyToken = async (token: string) => {
    setStatus('verifying');
    setError(null);

    try {
      const result = await api.auth.verifyToken(token);
      localStorage.setItem('auth_token', result.token);
      window.location.href = '/'; // Redirect to home page
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || 'Failed to verify token');
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Platica
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleRequestMagicLink}>
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status !== 'idle'}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={status !== 'idle'}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {status === 'idle' && 'Send Magic Link'}
              {status === 'sending' && 'Sending...'}
              {status === 'sent' && 'Check Your Email'}
              {status === 'verifying' && 'Verifying...'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}