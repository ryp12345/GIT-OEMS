import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePassword from '../pages/auth/ChangePassword';

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    if (!isProfileOpen) return;
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  const displayName = user?.email || 'User';
  const initials = (displayName?.[0] || 'U').toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="flex h-20 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 justify-center w-full">
          {/* <img src="/git_logo.jpg" alt="Git logo" className="h-10 w-10 rounded-md object-contain" /> */}
          <h1 className="br text-xl sm:text-2xl font-bold text-center text-slate-900">KLS-Gogte Institute of Technology</h1>
        </div>
        <div className="flex items-center justify-end space-x-3 relative">
          <div className="hidden md:block relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
            >
              <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold">
                {initials}
              </div>
              <span className="text-sm font-medium text-slate-700">{displayName}</span>
              <svg
                className={`w-4 h-4 text-slate-500 transition ${isProfileOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-sm font-medium text-slate-900 break-all">{displayName}</div>
                  <div className="mt-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {user?.role || 'User'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    setIsChangePasswordOpen(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  Change Password
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="md:hidden text-slate-700 hover:text-slate-900 focus:outline-none"
            aria-label="Open mobile menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>
      </div>
      {isMenuOpen && user && (
        <div className="md:hidden px-4 pb-4 space-y-2 border-t border-slate-100">
          <div className="text-sm text-slate-600 pt-3 break-all">{displayName}</div>
          <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            {user?.role || 'User'}
          </div>
          <button
            onClick={() => {
              setIsMenuOpen(false);
              setIsChangePasswordOpen(true);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm font-semibold"
          >
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition text-sm font-semibold"
          >
            Logout
          </button>
        </div>
      )}
      <ChangePassword
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
}
