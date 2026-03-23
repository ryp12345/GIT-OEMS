import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import {
	getInstances,
	getPreferenceStatisticsDetails,
	resetInstanceAllocations,
	setFinalPreferences,
	rejectUnderSubscribedCourses,
	upgradePreferences,
	allocateByStep
} from '../../api/instance.api';

export default function AllocationPage() {
	const token = localStorage.getItem('token');
	const [instances, setInstances] = useState([]);
	const [selectedInstance, setSelectedInstance] = useState('#');
	const [courses, setCourses] = useState([]);
	const [loading, setLoading] = useState(false);
	const [step, setStep] = useState('initial');
	const [resultType, setResultType] = useState('info');
	const [resultMessage, setResultMessage] = useState('');
	const [rejectedCourses, setRejectedCourses] = useState([]);
	const [rejectedCourseIds, setRejectedCourseIds] = useState([]);

	function parsePreferenceDetailsPayload(payload) {
		if (Array.isArray(payload)) {
			return payload;
		}
		return Array.isArray(payload?.rows) ? payload.rows : [];
	}

	useEffect(() => {
		(async () => {
			try {
				const res = await getInstances(token);
				setInstances(Array.isArray(res?.data) ? res.data : []);
			} catch (err) {
				setResultType('error');
				setResultMessage('Failed to load instances');
			}
		})();
	}, [token]);

	function resetStateForInstanceChange(value) {
		setSelectedInstance(value);
		setStep('initial');
		setCourses([]);
		setRejectedCourses([]);
		setRejectedCourseIds([]);
		setResultMessage('');
	}

	async function handleStart() {
		if (!selectedInstance || selectedInstance === '#') return;

		setLoading(true);
		setResultMessage('');
		try {
			await setFinalPreferences(selectedInstance, token);
			const rejectRes = await rejectUnderSubscribedCourses(selectedInstance, token);
			const rejected = Array.isArray(rejectRes?.data?.rejectedCourses) ? rejectRes.data.rejectedCourses : [];

			setRejectedCourseIds(
				rejected
					.map((course) => Number(course.instance_course_id))
					.filter((value) => Number.isInteger(value) && value > 0)
			);
			setRejectedCourses(rejected);

			const detailsRes = await getPreferenceStatisticsDetails(selectedInstance, token);
			const data = parsePreferenceDetailsPayload(detailsRes?.data);
			setCourses(data);

			if (rejected.length > 0) {
				const rejectedNames = rejected.map((c) => c.coursecode).join(', ');
				setResultType('warning');
				setResultMessage(`Rejected ${rejectedNames}. Upgrading the students preferences.`);
				setStep('upgrading');
			} else {
				setResultType('info');
				setResultMessage('No courses were rejected. Ready to allocate.');
				setStep('allocating');
			}
		} catch (err) {
			setResultType('error');
			setResultMessage(err?.response?.data?.error || 'Failed to analyze');
		} finally {
			setLoading(false);
		}
	}

	async function handleUpgradePreferences() {
		setLoading(true);
		try {
			await upgradePreferences(selectedInstance, rejectedCourseIds, token);
			setResultType('success');
			setResultMessage('Preferences are upgraded successfully.');
			setStep('allocating');
		} catch (err) {
			setResultType('error');
			setResultMessage(err?.message || 'Failed to upgrade preferences');
		} finally {
			setLoading(false);
		}
	}

	async function handleAllocate() {
		if (!selectedInstance || selectedInstance === '#') return;

		const confirmed = window.confirm('This will run the allocation process. Proceed?');
		if (!confirmed) return;

		setLoading(true);
		setResultMessage('');
		try {
			await allocateByStep(selectedInstance, token);
			setResultType('success');
			setResultMessage('Allocation completed successfully.');
			setStep('completed');

			const courseRes = await getPreferenceStatisticsDetails(selectedInstance, token);
			const courseData = parsePreferenceDetailsPayload(courseRes?.data);
			setCourses(courseData);
		} catch (err) {
			setResultType('error');
			setResultMessage(err?.response?.data?.error || 'Allocation failed');
		} finally {
			setLoading(false);
		}
	}

	async function handleReset() {
		if (!selectedInstance || selectedInstance === '#') return;

		const confirmed = window.confirm('Reset allocations for this instance?');
		if (!confirmed) return;

		setLoading(true);
		try {
			await resetInstanceAllocations(selectedInstance, token);
			setStep('initial');
			setRejectedCourses([]);
			setRejectedCourseIds([]);
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
							<div className="w-full max-w-md">
								<label className="block text-sm font-semibold text-blue-700">Elective Instance</label>
								<select
									value={selectedInstance}
									onChange={(e) => resetStateForInstanceChange(e.target.value)}
									disabled={loading}
									className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm"
								>
									<option value="#">Select Elective Instance</option>
									{instances.map((ins) => (
										<option key={ins.id} value={ins.id}>
											{`${ins.instancename} - ${ins.academic_year} (Sem ${ins.semester})`}
										</option>
									))}
								</select>
							</div>

							<div className="flex flex-wrap gap-2">
								{step === 'initial' && (
									<button
										onClick={handleStart}
										disabled={selectedInstance === '#' || loading}
										className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
									>
										{loading ? 'Starting...' : 'Start'}
									</button>
								)}

								{step === 'upgrading' && (
									<button
										onClick={handleUpgradePreferences}
										disabled={loading}
										className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-700 disabled:opacity-50"
									>
										{loading ? 'Upgrading...' : 'Upgrade Preferences'}
									</button>
								)}

								{(step === 'allocating' || step === 'completed') && (
									<button
										onClick={handleAllocate}
										disabled={loading}
										className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-50"
									>
										{loading ? 'Allocating...' : 'Allocate'}
									</button>
								)}

								{step !== 'initial' && (
									<button
										onClick={handleReset}
										disabled={loading}
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
											<th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Course</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P1 Count</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P1 Min Grade</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P1 Median Grade</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P1 Max Grade</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">P2 Count</th>
											<th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Status</th>
										</tr>
									</thead>
									<tbody>
										{courses.length === 0 ? (
											<tr>
												<td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
													No data. Select an instance and click Start.
												</td>
											</tr>
										) : (
											courses.map((course) => (
												<tr
													key={course.instance_course_id}
													className={
														Number(course.p1_count || 0) < Number(course.min_intake || 0)
															? 'bg-red-50'
															: 'odd:bg-white even:bg-slate-50/50'
													}
												>
													<td className="px-4 py-3 text-sm text-slate-700">
														{course.coursename} ({course.coursecode})
													</td>
													<td className="px-4 py-3 text-center text-sm font-semibold text-blue-700">{course.p1_count}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-600">{course.p1_min_grade ?? '-'}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-600">{course.p1_median_grade ?? '-'}</td>
													<td className="px-4 py-3 text-center text-sm text-slate-600">{course.p1_max_grade ?? '-'}</td>
													<td className="px-4 py-3 text-center text-sm font-semibold text-blue-700">{course.p2_count}</td>
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
