import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginStart, loginSuccess, loginFailure, selectAuth } from '../store/authSlice';



export function VerifyAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { currentUser, status } = useSelector(selectAuth);
  const verificationStarted = useRef(false);

  useEffect(() => {
    // Don't do anything if we've already started verifying
    if (verificationStarted.current) {
      return;
    }

    // Don't verify if we already have a user
    if (currentUser) {
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
    dispatch(loginStart());

    // Do the verification
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    fetch(`${API_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    })
      .then(response => {
        if (!response.ok) throw new Error('Verification failed');
        return response.json() 
      })
      .then(result => {
        // Store the token
        localStorage.setItem('auth_token', result.data.token);
        
        // Update auth state
        dispatch(loginSuccess({ user: result.data.user, token: result.data.token }));

        // Navigate to appropriate page
        if (result.data.workspaceId) {
          navigate(`/w/${result.data.workspaceId}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      })
      .catch(error => {
        console.error('Verification failed:', error);
        dispatch(loginFailure(error.message));
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      });
  }, [currentUser, searchParams, dispatch, navigate]);

  // Loading state
  if (status === 'loading') {
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