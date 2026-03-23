import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import Notification from '../../components/common/Notification';
import { getInstances, getPreferenceStatistics, setPreferenceFormStatus } from '../../api/instance.api';
import { getCourses } from '../../api/course.api';
import { getStudents } from '../../api/student.api';

export default function AdminDashboard() {
	const token = localStorage.getItem('token');
	const navigate = useNavigate();

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
	const [courses, setCourses] = useState([]);
	const [students, setStudents] = useState([]);
	const [allStats, setAllStats] = useState({});

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

	const [selectedInstanceId, setSelectedInstanceId] = useState('');
	const [preferenceStats, setPreferenceStats] = useState([]);
	const [chartStats, setChartStats] = useState([]);

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedInstanceForForm, setSelectedInstanceForForm] = useState('');
	const [formEnabledStatus, setFormEnabledStatus] = useState('');
	const [isUpdating, setIsUpdating] = useState(false);

	useEffect(() => {
		loadDashboardData();
	}, []);

	async function loadDashboardData() {
		try {
			setIsLoading(true);
			setError('');

			const [instancesRes, coursesRes, studentsRes] = await Promise.all([
				getInstances(token),
				getCourses(token),
				getStudents(token)
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
			const coursesData = Array.isArray(coursesRes?.data?.data)
				? coursesRes.data.data
				: Array.isArray(coursesRes?.data)
					? coursesRes.data
					: [];
			const studentsData = Array.isArray(studentsRes?.data?.data)
				? studentsRes.data.data
				: Array.isArray(studentsRes?.data)
					? studentsRes.data
					: [];

			setInstances(normalizedInstances);
			setCourses(coursesData);
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
			setCourses([]);
			setStudents([]);
			setAllStats({});
		} finally {
			setIsLoading(false);
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

	function handleInstanceForFormChange(instanceId) {
		setSelectedInstanceForForm(instanceId);
		if (instanceId) {
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
			await Promise.all([loadChartData(numericId), loadTableData(numericId)]);
		} else {
			setPreferenceStats([]);
			setChartStats([]);
		}
	}

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

	const displayStats = [
		{
			label: 'Total Students',
			value: students.length,
			icon: 'ion-person-stalker',
			color: 'bg-sky-600'
		},
		{
			label: 'Total Courses',
			value: courses.length,
			icon: 'ion-university',
			color: 'bg-indigo-600'
		},
		{
			label: 'Active Instances',
			value: activeInstances,
			icon: 'ion-ios-pulse-strong',
			color: 'bg-emerald-600'
		},
		{
			label: 'Forms Enabled',
			value: enabledPreferenceForms,
			icon: 'ion-checkmark-circled',
			color: 'bg-amber-600',
			clickable: true
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
							onClose={() => setNotification({ show: false, message: '', type: 'info' })}
						/>

						{error && (
							<div className="p-3 rounded border border-red-200 text-red-700 bg-red-50 text-sm">{error}</div>
						)}

						{isLoading ? (
							<div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">Loading dashboard data...</div>
						) : (
							<>
								<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
									{displayStats.map((stat) => (
										<div
											key={stat.label}
											className={`${stat.color} rounded-xl shadow-lg p-5 text-white ${stat.clickable ? 'cursor-pointer hover:shadow-xl' : ''} transition`}
											onClick={() => stat.clickable && openPreferenceFormModal()}
										>
											<div className="flex items-start justify-between gap-3">
												<div>
													<p className="text-3xl font-extrabold leading-none">{stat.value}</p>
													<p className="mt-2 text-sm font-medium opacity-95">{stat.label}</p>
												</div>
												<i className={`ion ${stat.icon} text-4xl opacity-40`} />
											</div>
										</div>
									))}
								</div>

								<div className="bg-white rounded-xl shadow-lg p-6">
									<h2 className="text-xl font-semibold text-slate-900 mb-5">Overall Performance</h2>
									<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
										<div className="rounded-lg p-4 bg-sky-50 border border-sky-200">
											<p className="text-sm text-sky-700">Instances</p>
											<p className="text-2xl font-bold text-sky-900">{instances.length}</p>
										</div>
										<div className="rounded-lg p-4 bg-emerald-50 border border-emerald-200">
											<p className="text-sm text-emerald-700">Submitted</p>
											<p className="text-2xl font-bold text-emerald-900">{overallTotals.submitted}</p>
										</div>
										<div className="rounded-lg p-4 bg-amber-50 border border-amber-200">
											<p className="text-sm text-amber-700">Pending</p>
											<p className="text-2xl font-bold text-amber-900">{overallTotals.pending}</p>
										</div>
										<div className="rounded-lg p-4 bg-indigo-50 border border-indigo-200">
											<p className="text-sm text-indigo-700">Completion</p>
											<p className="text-2xl font-bold text-indigo-900">{overallTotals.completionPercent}%</p>
										</div>
									</div>
								</div>

								<div>
									<div className="flex items-center justify-between mb-3">
										<h2 className="text-2xl font-bold text-slate-900">Instance Overview</h2>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
										{instances.length === 0 && (
											<div className="col-span-full py-10 text-center bg-white rounded-lg shadow text-slate-500">
												No instances available
											</div>
										)}
										{instances.map((instance) => {
											const rows = allStats[instance.id] || [];
											const submitted = rows.reduce((sum, row) => sum + Number(row.submitted || 0), 0);
											const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
											const completion = total > 0 ? ((submitted / total) * 100).toFixed(1) : '0.0';
											const isActive = String(instance.status || '').toLowerCase() === 'active';

											return (
												<div key={instance.id} className="bg-white rounded-xl shadow p-5 border-l-4 border-sky-500">
													<div className="flex items-start justify-between gap-3 mb-3">
														<div>
															<p className="font-bold text-slate-900">{instance.instancename}</p>
															<p className="text-xs text-slate-500">
																{instance.academic_year}, Sem {instance.semester}
															</p>
														</div>
														<span
															className={`px-2 py-1 rounded text-xs font-semibold ${
																isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
															}`}
														>
															{instance.status || 'unknown'}
														</span>
													</div>
													<div className="space-y-2 text-sm mb-3">
														<div className="flex items-center justify-between">
															<span className="text-slate-600">Form</span>
															<span className="font-semibold text-slate-800">
																{instance.form_enabled ? 'Enabled' : 'Disabled'}
															</span>
														</div>
														<div className="flex items-center justify-between">
															<span className="text-slate-600">Completion</span>
															<span className="font-semibold text-sky-700">{completion}%</span>
														</div>
													</div>
													<div className="w-full h-2 rounded bg-slate-200">
														<div
															className="h-2 rounded bg-gradient-to-r from-emerald-500 to-sky-500"
															style={{ width: `${completion}%` }}
														/>
													</div>
												</div>
											);
										})}
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
													</div>
												</form>
											</div>
										</div>
									</div>
								)}

								<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
									<div className="bg-white rounded-xl shadow-lg p-6">
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
												<p className="text-slate-500">Select an instance to view chart data</p>
											</div>
										)}
									</div>

									<div className="bg-white rounded-xl shadow-lg p-6">
										<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
											<h2 className="text-xl font-semibold text-slate-900">Student Preference Status</h2>
											<div className="w-full sm:w-72">
												<select
													value={String(selectedInstanceId)}
													onChange={(event) => handleInstanceSelectionForStats(event.target.value)}
													className="block w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm"
												>
													<option value="">Select Elective Instance</option>
													{instances.map((instance) => (
														<option key={instance.id} value={String(instance.id)}>
															{instance.instancename} ({instance.academic_year}, Sem {instance.semester})
														</option>
													))}
												</select>
											</div>
										</div>

										{preferenceStats.length > 0 ? (
											<div className="overflow-x-auto">
												<table className="min-w-full divide-y divide-slate-200 border border-slate-200">
													<thead className="bg-slate-100">
														<tr>
															<th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Sl.No</th>
															<th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Department</th>
															<th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Submitted</th>
															<th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Pending</th>
															<th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Total</th>
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
										) : selectedInstanceId ? (
											<div className="py-12 text-center text-sm text-slate-500">No preference data available for this instance</div>
										) : (
											<div className="py-12 text-center text-sm text-slate-500">Select an instance to view preference statistics</div>
										)}
									</div>
								</div>

								<div className="bg-gradient-to-r from-sky-700 to-indigo-700 rounded-xl shadow-lg p-6 text-white">
									<h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
									<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
										<button
											type="button"
											onClick={() => navigate('/courses')}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Manage Courses</p>
											<p className="text-xs opacity-90">Create and update courses</p>
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
											onClick={() => navigate('/elective-instance')}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Manage Instances</p>
											<p className="text-xs opacity-90">Create and configure instances</p>
										</button>
										<button
											type="button"
											onClick={openPreferenceFormModal}
											className="bg-white/15 hover:bg-white/25 rounded-lg p-4 text-left transition"
										>
											<p className="font-semibold">Preference Form</p>
											<p className="text-xs opacity-90">Enable or disable form access</p>
										</button>
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
