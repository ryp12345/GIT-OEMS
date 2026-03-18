import { useEffect, useMemo, useRef, useState } from 'react';
import Notification from '../../components/common/Notification';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import {
	createCourse,
	deleteCourse,
	downloadCourseTemplate,
	getCourseMeta,
	getCourses,
	importCourses,
	updateCourse
} from '../../api/course.api';

const semesterOptions = ['1', '2', '3', '4', '5', '6', '7', '8'];
const yesNoOptions = ['No', 'Yes'];
const PAGE_SIZE = 10;

const initialFormState = {
	coursename: '',
	coursecode: '',
	pre_req: '',
	pre_req_text: '',
	department_id: '',
	elective_group_id: '',
	semester: '',
	compulsory_prereq: 'No',
	restricted: ''
};

function isNumericReference(value) {
	return /^\d+$/.test(String(value || '').trim());
}

function getCourseOptionLabel(course) {
	return `${course.coursename} - ${course.coursecode}`;
}

function normalizeFormState(formState) {
	return {
		coursename: formState.coursename.trim(),
		coursecode: formState.coursecode.trim().toUpperCase(),
		pre_req: formState.pre_req === '-1' ? formState.pre_req_text.trim() : formState.pre_req.trim(),
		department_id: formState.department_id ? Number(formState.department_id) : null,
		elective_group_id: formState.elective_group_id ? Number(formState.elective_group_id) : null,
		semester: Number(formState.semester),
		compulsory_prereq: formState.compulsory_prereq,
		restricted: formState.restricted || null
	};
}

