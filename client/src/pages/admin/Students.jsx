import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import Notification from '../../components/common/Notification';
import {
	createStudent,
	deleteStudent,
	downloadStudentTemplate,
	getStudentMeta,
	getStudents,
	importStudents,
	updateStudent
} from '../../api/student.api';

const PAGE_SIZE = 10;
const semesterOptions = ['1', '2', '3', '4', '5', '6', '7', '8'];

const initialFormState = {
	name: '',
	email: '',
	uid: '',
	usn: '',
	department_id: '',
	semester: '',
	cgpa: ''
};

function normalizeFormState(formState) {
	return {
		name: formState.name.trim(),
		email: formState.email.trim().toLowerCase(),
		uid: formState.uid.trim().toUpperCase(),
		usn: formState.usn.trim().toUpperCase(),
		department_id: Number(formState.department_id),
		semester: Number(formState.semester),
		cgpa: Number(formState.cgpa)
	};
}

export default function StudentsPage() {
	const token = localStorage.getItem('token');
	const [students, setStudents] = useState([]);
	const [departments, setDepartments] = useState([]);
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

	useEffect(() => {
		loadPageData();
	}, []);

	async function loadPageData() {
		try {
			setIsLoading(true);
			setError('');
			const [studentsResponse, metaResponse] = await Promise.all([
				getStudents(token),
				getStudentMeta(token)
			]);

			const studentData = studentsResponse?.data?.data || studentsResponse?.data || [];
			const metaData = metaResponse?.data?.data || metaResponse?.data || {};

			setStudents(Array.isArray(studentData) ? studentData : []);
			setDepartments(Array.isArray(metaData.departments) ? metaData.departments : []);
		} catch (requestError) {
			setError(requestError?.response?.data?.error || 'Unable to load students');
			setStudents([]);
			setDepartments([]);
		} finally {
			setIsLoading(false);
		}
	}

	function showNotification(message, type = 'success') {
		setNotification({ show: true, message, type });
	}

	function closeModal() {
		setIsModalOpen(false);
		setFormState(initialFormState);
		setEditingId(null);
		setError('');
	}

	function openCreateModal() {
		closeModal();
		setIsModalOpen(true);
	}

	async function handleTemplateDownload() {
		try {
			setIsDownloadingTemplate(true);
			setError('');
			const response = await downloadStudentTemplate(token);
			const blob = new Blob([
				response.data
			], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = 'StudentTemplate.xlsx';
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
			const response = await importStudents(formData, token);
			const result = response?.data?.data || response?.data || {};
			const importedCount = result.importedCount || 0;
			showNotification(`${importedCount} student${importedCount === 1 ? '' : 's'} imported successfully`, 'success');
			setSelectedImportFile(null);
			if (importInputRef.current) {
				importInputRef.current.value = '';
			}
			await loadPageData();
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to import students';
			setError(message);
			showNotification(message, 'error');
		} finally {
			setIsImporting(false);
		}
	}

	function handleFieldChange(event) {
		const { name, value } = event.target;
		setFormState((current) => ({
			...current,
			[name]: name === 'email'
				? value.toLowerCase()
				: name === 'uid' || name === 'usn'
					? value.toUpperCase()
					: value
		}));
		if (error) setError('');
	}

	function handleEdit(student) {
		setEditingId(student.id);
		setFormState({
			name: student.name || '',
			email: student.email || '',
			uid: student.uid || '',
			usn: student.usn || '',
			department_id: student.department_id ? String(student.department_id) : '',
			semester: student.semester ? String(student.semester) : '',
			cgpa: student.cgpa != null ? String(student.cgpa) : ''
		});
		setIsModalOpen(true);
		setError('');
	}

	async function handleSubmit(event) {
		event.preventDefault();

		if (!formState.name.trim()) {
			setError('Student name is required');
			return;
		}

		if (!formState.email.trim()) {
			setError('Email is required');
			return;
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) {
			setError('Please enter a valid email address');
			return;
		}

		if (!formState.uid.trim()) {
			setError('UID is required');
			return;
		}

		if (formState.uid.trim().length > 12) {
			setError('UID must be at most 12 characters');
			return;
		}

		if (!formState.usn.trim()) {
			setError('USN is required');
			return;
		}

		if (formState.usn.trim().length > 12) {
			setError('USN must be at most 12 characters');
			return;
		}

		if (!formState.department_id) {
			setError('Please select a department');
			return;
		}

		if (!semesterOptions.includes(formState.semester)) {
			setError('Please select a semester between 1 and 8');
			return;
		}

		if (formState.cgpa === '') {
			setError('CGPA is required');
			return;
		}

		const cgpaValue = Number(formState.cgpa);
		if (!Number.isFinite(cgpaValue) || cgpaValue < 0 || cgpaValue > 10) {
			setError('CGPA must be between 0 and 10');
			return;
		}

		setIsSubmitting(true);
		setError('');

		try {
			const payload = normalizeFormState(formState);
			if (editingId) {
				await updateStudent(editingId, payload, token);
				showNotification('Student updated successfully', 'success');
			} else {
				await createStudent(payload, token);
				showNotification('Student created successfully', 'success');
			}

			closeModal();
			await loadPageData();
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to save student';
			setError(message);
			showNotification(message, 'error');
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleDelete(id) {
		const confirmed = window.confirm('Delete this student?');
		if (!confirmed) return;

		try {
			setError('');
			await deleteStudent(id, token);
			if (editingId === id) {
				closeModal();
			}
			showNotification('Student deleted successfully', 'success');
			await loadPageData();
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to delete student';
			setError(message);
			showNotification(message, 'error');
		}
	}

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return students;

		return students.filter((student) => (
			student.name?.toLowerCase().includes(query)
			|| student.email?.toLowerCase().includes(query)
			|| student.uid?.toLowerCase().includes(query)
			|| student.usn?.toLowerCase().includes(query)
			|| String(student.semester || '').includes(query)
			|| String(student.cgpa || '').toLowerCase().includes(query)
			|| student.department_name?.toLowerCase().includes(query)
			|| student.department_shortname?.toLowerCase().includes(query)
		));
	}, [students, search]);

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
	}, [search, students]);

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

						<div className="mb-12 text-center">
							<h1 className="mb-2 text-4xl font-extrabold text-gray-900">Students</h1>
							<p className="text-lg text-gray-600">Create, update and manage student records</p>
						</div>

						<div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
							<div className="relative w-full sm:w-80">
								<input
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search students..."
									className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								/>
								<svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
							</div>
							<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
								<button
									type="button"
									onClick={handleTemplateDownload}
									disabled={isDownloadingTemplate}
									className="flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white shadow-lg transition-colors hover:bg-emerald-700"
								>
									<svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
										className="flex items-center justify-center rounded-lg bg-amber-500 px-5 py-3 font-medium text-white shadow-lg transition-colors hover:bg-amber-600 disabled:opacity-50"
									>
										<svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12" />
										</svg>
										{isImporting ? 'Importing...' : 'Import Student List'}
									</button>
								</form>
								<button
									onClick={openCreateModal}
									className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-blue-700 sm:w-auto"
								>
									<svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
									Add Student
								</button>
							</div>
						</div>

						{error && !isModalOpen ? (
							<div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
						) : null}

						<div className="mb-10 overflow-hidden rounded-xl bg-white shadow-xl">
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-blue-600">
										<tr>
											<th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Sl.No</th>
											<th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Name</th>
											<th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Email</th>
											<th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">UID</th>
											<th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">USN</th>
											<th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Department</th>
											<th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">Semester</th>
											<th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white">CGPA</th>
											<th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white">Action</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200 bg-white">
										{isLoading ? (
											<tr><td colSpan="9" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
										) : filtered.length === 0 ? (
											<tr><td colSpan="9" className="px-6 py-12 text-center text-gray-500">No students found</td></tr>
										) : (
											paginated.map((student, index) => (
												<tr key={student.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} transition-colors duration-150 hover:bg-blue-50`}>
													<td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + index + 1}</td>
													<td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{student.name}</td>
													<td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{student.email}</td>
													<td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">{student.uid}</td>
													<td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">{student.usn}</td>
													<td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{student.department_name || student.department_shortname || '-'}</td>
													<td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{student.semester || '-'}</td>
													<td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">{student.cgpa || '-'}</td>
													<td className="whitespace-nowrap px-6 py-4 text-center text-sm font-medium">
														<div className="flex items-center justify-center space-x-2">
															<button
																onClick={() => handleEdit(student)}
																className="rounded-lg bg-blue-600 p-2 text-white transition-colors duration-200 hover:bg-blue-700"
																title="Edit Student"
															>
																<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
																</svg>
															</button>
															<button
																onClick={() => handleDelete(student.id)}
																className="rounded-lg bg-red-600 p-2 text-white transition-colors duration-200 hover:bg-red-700"
																title="Delete Student"
															>
																<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
								<div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
									<p className="text-sm text-gray-600">Showing {startEntry} to {endEntry} of {filtered.length} entries</p>
									<div className="flex items-center gap-2">
										<button
											className="rounded border border-gray-300 bg-white px-3 py-1 text-gray-700 disabled:opacity-50"
											onClick={() => setPage((current) => Math.max(1, current - 1))}
											disabled={page === 1}
										>
											Prev
										</button>
										{visiblePages.map((pageNumber) => (
											<button
												key={pageNumber}
												onClick={() => setPage(pageNumber)}
												className={`rounded border px-3 py-1 ${page === pageNumber ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
											>
												{pageNumber}
											</button>
										))}
										<span className="text-sm text-gray-700">of {totalPages}</span>
										<button
											className="rounded border border-gray-300 bg-white px-3 py-1 text-gray-700 disabled:opacity-50"
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
								<div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
									<div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeModal} />
									<div className="inline-block w-full transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:align-middle">
										<div className="bg-blue-600 px-6 py-4">
											<div className="flex items-center justify-between">
												<h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit Student' : 'Add Student'}</h3>
												<button className="text-white hover:text-gray-200" onClick={closeModal}>
													<svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
												</button>
											</div>
										</div>
										<div className="bg-white px-6 py-5">
											{error ? <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
											<form className="space-y-5" onSubmit={handleSubmit}>
												<div className="grid grid-cols-1 gap-5 md:grid-cols-2">
													<div className="md:col-span-1">
														<label className="mb-2 block text-sm font-medium text-gray-700">Student Name *</label>
														<input
															type="text"
															name="name"
															value={formState.name}
															onChange={handleFieldChange}
															className="block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															placeholder="Enter student name"
															required
														/>
													</div>

													<div className="md:col-span-1">
														<label className="mb-2 block text-sm font-medium text-gray-700">Email *</label>
														<input
															type="email"
															name="email"
															value={formState.email}
															onChange={handleFieldChange}
															className="block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															placeholder="student@example.com"
															required
														/>
													</div>

													<div className="md:col-span-1">
														<label className="mb-2 block text-sm font-medium text-gray-700">UID *</label>
														<input
															type="text"
															name="uid"
															maxLength="12"
															value={formState.uid}
															onChange={handleFieldChange}
															className="block w-full rounded-lg border border-gray-300 px-4 py-3 uppercase focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															placeholder="Enter UID"
															required
														/>
													</div>

													<div className="md:col-span-1">
														<label className="mb-2 block text-sm font-medium text-gray-700">USN *</label>
														<input
															type="text"
															name="usn"
															maxLength="12"
															value={formState.usn}
															onChange={handleFieldChange}
															className="block w-full rounded-lg border border-gray-300 px-4 py-3 uppercase focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															placeholder="Enter USN"
															required
														/>
													</div>

													<div className="md:col-span-1">
														<label className="mb-2 block text-sm font-medium text-gray-700">Semester *</label>
														<select
															name="semester"
															value={formState.semester}
															onChange={handleFieldChange}
															className="block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															required
														>
															<option value="">Select semester</option>
															{semesterOptions.map((semester) => (
																<option key={semester} value={semester}>{semester}</option>
															))}
														</select>
													</div>

													<div className="md:col-span-1">
														<label className="mb-2 block text-sm font-medium text-gray-700">Offering Department *</label>
														<select
															name="department_id"
															value={formState.department_id}
															onChange={handleFieldChange}
															className="block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															required
														>
															<option value="">Select a Department</option>
															{departments.map((department) => (
																<option key={department.id} value={department.id}>{department.name}</option>
															))}
														</select>
													</div>

													<div className="md:col-span-1">
														<label className="mb-2 block text-sm font-medium text-gray-700">CGPA *</label>
														<input
															type="number"
															name="cgpa"
															min="0"
															max="10"
															step="0.01"
															value={formState.cgpa}
															onChange={handleFieldChange}
															className="block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
															placeholder="Enter CGPA"
															required
														/>
													</div>
												</div>

												<div className="flex justify-end space-x-4 pt-4">
													<button type="button" onClick={closeModal} className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Cancel</button>
													<button type="submit" disabled={isSubmitting} className="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50">{isSubmitting ? 'Saving...' : editingId ? 'Update Student' : 'Create Student'}</button>
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