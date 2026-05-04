import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { useAdminInstance } from '../../context/AdminInstanceContext';
import {
	getPreferenceStatisticsDetails,
	resetInstanceAllocations,
	setFinalPreferences,
	rejectUnderSubscribedCourses,
	upgradePreferences,
	allocateByStep,
	downloadInstanceAllocations
} from '../../api/instance.api';

export default function AllocationPage() {
	const token = localStorage.getItem('token');
	const { activeInstance, activeInstanceId, hasActiveInstance } = useAdminInstance();
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(false);
	const [step, setStep] = useState('initial');
	const [resultType, setResultType] = useState('info');
	const [resultMessage, setResultMessage] = useState('');
	const [rejectedCourses, setRejectedCourses] = useState([]);

	function parsePreferenceDetailsPayload(payload) {
		if (Array.isArray(payload)) {
			return payload;
		}
		return Array.isArray(payload?.rows) ? payload.rows : [];
	}

	function resetStateForInstanceChange() {
		setStep('initial');
		setCourses([]);
		setRejectedCourses([]);
		setResultMessage('');
	}

	useEffect(() => {
		resetStateForInstanceChange();
	}, [activeInstanceId]);

	async function handleStart() {
		if (!activeInstanceId) return;

		setLoading(true);
		setResultMessage('');
		try {
			await setFinalPreferences(activeInstanceId, token);
			const rejectRes = await rejectUnderSubscribedCourses(activeInstanceId, token);
			const rejected = Array.isArray(rejectRes?.data?.rejectedCourses) ? rejectRes.data.rejectedCourses : [];

			const ids = rejected
				.map((course) => Number(course.instance_course_id))
				.filter((value) => Number.isInteger(value) && value > 0);

			setRejectedCourses(rejected);

			if (rejected.length > 0) {
				const rejectedNames = rejected.map((c) => c.coursecode).join(', ');
				await upgradePreferences(activeInstanceId, ids, token);
				setResultType('success');
				setResultMessage(`Rejected ${rejectedNames}. Preferences are Upgraded Successfully.`);
			} else {
				setResultType('info');
				setResultMessage('No courses were rejected. Ready to allocate.');
			}

			const detailsRes = await getPreferenceStatisticsDetails(activeInstanceId, token);
			const data = parsePreferenceDetailsPayload(detailsRes?.data);
			setCourses(data);
			setStep('allocating');
		} catch (err) {
			setResultType('error');
			setResultMessage(err?.response?.data?.error || 'Failed to analyze');
		} finally {
			setLoading(false);
		}
	}

	async function handleAllocate() {
		if (!activeInstanceId) return;

		const confirmed = window.confirm('This will run the allocation process. Proceed?');
		if (!confirmed) return;

		setLoading(true);
		setResultMessage('');
		try {
			await allocateByStep(activeInstanceId, token);
			setResultType('success');
			setResultMessage('Allocation completed successfully.');
			setStep('completed');

			const courseRes = await getPreferenceStatisticsDetails(activeInstanceId, token);
			const courseData = parsePreferenceDetailsPayload(courseRes?.data);
			setCourses(courseData);
		} catch (err) {
			setResultType('error');
			setResultMessage(err?.response?.data?.error || 'Allocation failed');
		} finally {
			setLoading(false);
		}
	}

	async function handleDownload() {
		if (!activeInstanceId) return;
		try {
			const res = await downloadInstanceAllocations(activeInstanceId, token);
			const url = window.URL.createObjectURL(new Blob([res.data], { type: res.headers['content-type'] }));
			const a = document.createElement('a');
			a.href = url;
			a.download = `student_allocations_${activeInstanceId}.xlsx`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
		} catch (err) {
			setResultType('error');
			setResultMessage(err?.response?.data?.error || 'Download failed');
		}
	}

	async function handleReset() {
		if (!activeInstanceId) return;

		const confirmed = window.confirm('Reset allocations for this instance?');
		if (!confirmed) return;

		setLoading(true);
		try {
			await resetInstanceAllocations(activeInstanceId, token);
			setStep('initial');
			setRejectedCourses([]);
			setCourses([]);
			setResultMessage('');
		} catch (err) {
			setResultType('error');
			setResultMessage(err?.response?.data?.error || 'Reset failed');
		} finally {
			setLoading(false);
		}
	}

	function resultBoxClass() {
		if (resultType === 'error') return 'border-red-200 bg-red-50 text-red-700';
		if (resultType === 'warning') return 'border-yellow-200 bg-yellow-50 text-yellow-800';
		if (resultType === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		return 'border-blue-200 bg-blue-50 text-blue-700';
	}

	return (
		<div className="flex h-screen bg-slate-100">
			<Sidebar />
			<div className="flex min-w-0 flex-1 flex-col">
				<Header />
				<main className="flex-1 overflow-auto p-6">
					<div className="mx-auto max-w-7xl">
						<div className="mb-8">
							<h1 className="text-3xl font-semibold text-gray-900">Allocation</h1>
							<p className="text-sm text-gray-600">Open Elective Management System.</p>
						</div>

						<div className="mb-6 flex flex-col gap-4 rounded-xl bg-white p-5 shadow-xl lg:flex-row lg:items-end lg:justify-between">
							<div className="w-full max-w-3xl rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
								{hasActiveInstance
									? `Active Instance: ${activeInstance?.instancename || '-'} (${activeInstance?.academic_year || '-'}, Sem ${activeInstance?.semester || '-'})`
									: 'No active instance selected. Please select an instance from Elective Instance page.'}
							</div>

							<div className="flex flex-wrap gap-2">
								{step === 'initial' && (
									<button
										onClick={handleStart}
										disabled={!hasActiveInstance || loading}
										className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
									>
										{loading ? 'Starting...' : 'Start'}
									</button>
								)}

								{(step === 'allocating' || step === 'completed') && (
									<button
										onClick={handleAllocate}
										disabled={!hasActiveInstance || loading}
										className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-50"
									>
										{loading ? 'Allocating...' : 'Allocate'}
									</button>
								)}

								{step === 'completed' && (
									<button
										onClick={handleDownload}
										disabled={!hasActiveInstance || loading}
										className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50"
									>
										Download Excel
									</button>
								)}

								{step !== 'initial' && (
									<button
										onClick={handleReset}
										disabled={!hasActiveInstance || loading}
										className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-red-700 disabled:opacity-50"
									>
										Reset
									</button>
								)}
							</div>
						</div>

						{resultMessage ? (
							<div className={`mb-4 rounded-lg border p-3 text-sm ${resultBoxClass()}`}>{resultMessage}</div>
						) : null}

						{rejectedCourses.length > 0 ? (
							<div className="mb-4 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4">
								<h3 className="mb-2 font-semibold text-yellow-900">Rejected Courses</h3>
								<ul className="space-y-1 text-sm text-yellow-800">
									{rejectedCourses.map((course) => (
										<li key={course.instance_course_id}>
											{course.coursename} ({course.coursecode})
										</li>
									))}
								</ul>
							</div>
						) : null}

						<div className="overflow-hidden rounded-xl bg-white shadow-xl">
							<div className="overflow-x-auto">
								<table className="min-w-full border-collapse">
									<thead>
										<tr className="bg-slate-50">
												<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">#</th>
											<th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Course</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P1 Count</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P1 Min Grade</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P1 Median Grade</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P1 Max Grade</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P2 Count</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P2 Min Grade</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P2 Median Grade</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P2 Max Grade</th>
												<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Division</th>
												<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Min Intake</th>
												<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Max Intake</th>
												<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Total Allocations</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Status</th>
										</tr>
									</thead>
									<tbody>
										{courses.length === 0 ? (
											<tr>
													<td colSpan={15} className="px-4 py-8 text-center text-sm text-slate-500">
														{hasActiveInstance ? 'No data. Click Start to load this instance.' : 'Please select an active instance in Elective Instance page.'}
												</td>
											</tr>
										) : (
												courses.map((course, index) => (
												<tr
													key={course.instance_course_id}
													className={
														Number(course.p1_count || 0) < Number(course.min_intake || 0)
															? 'bg-red-50'
															: 'odd:bg-white even:bg-slate-50/50'
													}
												>
														<td className="px-4 py-3 text-center text-sm text-slate-700">{index + 1}</td>
													<td className="px-4 py-3 text-sm text-slate-700">
														{course.coursename} ({course.coursecode})
													</td>
													<td className="px-4 py-3 text-center text-sm font-semibold text-blue-700">{course.p1_count}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-600">{course.p1_min_grade ?? '-'}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-600">{course.p1_median_grade ?? '-'}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-600">{course.p1_max_grade ?? '-'}</td>
													<td className="px-4 py-3 text-center text-sm font-semibold text-blue-700">{course.p2_count}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-600">{course.p2_min_grade ?? '-'}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-600">{course.p2_median_grade ?? '-'}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-600">{course.p2_max_grade ?? '-'}</td>
														<td className="px-4 py-3 text-center text-sm text-slate-700">{course.division ?? '-'}</td>
														<td className="px-4 py-3 text-center text-sm text-slate-700">{course.min_intake ?? '-'}</td>
														<td className="px-4 py-3 text-center text-sm text-slate-700">{course.max_intake ?? '-'}</td>
														<td className="px-4 py-3 text-center text-sm font-semibold text-slate-900">{course.total_allocations ?? 0}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-700">{course.allocation_status || 'Pending'}</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
