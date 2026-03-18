import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Notification from '../../components/common/Notification';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import {
	createInstance,
	deleteInstance,
	getInstances,
	updateInstance
} from '../../api/instance.api';

const initialFormState = {
	instancename: '',
	semester: '',
	academic_year: '',
	status: 'Active'
};

const semesterOptions = ['1', '2', '3', '4', '5', '6', '7', '8'];

function getAcademicYearOptions() {
	const today = new Date();
	const currentYear = today.getFullYear();
	const currentMonth = today.getMonth();
	const academicYearStart = currentMonth >= 6 ? currentYear : currentYear - 1;

	return Array.from({ length: 7 }, (_, index) => {
		const startYear = academicYearStart + index;
		const endYear = startYear + 1;
		return `${startYear}-${endYear}`;
	});
}

function normalizeFormState(formState) {
	return {
		instancename: formState.instancename.trim(),
		semester: Number(formState.semester),
		academic_year: formState.academic_year.trim(),
		status: formState.status
	};
}

export default function ElectiveInstancePage() {
	const token = localStorage.getItem('token');
	const navigate = useNavigate();
	const academicYearOptions = useMemo(() => getAcademicYearOptions(), []);
	const [instances, setInstances] = useState([]);
	const [search, setSearch] = useState('');
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formState, setFormState] = useState(initialFormState);
	const [editingId, setEditingId] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
	const [page, setPage] = useState(1);
	const PAGE_SIZE = 10;

	useEffect(() => {
		loadInstances();
	}, []);

	async function loadInstances() {
		try {
			setIsLoading(true);
			setError('');
			const response = await getInstances(token);
			const data = response?.data?.data || response?.data || [];
			setInstances(Array.isArray(data) ? data : []);
		} catch (requestError) {
			setError(requestError?.response?.data?.error || 'Unable to load elective instances');
			setInstances([]);
		} finally {
			setIsLoading(false);
		}
	}

	function handleFieldChange(event) {
		const { name, value } = event.target;
		setFormState((current) => ({ ...current, [name]: value }));
		if (error) setError('');
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

	function handleEdit(instance) {
		setEditingId(instance.id);
		setFormState({
			instancename: instance.instancename,
			semester: String(instance.semester),
			academic_year: instance.academic_year,
			status: instance.status
		});
		setIsModalOpen(true);
		setError('');
	}

	async function handleSubmit(event) {
		event.preventDefault();

		if (!formState.instancename.trim()) {
			setError('Instance name is required');
			return;
		}

		if (!formState.semester || Number(formState.semester) <= 0) {
			setError('Please select a semester');
			return;
		}

		if (!semesterOptions.includes(formState.semester)) {
			setError('Semester must be between 1 and 8');
			return;
		}

		if (!formState.academic_year.trim()) {
			setError('Academic year is required');
			return;
		}

		if (!academicYearOptions.includes(formState.academic_year)) {
			setError('Please select a valid academic year');
			return;
		}

		setIsSubmitting(true);
		setError('');

		try {
			const payload = normalizeFormState(formState);
			if (editingId) {
				await updateInstance(editingId, payload, token);
				showNotification('Elective instance updated successfully', 'success');
			} else {
				await createInstance(payload, token);
				showNotification('Elective instance created successfully', 'success');
			}

			onCloseModal();
			await loadInstances();
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to save elective instance';
			setError(message);
			showNotification(message, 'error');
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleDelete(id) {
		const confirmed = window.confirm('Delete this elective instance?');
		if (!confirmed) return;

		try {
			setError('');
			await deleteInstance(id, token);
			if (editingId === id) {
				onCloseModal();
			}
			showNotification('Elective instance deleted successfully', 'success');
			await loadInstances();
		} catch (requestError) {
			const message = requestError?.response?.data?.error || 'Unable to delete elective instance';
			setError(message);
			showNotification(message, 'error');
		}
	}

	const filtered = useMemo(() => {
		const sorted = [...instances].sort((left, right) => (right.id || 0) - (left.id || 0));
		const query = search.trim().toLowerCase();

		if (!query) return sorted;

		return sorted.filter((instance) => (
			instance.instancename?.toLowerCase().includes(query)
			|| String(instance.semester || '').includes(query)
			|| instance.academic_year?.toLowerCase().includes(query)
			|| instance.status?.toLowerCase().includes(query)
		));
	}, [instances, search]);

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
	}, [search, instances]);

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
							<h1 className="mb-2 text-4xl font-extrabold text-gray-900">Elective Instance</h1>
							<p className="text-lg text-gray-600">Create, update and manage elective instances</p>
						</div>

						<div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
							<div className="relative w-full sm:w-80">
								<input
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search instances..."
									className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								/>
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
							</div>
							<button onClick={openCreateModal} className="flex items-center justify-center w-full px-6 py-3 font-medium text-white transition-all duration-300 transform rounded-lg shadow-lg bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 hover:scale-105 sm:w-auto">
								<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
								Add Elective Instance
							</button>
						</div>

						<div className="mb-10 overflow-hidden bg-white shadow-xl rounded-xl">
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-blue-600">
										<tr>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">S.No</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Instance Name</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Semester</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Academic Year</th>
											<th className="px-6 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Status</th>
											<th className="px-6 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Actions</th>
										</tr>
									</thead>
									<tbody className="bg-white divide-y divide-gray-200">
										{isLoading ? (
											<tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
										) : filtered.length === 0 ? (
											<tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No elective instances found</td></tr>
										) : (
											paginated.map((instance, index) => (
												<tr key={instance.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors duration-150`}>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + index + 1}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{instance.instancename}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{instance.semester}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{instance.academic_year}</td>
													<td className="px-6 py-4 whitespace-nowrap text-sm">
														<span className={`px-3 py-1 text-xs font-medium rounded-full ${instance.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
															{instance.status}
														</span>
													</td>
													<td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
														<div className="flex items-center justify-center space-x-2">
															<button
																onClick={() => navigate(`/elective-instance/${instance.id}/view`)}
																className="p-2 text-white transition-colors duration-200 bg-emerald-600 rounded-lg hover:bg-emerald-700"
																title="View Elective Instance"
															>
																<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
																</svg>
															</button>
															<button
																onClick={() => handleEdit(instance)}
																className="p-2 text-white transition-colors duration-200 bg-blue-600 rounded-lg hover:bg-blue-700"
																title="Edit Elective Instance"
															>
																<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
																</svg>
															</button>
															<button
																onClick={() => handleDelete(instance.id)}
																className="p-2 text-white transition-colors duration-200 bg-red-600 rounded-lg hover:bg-red-700"
																title="Delete Elective Instance"
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
									<div className="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
										<div className="px-6 py-4 bg-blue-600">
											<div className="flex items-center justify-between">
												<h3 className="text-lg font-medium leading-6 text-white">{editingId ? 'Edit Elective Instance' : 'Add Elective Instance'}</h3>
												<button className="text-white hover:text-gray-200" onClick={onCloseModal}>
													<svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
												</button>
											</div>
										</div>
										<div className="px-6 py-5 bg-white">
											{error ? <div className="mb-4 p-3 rounded border border-red-200 text-red-700 bg-red-50 text-sm">{error}</div> : null}
											<form className="space-y-5" onSubmit={handleSubmit}>
												<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
													<div className="md:col-span-2">
														<label className="block mb-2 text-sm font-medium text-gray-700">Instance Name *</label>
														<input
															type="text"
															name="instancename"
															value={formState.instancename}
															onChange={handleFieldChange}
															className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
															placeholder="Instance Name"
															required
														/>
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
														<label className="block mb-2 text-sm font-medium text-gray-700">Academic Year *</label>
														<select
															name="academic_year"
															value={formState.academic_year}
															onChange={handleFieldChange}
															className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
															required
														>
															<option value="">Select academic year</option>
															{academicYearOptions.map((academicYear) => (
																<option key={academicYear} value={academicYear}>{academicYear}</option>
															))}
														</select>
													</div>

													{editingId ? (
														<div className="md:col-span-1">
															<label className="block mb-2 text-sm font-medium text-gray-700">Status</label>
															<select
																name="status"
																value={formState.status}
																onChange={handleFieldChange}
																className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
															>
																<option value="Active">Active</option>
																<option value="Inactive">Inactive</option>
															</select>
														</div>
													) : null}
												</div>

												<div className="flex justify-end space-x-4 pt-4">
													<button type="button" onClick={onCloseModal} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button>
													<button type="submit" disabled={isSubmitting} className="inline-flex justify-center px-6 py-3 text-sm font-medium text-white border border-transparent rounded-lg shadow-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">{isSubmitting ? 'Saving...' : editingId ? 'Update Instance' : 'Create Instance'}</button>
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