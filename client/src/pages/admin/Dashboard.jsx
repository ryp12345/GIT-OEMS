import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import Notification from '../../components/common/Notification';
import { useAdminInstance } from '../../context/AdminInstanceContext';
import {
	getInstances,
	getInstanceView,
	getPreferenceFormStatus,
	getPreferenceStatistics,
	getPreferenceStatisticsDetails,
	setPreferenceFormStatus
} from '../../api/instance.api';
import { getCourses } from '../../api/course.api';
import { getStudents } from '../../api/student.api';

export default function AdminDashboard() {
	const token = localStorage.getItem('token');
	const navigate = useNavigate();
	const { activeInstance, activeInstanceId, hasActiveInstance } = useAdminInstance();

	function isFormEnabled(value) {
		if (value === true || value === 1) return true;
		if (typeof value === 'string') {
			const normalized = value.trim().toLowerCase();
			return (
				normalized === '1' ||
				normalized === 'true' ||
				normalized === 't' ||
				normalized === 'enabled' ||
				normalized === 'active'
			);
		}
		return false;
	}

	const [instances, setInstances] = useState([]);
	const [students, setStudents] = useState([]);
	const [allStats, setAllStats] = useState({});
	const [instanceCourses, setInstanceCourses] = useState([]);

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

	const [selectedInstanceId, setSelectedInstanceId] = useState('');
	const [preferenceStats, setPreferenceStats] = useState([]);
	const [chartStats, setChartStats] = useState([]);
	const [electiveRows, setElectiveRows] = useState([]);
	const [electivePrefs, setElectivePrefs] = useState([]);
// Helper for dynamic preference columns
function getAllPreferences(rows) {
	const prefs = new Set();
	rows.forEach((row) => {
		Object.keys(row || {}).forEach((key) => {
			const match = /^p(\d+)_count$/i.exec(key);
			if (match) prefs.add(Number(match[1]));
		});
		if (Array.isArray(row?.preferences)) {
			row.preferences.forEach((p) => prefs.add(Number(p.prefIndex)));
		}
	});
	if (prefs.size === 0) return [1, 2];
	return Array.from(prefs).filter(Number.isFinite).sort((a, b) => a - b);
}

function formatGrade(value) {
	if (value == null || Number.isNaN(Number(value))) return '';
	return Number(value).toFixed(2);
}

function getFirstDefined(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null) return value;
	}
	return null;
}
// Fetch elective preferences for dashboard view
useEffect(() => {
	async function fetchElectivePrefs() {
		if (!activeInstanceId) {
			setElectiveRows([]);
			setElectivePrefs([]);
			return;
		}
		try {
			const res = await getPreferenceStatisticsDetails(activeInstanceId, token);
			const rows = Array.isArray(res?.data?.rows) ? res.data.rows : Array.isArray(res?.data) ? res.data : [];
			setElectiveRows(rows);
			setElectivePrefs(getAllPreferences(rows));
		} catch {
			setElectiveRows([]);
			setElectivePrefs([]);
		}
	}
	fetchElectivePrefs();
}, [activeInstanceId, token]);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedInstanceForForm, setSelectedInstanceForForm] = useState('');
	const [formEnabledStatus, setFormEnabledStatus] = useState('');
	const [isUpdating, setIsUpdating] = useState(false);

	const [showNoPrefModal, setShowNoPrefModal] = useState(false);
	const [noPrefStudents, setNoPrefStudents] = useState([]);
	const [noPrefLoading, setNoPrefLoading] = useState(false);

	useEffect(() => {
		loadDashboardData();
	}, [activeInstanceId]);

	async function loadDashboardData() {
		try {
			setIsLoading(true);
			setError('');

			const [instancesRes, studentsRes] = await Promise.all([
				getInstances(token),
				getStudents(token, activeInstanceId || null)
			]);

			const instancesData = Array.isArray(instancesRes?.data?.data)
				? instancesRes.data.data
				: Array.isArray(instancesRes?.data)
					? instancesRes.data
					: [];
			const normalizedInstances = instancesData.map((instance) => ({
				...instance,
				form_enabled: isFormEnabled(instance.status)
			}));
			const studentsData = Array.isArray(studentsRes?.data?.data)
				? studentsRes.data.data
				: Array.isArray(studentsRes?.data)
					? studentsRes.data
					: [];

			setInstances(normalizedInstances);
			setStudents(studentsData);

			const perInstanceStats = {};
			for (const instance of normalizedInstances) {
				try {
					const statsRes = await getPreferenceStatistics(instance.id, token);
					const statsArray = Array.isArray(statsRes?.data?.data)
						? statsRes.data.data
						: Array.isArray(statsRes?.data)
							? statsRes.data
							: [];
					perInstanceStats[instance.id] = statsArray;
				} catch (_err) {
					perInstanceStats[instance.id] = [];
				}
			}
			setAllStats(perInstanceStats);
		} catch (requestError) {
			setError(requestError?.response?.data?.error || 'Unable to load dashboard');
			setInstances([]);
			setStudents([]);
			setAllStats({});
		} finally {
			setIsLoading(false);
		}
	}

	async function loadInstanceCourses(instanceId) {
		if (!instanceId) {
			setInstanceCourses([]);
			return;
		}

		try {
			const response = await getInstanceView(instanceId, token);
			const data = response?.data?.data || response?.data || {};
			setInstanceCourses(Array.isArray(data?.courses) ? data.courses : []);
		} catch (_requestError) {
			setInstanceCourses([]);
		}
	}

	async function loadChartData(instanceId) {
		try {
			const response = await getPreferenceStatistics(Number(instanceId), token);
			const data = Array.isArray(response?.data?.data)
				? response.data.data
				: Array.isArray(response?.data)
					? response.data
					: [];
			setChartStats(data);
		} catch (_requestError) {
			setChartStats([]);
		}
	}

	async function loadTableData(instanceId) {
		try {
			const response = await getPreferenceStatistics(Number(instanceId), token);
			const data = Array.isArray(response?.data?.data)
				? response.data.data
				: Array.isArray(response?.data)
					? response.data
					: [];
			setPreferenceStats(data);
		} catch (_requestError) {
			setPreferenceStats([]);
		}
	}

	function showNotification(message, type = 'success') {
		setNotification({ show: true, message, type });
	}

	async function openNoPrefModal() {
		if (!activeInstanceId) {
			showNotification('Select an active instance first', 'error');
			return;
		}
		setShowNoPrefModal(true);
		setNoPrefStudents([]);
		setNoPrefLoading(true);
		try {
			const res = await getStudents(token, activeInstanceId, 'pending');
			const data = Array.isArray(res?.data?.data)
				? res.data.data
				: Array.isArray(res?.data)
					? res.data
					: [];
			setNoPrefStudents(data);
		} catch {
			setNoPrefStudents([]);
		} finally {
			setNoPrefLoading(false);
		}
	}

	function openPreferenceFormModal() {
		setIsModalOpen(true);
		setSelectedInstanceForForm('');
		setFormEnabledStatus('');
		setError('');
	}

	function closePreferenceFormModal() {
		setIsModalOpen(false);
		setSelectedInstanceForForm('');
		setFormEnabledStatus('');
		setError('');
	}

	async function handleInstanceForFormChange(instanceId) {
		setSelectedInstanceForForm(instanceId);
		if (!instanceId) {
			setFormEnabledStatus('');
			return;
		}

		try {
			const response = await getPreferenceFormStatus(instanceId, token);
			const enabled = Boolean(response?.data?.enabled);
			setFormEnabledStatus(enabled ? '1' : '0');
		} catch (_requestError) {
			const instance = instances.find((row) => String(row.id) === String(instanceId));
			const current = instance?.form_enabled ? '1' : '0';
			setFormEnabledStatus(current);
		}
	}

	async function handleUpdatePreferenceFormStatus(event) {
		event.preventDefault();

		if (!selectedInstanceForForm) {
			setError('Please select an elective instance');
			return;
		}

		if (formEnabledStatus === '') {
			setError('Please select enabled or disabled');
			return;
		}

		try {
			setIsUpdating(true);
			setError('');

			await setPreferenceFormStatus(selectedInstanceForForm, formEnabledStatus === '1', token);
			showNotification('Preference form status updated successfully.', 'success');
			closePreferenceFormModal();
			await loadDashboardData();
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to update preference form status';
			setError(message);
			showNotification(message, 'error');
		} finally {
			setIsUpdating(false);
		}
	}

	async function handleInstanceSelectionForStats(instanceId) {
		setSelectedInstanceId(String(instanceId));
		if (instanceId) {
			const numericId = Number(instanceId);
			await Promise.all([
				loadChartData(numericId),
				loadTableData(numericId),
				loadInstanceCourses(numericId)
			]);
		} else {
			setPreferenceStats([]);
			setChartStats([]);
			setInstanceCourses([]);
		}
	}

	useEffect(() => {
		if (!activeInstanceId) {
			setSelectedInstanceId('');
			setPreferenceStats([]);
			setChartStats([]);
			setInstanceCourses([]);
			return;
		}

		handleInstanceSelectionForStats(activeInstanceId);
	}, [activeInstanceId]);

	const enabledPreferenceForms = useMemo(
		() => instances.filter((instance) => Boolean(instance.form_enabled)).length,
		[instances]
	);

	const activeInstances = useMemo(
		() => instances.filter((instance) => String(instance.status || '').toLowerCase() === 'active').length,
		[instances]
	);

	const overallTotals = useMemo(() => {
		let submitted = 0;
		let pending = 0;
		let total = 0;

		Object.values(allStats).forEach((rows) => {
			rows.forEach((row) => {
				submitted += Number(row.submitted || 0);
				pending += Number(row.pending || 0);
				total += Number(row.total || 0);
			});
		});

		return {
			submitted,
			pending,
			total,
			completionPercent: total > 0 ? ((submitted / total) * 100).toFixed(1) : '0.0'
		};
	}, [allStats]);

	const selectedTotals = useMemo(
		() => ({
			submitted: preferenceStats.reduce((sum, row) => sum + Number(row.submitted || 0), 0),
			pending: preferenceStats.reduce((sum, row) => sum + Number(row.pending || 0), 0),
			total: preferenceStats.reduce((sum, row) => sum + Number(row.total || 0), 0)
		}),
		[preferenceStats]
	);

	const studentsInActiveInstance = useMemo(() => {
		if (!hasActiveInstance) return 0;
		return students.length;
	}, [students, hasActiveInstance]);

	const coursesInActiveInstance = useMemo(() => (
		hasActiveInstance ? instanceCourses.length : 0
	), [instanceCourses, hasActiveInstance]);

	   const displayStats = [
		   {
			   label: 'Students In Selected Instance',
			   value: studentsInActiveInstance,
			   icon: 'ion-person-stalker',
			   color: 'bg-sky-600'
		   },
		   {
			   label: 'Courses Floated In Selected Instance',
			   value: coursesInActiveInstance,
			   icon: 'ion-university',
			   color: 'bg-indigo-600'
		   },
		   {
			   label: 'Students Registered Preferences',
			   value: selectedTotals.submitted,
			   icon: 'ion-ios-pulse-strong',
			   color: 'bg-emerald-600'
		   },
		   {
			   label: 'Pending',
			   value: selectedTotals.pending,
			   icon: 'ion-alert-circled',
			   color: 'bg-amber-600'
		   },
		   {
			   label: 'Completion',
			   value: selectedTotals.total > 0 ? ((selectedTotals.submitted / selectedTotals.total) * 100).toFixed(1) + '%' : '0.0%',
			   icon: 'ion-checkmark-circled',
			   color: 'bg-indigo-800'
		   }
	   ];

	return (
		<div className="flex h-screen">
			<Sidebar />
			<div className="flex-1 flex flex-col min-h-0">
				<Header />
				<main className="flex-1 overflow-auto p-6 md:p-8 bg-slate-100">
					<div className="max-w-7xl mx-auto space-y-8">
						<div>
							<h1 className="text-4xl font-extrabold text-slate-900 mb-2">Dashboard</h1>
							<p className="text-base md:text-lg text-slate-600">Open Elective Management System overview.</p>
						</div>

						<Notification
							show={notification.show}
							message={notification.message}
							type={notification.type}
							position="topRight"
							onClose={() => setNotification({ show: false, message: '', type: 'info' })}
						/>

						{error && (
							<div className="p-3 rounded border border-red-200 text-red-700 bg-red-50 text-sm">{error}</div>
						)}

						{hasActiveInstance ? (
							<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
								Active Instance: {activeInstance?.instancename || '-'} ({activeInstance?.academic_year || '-'}, Sem {activeInstance?.semester || '-'})
							</div>
						) : (
							<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
								Please select an elective instance from Elective Instance page.
							</div>
						)}

						{isLoading ? (
							<div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">Loading dashboard data...</div>
						) : (
							<>
								   <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
									   {displayStats.map((stat) => (
										   <div
											   key={stat.label}
											   className={`${stat.color} rounded-lg shadow p-4 min-h-[90px] flex flex-col justify-center items-start text-white transition`}
										   >
											   <div className="flex items-start justify-between w-full gap-2">
												   <div>
													   <p className="text-2xl font-extrabold leading-none">{stat.value}</p>
													   <p className="mt-1 text-sm font-medium opacity-95">{stat.label}</p>
												   </div>
												   <i className={`ion ${stat.icon} text-3xl opacity-40`} />
											   </div>
										   </div>
									   ))}
								   </div>

								   {/* Removed Overall Performance section as requested */}

							

								{/* Quick Actions moved above tables */}
								<div className="bg-gradient-to-r from-sky-700 to-indigo-700 rounded-xl shadow-lg p-6 text-white mb-8">
									<h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
									<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
										{/* <button
											type="button"
											onClick={() => navigate('/courses')}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Manage Courses</p>
											<p className="text-xs opacity-90">Create and update courses</p>
										</button> */}

										{/* Allocation Button */}
										<button
											type="button"
											onClick={() => navigate('/allocation')}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Allocation</p>
											<p className="text-xs opacity-90">Run and view allocations</p>
										</button>
										<button
											type="button"
											onClick={() => navigate('/students')}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Manage Students</p>
											<p className="text-xs opacity-90">Add, edit, and import students</p>
										</button>
										<button
											type="button"
											onClick={() => {
												if (!activeInstanceId) return showNotification('Select an active instance first', 'error');
												navigate(`/students?pref_status=submitted&instance_id=${activeInstanceId}`);
											}}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Submitted Students</p>
											<p className="text-xs opacity-90">View students who submitted preferences</p>
										</button>
										<button
											type="button"
											onClick={() => {
												if (!activeInstanceId) return showNotification('Select an active instance first', 'error');
												navigate(`/students?pref_status=pending&instance_id=${activeInstanceId}`);
											}}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Pending Students</p>
											<p className="text-xs opacity-90">View students who haven't submitted</p>
										</button>
										{/* <button
											type="button"
											onClick={() => navigate('/elective-instance')}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Manage Instances</p>
											<p className="text-xs opacity-90">Create and configure instances</p>
										</button> */}
										<button
											type="button"
											onClick={openPreferenceFormModal}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Preference Form</p>
											<p className="text-xs opacity-90">Enable or disable form access</p>
										</button>
										<button
											type="button"
											onClick={openNoPrefModal}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">No Preference Submitted</p>
											<p className="text-xs opacity-90">Students yet to submit preferences</p>
										</button>
									</div>
								</div>
								<div>
									<div className="flex items-center justify-between mb-3">
										<h2 className="text-2xl font-bold text-slate-900">Instance Overview</h2>
									</div>
							   </div>
								{isModalOpen && (
									<div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
										<div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
											<div className="fixed inset-0 transition-opacity bg-slate-500 bg-opacity-75" onClick={closePreferenceFormModal} />
											<div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
												<div className="px-6 py-4 bg-sky-700">
													<div className="flex items-center justify-between">
														<h3 className="text-lg font-medium leading-6 text-white">Enable / Disable Student Preference Form</h3>
														<button className="text-white hover:text-slate-200" onClick={closePreferenceFormModal}>
															<svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
															</svg>
														</button>
													</div>
												</div>
												<form onSubmit={handleUpdatePreferenceFormStatus}>
													<div className="px-6 py-5 bg-white">
														<div className="mb-6">
															<label className="block mb-2 text-sm font-medium text-slate-700">Elective Instance *</label>
															<select
																value={selectedInstanceForForm}
																onChange={(event) => handleInstanceForFormChange(event.target.value)}
																className="block w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
																required
															>
																<option value="">Select Elective Instance</option>
																{instances.map((instance) => (
																	<option key={instance.id} value={String(instance.id)}>
																		{instance.instancename} ({instance.academic_year}, Sem {instance.semester})
																	</option>
																))}
															</select>
														</div>

														{selectedInstanceForForm && (
															<div className="mb-6">
																<label className="block mb-2 text-sm font-medium text-slate-700">Enabled / Disabled *</label>
																<select
																	value={formEnabledStatus}
																	onChange={(event) => setFormEnabledStatus(event.target.value)}
																	className="block w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
																	required
																>
																	<option value="">Select one</option>
																	<option value="1">Enabled</option>
																	<option value="0">Disabled</option>
																</select>
															</div>
														)}
													</div>
													<div className="px-6 py-4 bg-slate-50 border-t border-slate-200 sm:flex sm:flex-row-reverse gap-3">
														<button
															type="submit"
															disabled={isUpdating}
															className="w-full inline-flex justify-center rounded-lg border border-transparent bg-sky-700 px-4 py-2 text-base font-medium text-white shadow hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 sm:ml-3 sm:w-auto disabled:opacity-50"
														>
															{isUpdating ? 'Saving...' : 'Save'}
														</button>
														<button
															type="button"
															onClick={closePreferenceFormModal}
															className="mt-3 w-full inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto"
														>
															Close
														</button>
														<a
															href="/student/registration"
															target="_blank"
															rel="noreferrer"
															className="mt-3 w-full inline-flex justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:mt-0 sm:w-auto"
														>
															Preview
														</a>
													</div>
												</form>
											</div>
										</div>
									</div>
								)}

								{showNoPrefModal && (
							<div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
								<div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
									<div className="fixed inset-0 transition-opacity bg-slate-500 bg-opacity-75" onClick={() => setShowNoPrefModal(false)} />
									<div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
										<div className="px-6 py-4 bg-sky-700">
											<div className="flex items-center justify-between">
												<h3 className="text-lg font-medium leading-6 text-white">
													Students Without Preferences
													{activeInstance && (
														<span className="ml-2 text-sm font-normal opacity-90">
															— {activeInstance.instancename} ({activeInstance.academic_year}, Sem {activeInstance.semester})
														</span>
													)}
												</h3>
												<button className="text-white hover:text-slate-200" onClick={() => setShowNoPrefModal(false)}>
													<svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											</div>
										</div>
										<div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
											{noPrefLoading ? (
												<div className="py-10 text-center text-slate-500">Loading...</div>
											) : noPrefStudents.length === 0 ? (
												<div className="py-10 text-center text-slate-500">All students have submitted their preferences.</div>
											) : (
												<>
													<p className="text-sm text-slate-600 mb-3">{noPrefStudents.length} student(s) have not submitted preferences.</p>
													<table className="min-w-full border-collapse">
														<thead>
															<tr className="bg-blue-600 text-white">
																<th className="border px-4 py-2 text-left text-xs uppercase">Sl.No</th>
																<th className="border px-4 py-2 text-left text-xs uppercase">Name</th>
																<th className="border px-4 py-2 text-left text-xs uppercase">USN</th>
																<th className="border px-4 py-2 text-left text-xs uppercase">Department</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-slate-200">
															{noPrefStudents.map((student, idx) => (
																<tr key={student.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
																	<td className="border px-4 py-2 text-sm text-slate-700">{idx + 1}</td>
																	<td className="border px-4 py-2 text-sm text-slate-900 font-medium">{student.name}</td>
																	<td className="border px-4 py-2 text-sm text-slate-700">{student.usn}</td>
																	<td className="border px-4 py-2 text-sm text-slate-700">{student.department_name || student.department_shortname || '-'}</td>
																</tr>
															))}
														</tbody>
													</table>
												</>
											)}
										</div>
										<div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
											<button
												type="button"
												onClick={() => setShowNoPrefModal(false)}
												className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
											>
												Close
											</button>
										</div>
									</div>
								</div>
							</div>
						)}

						<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
										{/* Elective Preferences Table (read-only) */}
										<div className="bg-white rounded-xl shadow-lg p-6 min-h-[500px]">
											<h2 className="text-xl font-semibold text-slate-900 mb-6">Elective Preferences </h2>
											<div className="overflow-x-auto">
												<table className="min-w-full border-collapse">
													<thead>
														<tr className="bg-blue-600 text-white">
															<th className="border px-4 py-3 text-left text-xs uppercase" rowSpan={2}>Sl.No</th>
															<th className="border px-4 py-3 text-left text-xs uppercase" rowSpan={2}>Course Name</th>
															<th className="border px-4 py-3 text-center text-xs uppercase" colSpan={electivePrefs.length * 4}>Preferences</th>
															<th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Div</th>
															<th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Min</th>
															<th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Max</th>
															<th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Allocations</th>
															<th className="border px-4 py-3 text-center text-xs uppercase" rowSpan={2}>Status</th>
														</tr>
														<tr className="bg-blue-600 text-white">
															{electivePrefs.map((pref) => [
																<th key={`p${pref}_count`} className="border px-3 py-2 text-center text-xs font-semibold">{pref}</th>,
																<th key={`p${pref}_min`} className="border px-3 py-2 text-center text-xs">Min</th>,
																<th key={`p${pref}_median`} className="border px-3 py-2 text-center text-xs">Median</th>,
																<th key={`p${pref}_max`} className="border px-3 py-2 text-center text-xs">Max</th>
															])}
														</tr>
													</thead>
													<tbody>
														{electiveRows.length === 0 ? (
															<tr>
																<td colSpan={electivePrefs.length * 4 + 7} className="px-6 py-12 text-center text-gray-500">
																	{hasActiveInstance ? 'No elective preference data available for this instance' : 'Select an instance to view preferences.'}
																</td>
															</tr>
														) : (
															electiveRows.map((row, index) => {
																const getPreferenceCell = (pref) => {
																	const count = getFirstDefined(row[`p${pref}_count`], row[`p${pref}_cnt`]);
																	const min = getFirstDefined(row[`p${pref}_min_grade`], row[`p${pref}_min`]);
																	const median = getFirstDefined(
																		row[`p${pref}_median_grade`],
																		row[`p${pref}_medium_grade`],
																		row[`p${pref}_median`],
																		row[`p${pref}_medium`]
																	);
																	const max = getFirstDefined(row[`p${pref}_max_grade`], row[`p${pref}_max`]);
																	if (
																		count == null &&
																		min == null &&
																		median == null &&
																		max == null &&
																		Array.isArray(row.preferences)
																	) {
																		const legacy = row.preferences.find((p) => Number(p.prefIndex) === pref) || {};
																		return {
																			count: getFirstDefined(legacy.count, legacy.total),
																			min_grade: getFirstDefined(legacy.min_grade, legacy.min),
																			median_grade: getFirstDefined(
																				legacy.median_grade,
																				legacy.medium_grade,
																				legacy.median,
																				legacy.medium
																			),
																			max_grade: getFirstDefined(legacy.max_grade, legacy.max)
																		};
																	}
																	return {
																		count,
																		min_grade: min,
																		median_grade: median,
																		max_grade: max
																	};
																};
																return (
																	<tr key={`${row.coursecode}-${index}`} className="border-b border-gray-200">
																		<td className="border px-3 py-2 text-sm">{index + 1}</td>
																		<td className="border px-3 py-2 text-sm">{row.coursename} ({row.coursecode})</td>
																		{electivePrefs.map((pref) => {
																			const p = getPreferenceCell(pref);
																			return [
																				<td key={`p${pref}_count`} className="border border-l-2 border-r-2 border-blue-600 px-3 py-2 text-center text-sm font-bold">{p.count ?? ''}</td>,
																				<td key={`p${pref}_min`} className="border px-3 py-2 text-center text-sm">{formatGrade(p.min_grade)}</td>,
																				<td key={`p${pref}_median`} className="border px-3 py-2 text-center text-sm">{formatGrade(p.median_grade)}</td>,
																				<td key={`p${pref}_max`} className="border px-3 py-2 text-center text-sm">{formatGrade(p.max_grade)}</td>
																			];
																		})}
																		<td className="border px-3 py-2 text-center text-sm">{row.division}</td>
																		<td className="border px-3 py-2 text-center text-sm">{row.min_intake}</td>
																		<td className="border px-3 py-2 text-center text-sm">{row.max_intake}</td>
																		<td className="border border-l-2 border-r-2 border-blue-600 px-3 py-2 text-center text-sm font-bold">{row.total_allocations}</td>
																		<td className="border px-3 py-2 text-center text-sm font-bold">{row.allocation_status}</td>
																	</tr>
																);
															})
														)}
													</tbody>
												</table>
											</div>
										</div>
									{/* <div className="bg-white rounded-xl shadow-lg p-6">
										<h2 className="text-xl font-semibold text-slate-900 mb-6">Elective Preference Statistics</h2>
										{chartStats.length > 0 ? (
											<div className="space-y-4">
												{chartStats.map((stat) => {
													const total = Number(stat.total || 0);
													const submitted = Number(stat.submitted || 0);
													const pending = Number(stat.pending || 0);
													const submittedPercent = total > 0 ? ((submitted / total) * 100).toFixed(1) : '0.0';
													const pendingPercent = total > 0 ? ((pending / total) * 100).toFixed(1) : '0.0';

													return (
														<div key={stat.slNo} className="space-y-2">
															<div className="flex items-center justify-between">
																<span className="font-medium text-slate-700">{stat.department}</span>
																<span className="text-sm text-slate-500">{submitted}/{total}</span>
															</div>
															<div className="w-full bg-slate-200 rounded-full h-3">
																<div className="bg-emerald-500 h-3 rounded-full transition-all duration-300" style={{ width: `${submittedPercent}%` }} />
															</div>
															<div className="flex justify-between text-xs text-slate-500">
																<span>Submitted: {submittedPercent}%</span>
																<span>Pending: {pendingPercent}%</span>
															</div>
														</div>
													);
												})}
											</div>
										) : (
											<div className="h-56 flex items-center justify-center bg-slate-50 rounded-lg">
													<p className="text-slate-500">{hasActiveInstance ? 'No chart data available for this instance' : 'Select an active instance to view chart data'}</p>
											</div>
										)}
									</div> */}

									<div className="bg-white rounded-xl shadow-lg p-6 min-h-[500px]">
										<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
											<h2 className="text-xl font-semibold text-slate-900">Student Preference Status</h2>
											<div className="w-full sm:w-auto rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
												{hasActiveInstance
													? `${activeInstance?.instancename || '-'} (${activeInstance?.academic_year || '-'}, Sem ${activeInstance?.semester || '-'})`
													: 'No active instance selected'}
											</div>
										</div>

										{preferenceStats.length > 0 ? (
											<div className="overflow-x-auto">
										<table className="min-w-full divide-y divide-slate-200 border border-slate-200">
											<thead>
												<tr className="bg-blue-600 text-white">
													<th className="px-4 py-3 text-left text-xs font-semibold uppercase">Sl.No</th>
													<th className="px-4 py-3 text-left text-xs font-semibold uppercase">Department</th>
													<th className="px-4 py-3 text-center text-xs font-semibold uppercase">Submitted</th>
													<th className="px-4 py-3 text-center text-xs font-semibold uppercase">Pending</th>
													<th className="px-4 py-3 text-center text-xs font-semibold uppercase">Total</th>
												</tr>
											</thead>
													<tbody className="divide-y divide-slate-200 bg-white">
														{preferenceStats.map((row, idx) => (
															<tr key={`${row.slNo}-${row.department}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
																<td className="px-4 py-3 text-sm font-medium text-slate-900">{row.slNo}</td>
																<td className="px-4 py-3 text-sm text-slate-700">{row.department}</td>
																<td className="px-4 py-3 text-sm text-center text-emerald-700 font-semibold">{row.submitted}</td>
																<td className="px-4 py-3 text-sm text-center text-amber-700 font-semibold">{row.pending}</td>
																<td className="px-4 py-3 text-sm text-center font-semibold text-slate-900">{row.total}</td>
															</tr>
														))}
													</tbody>
													<tfoot className="bg-slate-100 border-t-2 border-slate-300">
														<tr>
															<td colSpan="2" className="px-4 py-3 text-sm font-bold text-slate-900">Total</td>
															<td className="px-4 py-3 text-sm text-center font-bold text-emerald-800">{selectedTotals.submitted}</td>
															<td className="px-4 py-3 text-sm text-center font-bold text-amber-800">{selectedTotals.pending}</td>
															<td className="px-4 py-3 text-sm text-center font-bold text-slate-900">{selectedTotals.total}</td>
														</tr>
													</tfoot>
												</table>
											</div>
										) : hasActiveInstance ? (
											<div className="py-12 text-center text-sm text-slate-500">No preference data available for this instance</div>
										) : (
											<div className="py-12 text-center text-sm text-slate-500">Select an active instance to view preference statistics</div>
										)}
									</div>
								</div>

								
							</>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
