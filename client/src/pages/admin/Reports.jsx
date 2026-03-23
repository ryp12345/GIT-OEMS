import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import Notification from '../../components/common/Notification';
import { 
	getInstances, 
	getPreferenceStatisticsDetails,
	getPreferenceStatistics 
} from '../../api/instance.api';
import { getCourses } from '../../api/course.api';
import { getStudents } from '../../api/student.api';

export default function Reports() {
	const token = localStorage.getItem('token');

	const [instances, setInstances] = useState([]);
	const [courses, setCourses] = useState([]);
	const [students, setStudents] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
	const [selectedInstanceId, setSelectedInstanceId] = useState('');
	const [reportData, setReportData] = useState(null);

	useEffect(() => {
		loadInitialData();
	}, []);

	useEffect(() => {
		if (selectedInstanceId) {
			loadReportData(selectedInstanceId);
		}
	}, [selectedInstanceId]);

	async function loadInitialData() {
		try {
			setIsLoading(true);
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

			setInstances(instancesData);
			setCourses(coursesData);
			setStudents(studentsData);

			if (instancesData.length > 0) {
				setSelectedInstanceId(String(instancesData[0].id));
			}
		} catch (error) {
			showNotification('Failed to load report data', 'error');
			console.error('Error loading initial data:', error);
		} finally {
			setIsLoading(false);
		}
	}

	async function loadReportData(instanceId) {
		try {
			const [statsRes, detailsRes] = await Promise.all([
				getPreferenceStatistics(Number(instanceId), token),
				getPreferenceStatisticsDetails(Number(instanceId), token).catch(() => ({ data: null }))
			]);

			const statsData = Array.isArray(statsRes?.data?.data)
				? statsRes.data.data
				: Array.isArray(statsRes?.data)
					? statsRes.data
					: [];

			const detailsData = detailsRes?.data;

			setReportData({
				statistics: statsData,
				details: detailsData
			});
		} catch (error) {
			console.error('Error loading report data:', error);
			setReportData({
				statistics: [],
				details: null
			});
		}
	}

	function showNotification(message, type = 'success') {
		setNotification({ show: true, message, type });
	}

	const summaryStats = useMemo(() => {
		if (!reportData?.statistics) return { submitted: 0, pending: 0, total: 0 };

		let submitted = 0;
		let pending = 0;
		let total = 0;

		reportData.statistics.forEach((row) => {
			submitted += Number(row.submitted || 0);
			pending += Number(row.pending || 0);
			total += Number(row.total || 0);
		});

		return {
			submitted,
			pending,
			total,
			completionPercent: total > 0 ? ((submitted / total) * 100).toFixed(1) : '0.0'
		};
	}, [reportData?.statistics]);

	return (
		<div className="flex h-screen">
			<Sidebar />
			<div className="flex-1 flex flex-col min-h-0">
				<Header />
				<main className="flex-1 overflow-auto p-6 md:p-8 bg-slate-100">
					<div className="max-w-7xl mx-auto space-y-8">
						<div>
							<h1 className="text-4xl font-extrabold text-slate-900 mb-2">Reports</h1>
							<p className="text-base md:text-lg text-slate-600">
								View system statistics and preference allocation reports.
							</p>
						</div>

						<Notification
							show={notification.show}
							message={notification.message}
							type={notification.type}
							onClose={() => setNotification({ show: false, message: '', type: 'info' })}
						/>

						{isLoading ? (
							<div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">
								Loading report data...
							</div>
						) : (
							<>
								<div className="bg-white rounded-xl shadow-lg p-6">
									<div className="mb-6">
										<label className="block text-sm font-medium text-slate-700 mb-2">
											Select Elective Instance
										</label>
										<select
											value={selectedInstanceId}
											onChange={(e) => setSelectedInstanceId(e.target.value)}
											className="block w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
										>
											<option value="">Select an instance</option>
											{instances.map((instance) => (
												<option key={instance.id} value={String(instance.id)}>
													{instance.instancename} ({instance.academic_year}, Sem {instance.semester})
												</option>
											))}
										</select>
									</div>

									{selectedInstanceId && (
										<>
											<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
												<div className="rounded-lg p-4 bg-sky-50 border border-sky-200">
													<p className="text-sm text-sky-700">Total Students</p>
													<p className="text-2xl font-bold text-sky-900">{summaryStats.total}</p>
												</div>
												<div className="rounded-lg p-4 bg-emerald-50 border border-emerald-200">
													<p className="text-sm text-emerald-700">Submitted</p>
													<p className="text-2xl font-bold text-emerald-900">{summaryStats.submitted}</p>
												</div>
												<div className="rounded-lg p-4 bg-amber-50 border border-amber-200">
													<p className="text-sm text-amber-700">Pending</p>
													<p className="text-2xl font-bold text-amber-900">{summaryStats.pending}</p>
												</div>
												<div className="rounded-lg p-4 bg-indigo-50 border border-indigo-200">
													<p className="text-sm text-indigo-700">Completion Rate</p>
													<p className="text-2xl font-bold text-indigo-900">{summaryStats.completionPercent}%</p>
												</div>
											</div>

											<div>
												<h2 className="text-xl font-semibold text-slate-900 mb-4">
													Preference Statistics by Department
												</h2>
												{reportData?.statistics && reportData.statistics.length > 0 ? (
													<div className="overflow-x-auto">
														<table className="min-w-full divide-y divide-slate-200 border border-slate-200">
															<thead className="bg-slate-100">
																<tr>
																	<th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
																		Sl.No
																	</th>
																	<th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
																		Department
																	</th>
																	<th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
																		Submitted
																	</th>
																	<th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
																		Pending
																	</th>
																	<th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
																		Total
																	</th>
																	<th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
																		Completion %
																	</th>
																</tr>
															</thead>
															<tbody className="divide-y divide-slate-200 bg-white">
																{reportData.statistics.map((row, idx) => {
																	const total = Number(row.total || 0);
																	const submitted = Number(row.submitted || 0);
																	const completion =
																		total > 0
																			? ((submitted / total) * 100).toFixed(1)
																			: '0.0';

																	return (
																		<tr
																			key={`${row.slNo}-${row.department}`}
																			className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
																		>
																			<td className="px-4 py-3 text-sm font-medium text-slate-900">
																				{row.slNo}
																			</td>
																			<td className="px-4 py-3 text-sm text-slate-700">
																				{row.department}
																			</td>
																			<td className="px-4 py-3 text-sm text-center text-emerald-700 font-semibold">
																				{row.submitted}
																			</td>
																			<td className="px-4 py-3 text-sm text-center text-amber-700 font-semibold">
																				{row.pending}
																			</td>
																			<td className="px-4 py-3 text-sm text-center font-semibold text-slate-900">
																				{row.total}
																			</td>
																			<td className="px-4 py-3 text-sm text-center font-semibold">
																				<span
																					className={
																						completion >= 75
																							? 'text-emerald-700'
																							: completion >= 50
																								? 'text-amber-700'
																								: 'text-red-700'
																					}
																				>
																					{completion}%
																				</span>
																			</td>
																		</tr>
																	);
																})}
															</tbody>
														</table>
													</div>
												) : (
													<div className="py-12 text-center text-sm text-slate-500 bg-slate-50 rounded-lg">
														No preference data available for this instance
													</div>
												)}
											</div>
										</>
									)}
								</div>
							</>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
