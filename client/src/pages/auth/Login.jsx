
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
// import { getDashboardPathByRole } from '../../utils/role';
export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef(null);

  useEffect(() => {
    return () => {
      setError('');
    };
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const clearError = () => setError('');

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
    if (error) clearError();
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
    if (error) clearError();
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    try {
      setIsSubmitting(true);
      const nextUser = await login(username.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="w-[90vw] sm:w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-8 sm:px-8 shadow-xl overflow-hidden">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/git_logo.jpg" alt="Git logo" className="h-24 w-24 rounded-xl object-contain ring-1 ring-slate-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gogte Institute of Technology</h1>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">OEMS</h2>
        </div>
        {error ? (
          <div className="mb-5 p-3 bg-red-50 border border-red-300 rounded-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-lg flex-shrink-0">⚠️</span>
                <div className="flex-1 pt-1">
                  <p className="text-red-900 font-semibold text-sm">Login failed</p>
                  <p className="text-red-800 text-sm mt-1 leading-5">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearError}
                className="ml-2 text-red-600 hover:text-red-900 hover:bg-red-100 transition-colors flex-shrink-0 text-base p-1 rounded-md"
                title="Dismiss"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={handleUsernameChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  passwordRef.current?.focus();
                }
              }}
              placeholder="Enter your username"
              disabled={isSubmitting}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                ref={passwordRef}
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter your password"
                disabled={isSubmitting}
                required
                className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => !isSubmitting && setShowPassword(!showPassword)}
                className="absolute right-4 top-3 text-lg hover:opacity-70 transition disabled:cursor-not-allowed"
                disabled={isSubmitting}
                aria-label="Toggle password visibility"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Loading...' : 'Login'}
          </button>

          <div className="mt-2 text-center">
            <p className="text-sm text-slate-500">Forgot password?</p>
          </div>
          
        </form>
      </div>
    </div>
  );
}
