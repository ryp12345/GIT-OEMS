// Utility to get dashboard path by role
export function getDashboardPathByRole(role) {
  if (role === 'admin') return '/dashboard';
  if (role === 'dean') return '/dean/dashboard';
  if (role === 'hod') return '/hod/dashboard';
  return '/dashboard'; // fallback
}
