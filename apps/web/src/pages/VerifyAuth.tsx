import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';

export function VerifyAuthContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, isInitialized, isLoading, user } = useAuth();
  const verificationStarted = useRef(false);

  // Combined verification effect
  useEffect(() => {
    // Don't do anything if we've already started verifying or if we're not initialized
    if (verificationStarted.current || !isInitialized) {
      return;
    }

    // Don't verify if we already have a user
    if (user) {
      navigate('/', { replace: true });
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // Mark that we've started verification
    verificationStarted.current = true;

    // Do the verification
    api.auth.verifyToken(token)
      .then(result => {
        return login(result.token);
      })
      .then(success => {
        if (success) {
          navigate('/', { replace: true });
        } else {
          throw new Error('Login failed');
        }
      })
      .catch(error => {
        console.error('Verification failed:', error);
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      });
  }, [isInitialized, user, searchParams, login, navigate]);

  // Loading state
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h2 className="text-xl font-bold mb-4">Verifying your login...</h2>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}