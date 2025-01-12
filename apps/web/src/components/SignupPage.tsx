import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type ApiError } from '@/lib/api';

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspaceId');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      await api.auth.requestMagicLink(email, { workspaceId: workspaceId || undefined });
      setStatus('sent');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || 'Failed to send magic link');
      setStatus('idle');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Join Workspace on Platica
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email to receive a magic link to join the workspace
          </p>
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

          {status === 'sent' && (
            <div className="text-green-600 text-sm">
              Check your email! We've sent you a magic link to join the workspace.
              <br />
              <span className="text-gray-500">
                The link will expire in 15 minutes. If you don't see it, check your spam folder.
              </span>
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
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 