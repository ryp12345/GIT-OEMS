import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './context/AuthContext';
import Login from './pages/auth/Login';
import ChangePassword from './pages/auth/ChangePassword';
import CoursesPage from './pages/admin/Courses';
import AdminDashboard from './pages/admin/Dashboard';
import ElectiveInstancePage from './pages/admin/ElectiveInstance';
import ElectiveInstanceViewPage from './pages/admin/ElectiveInstanceView';
import StudentsPage from './pages/admin/Students';
import ElectivePreferencePage from './pages/admin/ElectivePreference';
import AllocationPage from './pages/admin/Allocation';
import Reports from './pages/admin/Reports';
import StudentRegistrationPage from './pages/student/Registration';
import CheckNamePage from './pages/student/CheckName';

export default function App(){
	return (
		<AuthProvider>
			<BrowserRouter>
				<Routes>
					<Route path="/login" element={<Login/>} />
					<Route path="/change-password" element={<ChangePassword />} />
					<Route path="/dashboard" element={<AdminDashboard />} />
					<Route path="/courses" element={<CoursesPage />} />
					<Route path="/elective-instance" element={<ElectiveInstancePage />} />
					<Route path="/elective-instance/:id/view" element={<ElectiveInstanceViewPage />} />
					<Route path="/elective-preference" element={<ElectivePreferencePage />} />
					<Route path="/allocation" element={<AllocationPage />} />
					<Route path="/reports" element={<Reports />} />
					<Route path="/student/registration" element={<StudentRegistrationPage />} />
					<Route path="/student/check" element={<CheckNamePage />} />
					<Route path="/students" element={<StudentsPage />} />
					<Route path="/" element={<Navigate to="/login" replace />} />
				</Routes>
			</BrowserRouter>
		</AuthProvider>
	);
}
