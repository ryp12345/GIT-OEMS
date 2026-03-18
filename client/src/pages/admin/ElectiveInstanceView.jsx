import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import Notification from '../../components/common/Notification';
import { getInstanceView, updateInstanceCourses } from '../../api/instance.api';

function normalizeCourseRows(rows) {
	return (Array.isArray(rows) ? rows : []).map((course) => ({
		coursecode: course.coursecode,
		coursename: course.coursename,
		shortname: course.shortname,
		division: course.division != null ? String(course.division) : '',
		min_intake: course.min_intake != null ? String(course.min_intake) : '',
		max_intake: course.max_intake != null ? String(course.max_intake) : '',
		department_ids: Array.isArray(course.department_ids) ? course.department_ids.map((value) => String(value)) : []
	}));
}

export default function ElectiveInstanceViewPage() {
	const { id } = useParams();
	const navigate = useNavigate();
	const token = localStorage.getItem('token');
	const PAGE_SIZE = 10;
	const [instance, setInstance] = useState(null);
	const [departments, setDepartments] = useState([]);
	const [courses, setCourses] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState('');
	const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState('');

	useEffect(() => {
		loadPageData();
	}, [id]);

	async function loadPageData() {
		try {
			setIsLoading(true);
			setError('');
			const response = await getInstanceView(id, token);
			const data = response?.data?.data || response?.data || {};
			setInstance(data.instance || null);
			setDepartments(Array.isArray(data.departments) ? data.departments : []);
			setCourses(normalizeCourseRows(data.courses));
		} catch (requestError) {
			setError(requestError?.response?.data?.error || 'Unable to load instance view');
			setInstance(null);
			setDepartments([]);
			setCourses([]);
		} finally {
			setIsLoading(false);
		}
	}

	function showNotification(message, type = 'success') {
		setNotification({ show: true, message, type });
	}

	function handleCourseFieldChange(coursecode, field, value) {
		setCourses((current) => current.map((course) => (
			course.coursecode === coursecode ? { ...course, [field]: value } : course
		)));
		if (error) setError('');
	}

	function handleDepartmentToggle(coursecode, departmentId, checked) {
		setCourses((current) => current.map((course) => {
			if (course.coursecode !== coursecode) return course;

			const nextIds = checked
				? Array.from(new Set([...course.department_ids, departmentId]))
				: course.department_ids.filter((value) => value !== departmentId);

			return { ...course, department_ids: nextIds };
		}));
		if (error) setError('');
	}

	const title = useMemo(() => {
		if (!instance) return 'Instance View';
		return `Instance View for ${instance.instancename}`;
	}, [instance]);

	const filteredCourses = useMemo(() => {
		const query = search.trim().toLowerCase();

		if (!query) return courses;

		return courses.filter((course) => (
			course.coursecode?.toLowerCase().includes(query)
			|| course.coursename?.toLowerCase().includes(query)
			|| course.shortname?.toLowerCase().includes(query)
			|| course.division?.toLowerCase().includes(query)
			|| course.min_intake?.toLowerCase().includes(query)
			|| course.max_intake?.toLowerCase().includes(query)
		));
	}, [courses, search]);

	const paginatedCourses = useMemo(() => {
		const start = (page - 1) * PAGE_SIZE;
		return filteredCourses.slice(start, start + PAGE_SIZE);
	}, [filteredCourses, page]);

	const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE)), [filteredCourses.length]);
	const startEntry = filteredCourses.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const endEntry = filteredCourses.length === 0 ? 0 : Math.min(page * PAGE_SIZE, filteredCourses.length);
	const visiblePages = useMemo(() => {
		const startPage = Math.max(1, page - 1);
		const endPage = Math.min(totalPages, startPage + 2);
		const adjustedStart = Math.max(1, endPage - 2);

		return Array.from({ length: endPage - adjustedStart + 1 }, (_, index) => adjustedStart + index);
	}, [page, totalPages]);

	useEffect(() => {
		setPage(1);
	}, [filteredCourses.length, id, search]);

	useEffect(() => {
		if (page > totalPages) {
			setPage(totalPages);
		}
	}, [page, totalPages]);

	async function handleSubmit(event) {
		event.preventDefault();

		const payload = {
			courses: courses.map((course) => ({
				coursecode: course.coursecode,
				division: Number(course.division || 0),
				min_intake: Number(course.min_intake || 0),
				max_intake: Number(course.max_intake || 0),
				department_ids: course.department_ids.map((value) => Number(value))
			}))
		};

		for (const course of payload.courses) {
			if (!Number.isInteger(course.division) || course.division < 0) {
				setError(`Division must be a non-negative integer for ${course.coursecode}`);
				return;
			}
			if (!Number.isInteger(course.min_intake) || course.min_intake < 0) {
				setError(`Minimum intake must be a non-negative integer for ${course.coursecode}`);
				return;
			}
			if (!Number.isInteger(course.max_intake) || course.max_intake < 0) {
				setError(`Maximum intake must be a non-negative integer for ${course.coursecode}`);
				return;
			}
			if (course.max_intake < course.min_intake) {
				setError(`Maximum intake must be greater than or equal to minimum intake for ${course.coursecode}`);
				return;
			}
		}

		try {
			setIsSaving(true);
			setError('');
			const response = await updateInstanceCourses(id, payload, token);
			const data = response?.data?.data || response?.data || {};
			setInstance(data.instance || instance);
			setDepartments(Array.isArray(data.departments) ? data.departments : departments);
			setCourses(normalizeCourseRows(data.courses));
			showNotification('Instance courses updated successfully', 'success');
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to update instance courses';
			setError(message);
			showNotification(message, 'error');
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<div className="flex h-screen bg-slate-100">
			<Sidebar />
			<div className="flex min-w-0 flex-1 flex-col">
				<Header />
				<main className="flex-1 overflow-auto p-6">
					<div className="mx-auto max-w-7xl">
						<Notification
							show={notification.show}
							message={notification.message}
							type={notification.type}
							onClose={() => setNotification({ show: false, message: '', type: 'info' })}
						/>

						<div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
							<div>
								<h1 className="mb-2 text-3xl font-extrabold text-gray-900">{title}</h1>
								<div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
									<span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700">Academic Year: {instance?.academic_year || '-'}</span>
									<span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">Semester: {instance?.semester || '-'}</span>
									<span>Open Elective Management System.</span>
								</div>
							</div>
							<button
								type="button"
								onClick={() => navigate('/elective-instance')}
								className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
							>
								Back to Instance List
							</button>
						</div>

						{error ? (
							<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
						) : null}

						<div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
							<div className="relative w-full sm:w-96">
								<input
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search courses, code, department..."
									className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								/>
								<svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
							</div>
							<p className="text-sm text-gray-600">Filter by course code, course name, department, or intake values.</p>
						</div>

						<div className="overflow-hidden rounded-xl bg-white shadow-xl">
							<div className="border-b border-gray-200 px-6 py-4">
								<h2 className="text-lg font-semibold text-gray-900">Elective Courses List</h2>
							</div>
							<div className="max-h-[800px] overflow-auto">
								<form onSubmit={handleSubmit}>
									<table className="min-w-full divide-y divide-gray-200">
										<thead className="sticky top-0 bg-blue-600">
											<tr>
												<th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Sl.No</th>
												<th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Department</th>
												<th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Course Name</th>
												<th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Div</th>
												<th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Min</th>
												<th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Max</th>
												<th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Permitted Branches</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-200 bg-white">
											{isLoading ? (
												<tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
											) : filteredCourses.length === 0 ? (
												<tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500">No courses found for this instance semester</td></tr>
											) : (
												paginatedCourses.map((course, index) => (
													<tr key={course.coursecode} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
														<td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + index + 1}</td>
														<td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-gray-700">{course.shortname || '-'}</td>
														<td className="px-4 py-4 text-sm text-gray-700">{course.coursename} ({course.coursecode})</td>
														<td className="px-4 py-4">
															<input
																type="number"
																min="0"
																value={course.division}
																onChange={(event) => handleCourseFieldChange(course.coursecode, 'division', event.target.value)}
																className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															/>
														</td>
														<td className="px-4 py-4">
															<input
																type="number"
																min="0"
																value={course.min_intake}
																onChange={(event) => handleCourseFieldChange(course.coursecode, 'min_intake', event.target.value)}
																className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															/>
														</td>
														<td className="px-4 py-4">
															<input
																type="number"
																min="0"
																value={course.max_intake}
																onChange={(event) => handleCourseFieldChange(course.coursecode, 'max_intake', event.target.value)}
																className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															/>
														</td>
														<td className="px-4 py-4">
															<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
																{departments.map((department) => {
																	const checked = course.department_ids.includes(String(department.id));
																	return (
																		<label key={`${course.coursecode}-${department.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
																			<input
																				type="checkbox"
																				checked={checked}
																				onChange={(event) => handleDepartmentToggle(course.coursecode, String(department.id), event.target.checked)}
																				className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
																			/>
																			<span>{department.shortname}</span>
																		</label>
																	);
																})}
															</div>
														</td>
													</tr>
												))
											)}
										</tbody>
										<tfoot>
											<tr>
												<td colSpan="7" className="px-6 py-4">
													<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
														{filteredCourses.length > 0 ? (
															<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
																<p className="text-sm text-gray-600">
																	Showing {startEntry} to {endEntry} of {filteredCourses.length} courses
																</p>
																<div className="flex items-center gap-2">
																	<button
																		type="button"
																		className="rounded border border-gray-300 bg-white px-3 py-1 text-gray-700 disabled:opacity-50"
																		onClick={() => setPage((current) => Math.max(1, current - 1))}
																		disabled={page === 1}
																	>
																		Prev
																	</button>
																	{visiblePages.map((pageNumber) => (
																		<button
																			key={pageNumber}
																			type="button"
																			onClick={() => setPage(pageNumber)}
																			className={`rounded border px-3 py-1 ${page === pageNumber ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
																		>
																			{pageNumber}
																		</button>
																	))}
																	<span className="text-sm text-gray-700">of {totalPages}</span>
																	<button
																		type="button"
																		className="rounded border border-gray-300 bg-white px-3 py-1 text-gray-700 disabled:opacity-50"
																		onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
																		disabled={page === totalPages}
																	>
																		Next
																	</button>
																</div>
															</div>
														) : <div />}
														<button type="submit" disabled={isSaving || isLoading || courses.length === 0} className="rounded-lg bg-amber-500 px-5 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-amber-600 disabled:opacity-50">
															{isSaving ? 'Updating...' : 'Update Courses'}
														</button>
													</div>
												</td>
											</tr>
										</tfoot>
									</table>
								</form>
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}