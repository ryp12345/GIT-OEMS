import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Optionally pass allowedRoles as prop for fine-grained protection
export default function ProtectedRoute({ allowedRoles }) {
	const location = useLocation();
	const { isAuthenticated, user } = useAuth();

	if (!isAuthenticated) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}

	if (allowedRoles && user && !allowedRoles.includes(user.role)) {
		// Optionally redirect to their dashboard if not allowed
		return <Navigate to={user ? `/` : '/login'} replace />;
	}

	return <Outlet />;
}