export default function CoursesPage() {
	const token = localStorage.getItem('token');
	const [courses, setCourses] = useState([]);
	const [departments, setDepartments] = useState([]);
	const [electiveGroups, setElectiveGroups] = useState([]);
	const [search, setSearch] = useState('');
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formState, setFormState] = useState(initialFormState);
	const [editingId, setEditingId] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
	const [page, setPage] = useState(1);
	const [selectedImportFile, setSelectedImportFile] = useState(null);
	const [isImporting, setIsImporting] = useState(false);
	const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
	const importInputRef = useRef(null);
	const courseOptions = useMemo(() => {
		return courses
			.filter((course) => course.id !== editingId)
			.map((course) => ({
				id: String(course.id),
				label: getCourseOptionLabel(course)
			}));
	}, [courses, editingId]);
	const courseOptionMap = useMemo(() => {
		return new Map(courseOptions.map((course) => [course.id, course.label]));
	}, [courseOptions]);

	useEffect(() => {
		loadPageData();
	}, []);

	async function loadPageData() {
		try {
			setIsLoading(true);
			setError('');
			const [coursesResponse, metaResponse] = await Promise.all([
				getCourses(token),
				getCourseMeta(token)
			]);

			const courseData = coursesResponse?.data?.data || coursesResponse?.data || [];
			const metaData = metaResponse?.data?.data || metaResponse?.data || {};

			setCourses(Array.isArray(courseData) ? courseData : []);
			setDepartments(Array.isArray(metaData.departments) ? metaData.departments : []);
			setElectiveGroups(Array.isArray(metaData.electiveGroups) ? metaData.electiveGroups : []);
		} catch (requestError) {
			setError(requestError?.response?.data?.error || 'Unable to load courses');
			setCourses([]);
			setDepartments([]);
			setElectiveGroups([]);
		} finally {
			setIsLoading(false);
		}
	}

	function showNotification(message, type = 'success') {
		setNotification({ show: true, message, type });
	}

	function onCloseModal() {
		setIsModalOpen(false);
		setFormState(initialFormState);
		setEditingId(null);
		setError('');
	}

	function openCreateModal() {
		onCloseModal();
		setIsModalOpen(true);
	}

	async function handleTemplateDownload() {
		try {
			setIsDownloadingTemplate(true);
			setError('');
			const response = await downloadCourseTemplate(token);
			const blob = new Blob([
				response.data
			], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'CourseTemplate.xlsx';
			link.click();
			window.URL.revokeObjectURL(url);
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to download template';
			setError(message);
			showNotification(message, 'error');
		} finally {
			setIsDownloadingTemplate(false);
		}
	}

	function handleImportFileChange(event) {
		setSelectedImportFile(event.target.files?.[0] || null);
		if (error) setError('');
	}

	async function handleImportSubmit(event) {
		event.preventDefault();

		if (!selectedImportFile) {
			setError('Please select a file to import');
			return;
		}

		const formData = new FormData();
		formData.append('file', selectedImportFile);

		try {
			setIsImporting(true);
			setError('');
			const response = await importCourses(formData, token);
			const result = response?.data?.data || response?.data || {};
			const importedCount = result.importedCount || 0;
			showNotification(`${importedCount} course${importedCount === 1 ? '' : 's'} imported successfully`, 'success');
			setSelectedImportFile(null);
			if (importInputRef.current) {
				importInputRef.current.value = '';
			}
			await loadPageData();
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to import courses';
			setError(message);
			showNotification(message, 'error');
		} finally {
			setIsImporting(false);
		}
	}

	function handleFieldChange(event) {
		const { name, value, type, checked } = event.target;
		setFormState((current) => ({
			...current,
			[name]: name === 'coursecode'
				? value.toUpperCase()
				: type === 'checkbox'
					? (checked ? 'Yes' : 'No')
					: value
		}));
		if (error) setError('');
	}

	function handleEdit(course) {
		const prerequisiteValue = String(course.pre_req || '').trim();
		const hasCoursePrerequisite = isNumericReference(prerequisiteValue) && courseOptionMap.has(prerequisiteValue);

		setEditingId(course.id);
		setFormState({
			coursename: course.coursename || '',
			coursecode: course.coursecode || '',
			pre_req: hasCoursePrerequisite ? prerequisiteValue : (prerequisiteValue ? '-1' : ''),
			pre_req_text: hasCoursePrerequisite ? '' : prerequisiteValue,
			department_id: course.department_id ? String(course.department_id) : '',
			elective_group_id: course.elective_group_id ? String(course.elective_group_id) : '',
			semester: course.semester ? String(course.semester) : '',
			compulsory_prereq: course.compulsory_prereq || 'No',
			restricted: course.restricted || ''
		});
		setIsModalOpen(true);
		setError('');
	}

	async function handleSubmit(event) {
		event.preventDefault();

		if (!formState.coursename.trim()) {
			setError('Course name is required');
			return;
		}

		if (!formState.coursecode.trim()) {
			setError('Course code is required');
			return;
		}

		if (formState.coursecode.trim().length > 10) {
			setError('Course code must be at most 10 characters');
			return;
		}

		if (!semesterOptions.includes(formState.semester)) {
			setError('Please select a semester between 1 and 8');
			return;
		}

		if (!formState.department_id) {
			setError('Please select an offering department');
			return;
		}

		if (formState.pre_req === '-1' && !formState.pre_req_text.trim()) {
			setError('Please enter prerequisite text');
			return;
		}

		if ((formState.pre_req === '-1' ? formState.pre_req_text : formState.pre_req).trim().length > 200) {
			setError('Prerequisite must be at most 200 characters');
			return;
		}

		if (!yesNoOptions.includes(formState.compulsory_prereq)) {
			setError('Please select compulsory prerequisite as Yes or No');
			return;
		}

		setIsSubmitting(true);
		setError('');

		try {
			const payload = normalizeFormState(formState);
			if (editingId) {
				await updateCourse(editingId, payload, token);
				showNotification('Course updated successfully', 'success');
			} else {
				await createCourse(payload, token);
				showNotification('Course created successfully', 'success');
			}

			onCloseModal();
			await loadPageData();
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to save course';
			setError(message);
			showNotification(message, 'error');
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleDelete(id) {
		const confirmed = window.confirm('Delete this course?');
		if (!confirmed) return;

		try {
			setError('');
			await deleteCourse(id, token);
			if (editingId === id) {
				onCloseModal();
			}
			showNotification('Course deleted successfully', 'success');
			await loadPageData();
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to delete course';
			setError(message);
			showNotification(message, 'error');
		}
	}

	function getReferenceLabel(value) {
		const normalizedValue = String(value || '').trim();
		if (!normalizedValue) return '-';
		if (isNumericReference(normalizedValue) && courseOptionMap.has(normalizedValue)) {
			return courseOptionMap.get(normalizedValue);
		}
		return normalizedValue;
	}

	const filtered = useMemo(() => {
		const sorted = [...courses].sort((left, right) => (right.id || 0) - (left.id || 0));
		const query = search.trim().toLowerCase();

		if (!query) return sorted;

		return sorted.filter((course) => (
			course.coursename?.toLowerCase().includes(query)
			|| course.coursecode?.toLowerCase().includes(query)
			|| course.department_name?.toLowerCase().includes(query)
			|| course.department_shortname?.toLowerCase().includes(query)
			|| course.elective_group_name?.toLowerCase().includes(query)
			|| getReferenceLabel(course.pre_req).toLowerCase().includes(query)
			|| String(course.semester || '').includes(query)
			|| String(course.compulsory_prereq || '').toLowerCase().includes(query)
			|| getReferenceLabel(course.restricted).toLowerCase().includes(query)
		));
	}, [courses, search, courseOptionMap]);

	const paginated = useMemo(() => {
		const start = (page - 1) * PAGE_SIZE;
		return filtered.slice(start, start + PAGE_SIZE);
	}, [filtered, page]);

	const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered]);
	const startEntry = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const endEntry = filtered.length === 0 ? 0 : Math.min(page * PAGE_SIZE, filtered.length);
	const visiblePages = useMemo(() => {
		const startPage = Math.max(1, page - 1);
		const endPage = Math.min(totalPages, startPage + 2);
		const adjustedStart = Math.max(1, endPage - 2);

		return Array.from({ length: endPage - adjustedStart + 1 }, (_, index) => adjustedStart + index);
	}, [page, totalPages]);

	useEffect(() => {
		setPage(1);
	}, [search, courses]);

	return (
		<div className="flex h-screen bg-slate-100">
			<Sidebar />
			<div className="flex min-w-0 flex-1 flex-col">
				<Header />
				<main className="flex-1 overflow-auto p-6">
					<div className="max-w-7xl mx-auto">
						<Notification
							show={notification.show}
							message={notification.message}
							type={notification.type}
							onClose={() => setNotification({ show: false, message: '', type: 'info' })}
						/>

						<div className="mb-12 text-center">
							<h1 className="mb-2 text-4xl font-extrabold text-gray-900">Courses</h1>
							<p className="text-lg text-gray-600">Create, update and manage courses</p>
						</div>

						<div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
							<div className="relative w-full sm:w-80">
								<input
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search courses..."
									className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								/>
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
							</div>
							<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
								<button
									type="button"
									onClick={handleTemplateDownload}
									disabled={isDownloadingTemplate}
									className="flex items-center justify-center px-5 py-3 font-medium text-white transition-colors rounded-lg shadow-lg bg-emerald-600 hover:bg-emerald-700"
								>
									<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
									</svg>
									{isDownloadingTemplate ? 'Downloading...' : 'Download Template'}
								</button>
								<form onSubmit={handleImportSubmit} className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
									<input
										ref={importInputRef}
										type="file"
										accept=".csv,.xlsx,.xls"
										onChange={handleImportFileChange}
										className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 sm:w-64"
									/>
									<button
										type="submit"
										disabled={isImporting}
										className="flex items-center justify-center px-5 py-3 font-medium text-white transition-colors rounded-lg shadow-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50"
									>
										<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12" />
										</svg>
										{isImporting ? 'Importing...' : 'Import Course List'}
									</button>
								</form>
								<button onClick={openCreateModal} className="flex items-center justify-center w-full px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 hover:scale-105 sm:w-auto">
									<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
									Add Course
								</button>
							</div>
						</div>
						<div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-blue-600">
										<tr>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Sl.No</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Group Name</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Course Code</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Course Name</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Department</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Prerequisites</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Compulsory Course</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Restricted Course</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Semester</th>
											<th className="px-6 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Action</th>
										</tr>
									</thead>
									<tbody className="bg-white divide-y divide-gray-200">
										{isLoading ? (
											<tr><td colSpan="10" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
										) : filtered.length === 0 ? (
											<tr><td colSpan="10" className="px-6 py-12 text-center text-gray-500">No courses found</td></tr>
										) : (
											paginated.map((course, index) => (
												<tr key={course.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + index + 1}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{course.elective_group_name || '-'}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{course.coursecode}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{course.coursename}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{course.department_name || course.department_shortname || '-'}</td>
													<td className="px-6 py-4 text-sm text-gray-700">{getReferenceLabel(course.pre_req)}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{course.compulsory_prereq || 'No'}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{getReferenceLabel(course.restricted)}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{course.semester}</td>
													<td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
														<div className="flex items-center justify-center space-x-2">
															<button
																onClick={() => handleEdit(course)}
																className="p-2 text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700"
																title="Edit Course"
															>
																<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
																</svg>
															</button>
															<button
																onClick={() => handleDelete(course.id)}
																className="p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700"
																title="Delete Course"
															>
																<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
																</svg>
															</button>
														</div>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>

							{filtered.length > 0 ? (
								<div className="flex flex-col gap-4 px-6 py-6 border-t border-gray-200 sm:flex-row sm:items-center sm:justify-between">
									<p className="text-sm text-gray-600">
										Showing {startEntry} to {endEntry} of {filtered.length} entries
									</p>
									<div className="flex items-center gap-2">
										<button
											className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50"
											onClick={() => setPage((current) => Math.max(1, current - 1))}
											disabled={page === 1}
										>
											Prev
										</button>
										{visiblePages.map((pageNumber) => (
											<button
												key={pageNumber}
												onClick={() => setPage(pageNumber)}
												className={`px-3 py-1 rounded border ${page === pageNumber ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
											>
												{pageNumber}
											</button>
										))}
										<span className="text-sm text-gray-700">of {totalPages}</span>
										<button
											className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-700 disabled:opacity-50"
											onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
											disabled={page === totalPages}
										>
											Next
										</button>
									</div>
								</div>
							) : null}
						</div>

						{isModalOpen ? (
							<div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
								<div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
									<div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onCloseModal} />
									<div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
										<div className="px-6 py-4 bg-blue-600">
											<div className="flex items-center justify-between">
												<h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit Course' : 'Add Course'}</h3>
												<button className="text-white hover:text-gray-200" onClick={onCloseModal}>
													<svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
												</button>
											</div>
										</div>
										<div className="px-6 py-5 bg-white">
											{error ? <div className="mb-4 p-3 rounded border border-red-200 text-red-700 bg-red-50 text-sm">{error}</div> : null}
											<form className="space-y-5" onSubmit={handleSubmit}>
												<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
													<div className="md:col-span-1">
														<label className="block mb-2 text-sm font-medium text-gray-700">Course Code *</label>
														<input
															type="text"
															name="coursecode"
															maxLength="10"
															value={formState.coursecode}
															onChange={handleFieldChange}
															className="block w-full px-4 py-3 uppercase border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
															placeholder="CS101"
															required
														/>
													</div>

													<div className="md:col-span-1">
														<label className="block mb-2 text-sm font-medium text-gray-700">Course Name *</label>
														<input
															type="text"
															name="coursename"
															maxLength="100"
															value={formState.coursename}
															onChange={handleFieldChange}
															className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
															placeholder="Course Name"
															required
														/>
													</div>

													<div className="md:col-span-1">
														<label className="block mb-2 text-sm font-medium text-gray-700">Elective Group</label>
														<select
															name="elective_group_id"
															value={formState.elective_group_id}
															onChange={handleFieldChange}
															className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
														>
															<option value="">Elective Group Not Applicable</option>
															{electiveGroups.map((group) => (
																<option key={group.id} value={group.id}>{group.group_name}</option>
															))}
														</select>
													</div>

													<div className="md:col-span-1">
														<label className="block mb-2 text-sm font-medium text-gray-700">Pre Requisite Course / Information</label>
														<select
															name="pre_req"
															value={formState.pre_req}
															onChange={handleFieldChange}
															className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
														>
															<option value="">Select pre requisite / type</option>
															<option value="-1">Text</option>
															{courseOptions.map((courseOption) => (
																<option key={courseOption.id} value={courseOption.id}>{courseOption.label}</option>
															))}
														</select>
													</div>

													<div className="md:col-span-1 flex items-center">
														<label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700 pt-7">
															<input
																type="checkbox"
																name="compulsory_prereq"
																checked={formState.compulsory_prereq === 'Yes'}
																onChange={handleFieldChange}
																className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
															/>
															<span>Compulsory Pre-Requisite</span>
														</label>
													</div>

													{formState.pre_req === '-1' ? (
														<div className="md:col-span-1">
															<label className="block mb-2 text-sm font-medium text-gray-700">Type in the prerequisite</label>
															<input
																type="text"
																name="pre_req_text"
																maxLength="200"
																value={formState.pre_req_text}
																onChange={handleFieldChange}
																className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
																placeholder="Enter Pre Requisite"
																required
															/>
														</div>
													) : <div className="md:col-span-1" />}

													<div className="md:col-span-1">
														<label className="block mb-2 text-sm font-medium text-gray-700">Restricted</label>
														<select
															name="restricted"
															value={formState.restricted}
															onChange={handleFieldChange}
															className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
														>
															<option value="">Select a Restricted Course</option>
															{courseOptions.map((courseOption) => (
																<option key={courseOption.id} value={courseOption.id}>{courseOption.label}</option>
															))}
														</select>
													</div>

													<div className="md:col-span-1">
														<label className="block mb-2 text-sm font-medium text-gray-700">Semester *</label>
														<select
															name="semester"
															value={formState.semester}
															onChange={handleFieldChange}
															className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
															required
														>
															<option value="">Select semester</option>
															{semesterOptions.map((semester) => (
																<option key={semester} value={semester}>{semester}</option>
															))}
														</select>
													</div>

													<div className="md:col-span-1">
														<label className="block mb-2 text-sm font-medium text-gray-700">Offering Department *</label>
														<select
															name="department_id"
															value={formState.department_id}
															onChange={handleFieldChange}
															className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
															required
														>
															<option value="">Select a Department</option>
															{departments.map((department) => (
																<option key={department.id} value={department.id}>{department.name}</option>
															))}
														</select>
													</div>
												</div>

												<div className="flex justify-end space-x-4 pt-4">
													<button type="button" onClick={onCloseModal} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button>
													<button type="submit" disabled={isSubmitting} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">{isSubmitting ? 'Saving...' : editingId ? 'Update Course' : 'Create Course'}</button>
												</div>
											</form>
										</div>
									</div>
								</div>
							</div>
						) : null}
					</div>
				</main>
			</div>
		</div>
	);
}