import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GithubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const handleCallback = async () => {
      const token = searchParams.get('token');
      const error = searchParams.get('error');
      const provider = window.location.pathname.includes('/auth/google/callback')
        ? 'Google'
        : 'GitHub';

      if (error) {
        toast.error(`${provider} login failed. Please try again.`, { id: 'oauth-login-status' });
        navigate('/login');
        return;
      }

      if (token) {
        await loginWithToken(token);
        toast.success(`Signed in with ${provider}!`, { id: 'oauth-login-status' });
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    };

    handleCallback();
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Completing GitHub sign in...</p>
      </div>
    </div>
  );
}
