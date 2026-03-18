import { useEffect, useState } from 'react';
import { changePassword } from '../../api/auth.api';

export default function ChangePassword({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setStatus({ type: '', text: '' });
      setFieldErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showMatchMessage = Boolean(newPassword) && Boolean(confirmPassword);
  const isPasswordMatch = showMatchMessage && newPassword === confirmPassword;

  const onSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: '', text: '' });

    const nextFieldErrors = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };

    if (!currentPassword || !newPassword || !confirmPassword) {
      if (!currentPassword) nextFieldErrors.currentPassword = 'Please enter your current password.';
      if (!newPassword) nextFieldErrors.newPassword = 'Please enter a new password.';
      if (!confirmPassword) nextFieldErrors.confirmPassword = 'Please confirm your new password.';
      setFieldErrors(nextFieldErrors);
      setStatus({ type: 'error', text: 'Please fill all required fields.' });
      return;
    }

    if (newPassword.length < 6) {
      nextFieldErrors.newPassword = 'New password must be at least 6 characters.';
      setFieldErrors(nextFieldErrors);
      setStatus({ type: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      nextFieldErrors.confirmPassword = 'New password and confirm password do not match.';
      setFieldErrors(nextFieldErrors);
      setStatus({ type: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }

    if (currentPassword === newPassword) {
      nextFieldErrors.newPassword = 'New password must be different from current password.';
      setFieldErrors(nextFieldErrors);
      setStatus({ type: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }

    setFieldErrors(nextFieldErrors);

    try {
      setIsSubmitting(true);
      const res = await changePassword({ currentPassword, newPassword });
      setStatus({ type: 'success', text: res?.data?.message || 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFieldErrors({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (requestError) {
      setStatus({
        type: 'error',
        text: requestError?.response?.data?.error || 'Unable to change password. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
          {status.text ? (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                status.type === 'success'
                  ? 'border border-green-200 bg-green-50 text-green-700'
                  : 'border border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {status.text}
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((prev) => ({ ...prev, currentPassword: '' }));
                  }
                  if (status.type === 'error') {
                    setStatus({ type: '', text: '' });
                  }
                }}
                className={`w-full rounded-lg px-3 py-2 pr-10 outline-none focus:ring-2 ${
                  fieldErrors.currentPassword
                    ? 'border border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border border-slate-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                disabled={isSubmitting}
              >
                {showCurrentPassword ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                    <path d="M9.88 5.09A10.94 10.94 0 0112 5c5.52 0 10 7 10 7a19.92 19.92 0 01-3.1 3.9" />
                    <path d="M6.61 6.61C3.67 8.29 2 12 2 12s4.48 7 10 7a9.78 9.78 0 004.39-1" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.currentPassword ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.currentPassword}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  if (fieldErrors.newPassword) {
                    setFieldErrors((prev) => ({ ...prev, newPassword: '' }));
                  }
                  if (status.type === 'error') {
                    setStatus({ type: '', text: '' });
                  }
                }}
                className={`w-full rounded-lg px-3 py-2 pr-10 outline-none focus:ring-2 ${
                  fieldErrors.newPassword
                    ? 'border border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border border-slate-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                disabled={isSubmitting}
              >
                {showNewPassword ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                    <path d="M9.88 5.09A10.94 10.94 0 0112 5c5.52 0 10 7 10 7a19.92 19.92 0 01-3.1 3.9" />
                    <path d="M6.61 6.61C3.67 8.29 2 12 2 12s4.48 7 10 7a9.78 9.78 0 004.39-1" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.newPassword ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.newPassword}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Use at least 6 characters and avoid reusing your current password.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }
                  if (status.type === 'error') {
                    setStatus({ type: '', text: '' });
                  }
                }}
                className={`w-full rounded-lg px-3 py-2 pr-10 outline-none focus:ring-2 ${
                  fieldErrors.confirmPassword
                    ? 'border border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border border-slate-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
                autoComplete="new-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                aria-label={showConfirmPassword ? 'Hide confirm new password' : 'Show confirm new password'}
                disabled={isSubmitting}
              >
                {showConfirmPassword ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                    <path d="M9.88 5.09A10.94 10.94 0 0112 5c5.52 0 10 7 10 7a19.92 19.92 0 01-3.1 3.9" />
                    <path d="M6.61 6.61C3.67 8.29 2 12 2 12s4.48 7 10 7a9.78 9.78 0 004.39-1" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
            ) : showMatchMessage ? (
              <p className={`mt-1 text-xs ${isPasswordMatch ? 'text-green-600' : 'text-red-600'}`}>
                {isPasswordMatch ? 'Passwords are matching.' : 'Passwords are not matching.'}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
