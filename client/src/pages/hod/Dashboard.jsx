import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import { getInstances } from '../../api/instance.api';
import { getCourses } from '../../api/course.api';
import { getInstanceView } from '../../api/instance.api';
import { getAllocations } from '../../api/allocation.api';

export default function HodDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const token = localStorage.getItem('token');

  const { user } = useAuth();
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [isLoadingAllocations, setIsLoadingAllocations] = useState(false);
  const [error, setError] = useState('');
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  const [courses, setCourses] = useState([]);
  const [instanceCourses, setInstanceCourses] = useState([]);
  const [search, setSearch] = useState('');

  const deptId = user?.deptid || user?.department_id || user?.deptId || null;
  const deptInstanceCoursesCount = instanceCourses.filter((c) => {
    if (!deptId) return true;
    const belongsToDept = Number(c.department_id) === Number(deptId);
    const permitted = Array.isArray(c.department_ids) && c.department_ids.includes(Number(deptId));
    return belongsToDept || permitted;
  }).length;

  

  // Show zeros until an instance is selected
  const cards = [
    { key: 'allocated', title: 'Allocated Students', value: selectedInstance ? allocations.length : 0, tone: 'bg-amber-500' },
    { key: 'courses', title: 'Courses Offered', value: selectedInstance ? deptInstanceCoursesCount : 0, tone: 'bg-indigo-600' }
  ];

  const filteredAllocations = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return allocations;
    return allocations.filter((row) => {
      const usn = String(row.usn || '').toLowerCase();
      const name = String(row.name || '').toLowerCase();
      return usn.includes(q) || name.includes(q);
    });
  }, [allocations, search]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredAllocations.length / PAGE_SIZE)), [filteredAllocations.length]);
  const visiblePages = useMemo(() => {
    const startPage = Math.max(1, page - 1);
    const endPage = Math.min(totalPages, startPage + 2);
    const adjustedStart = Math.max(1, endPage - 2);

    return Array.from({ length: endPage - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }, [page, totalPages]);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    setPage(1);
  }, [search, allocations]);

  useEffect(() => {
    async function loadMeta() {
      try {
        const instRes = await getInstances(token);
        const instData = instRes?.data?.data || instRes?.data || [];
        setInstances(Array.isArray(instData) ? instData : []);

        // fetch courses for cards
        try {
          const coursesRes = await getCourses(token);
          const courseData = coursesRes?.data?.data || coursesRes?.data || [];
          setCourses(Array.isArray(courseData) ? courseData : []);
        } catch (innerErr) {
          // ignore course fetch errors for now
        }
      } catch (err) {
        // ignore silently for now
      }
    }

    loadMeta();
  }, [token]);

  useEffect(() => {
    async function loadForInstance() {
      setError('');
      setAllocations([]);
      setPage(1);
      if (!selectedInstance) return;
      const departmentId = user?.deptid || user?.department_id || user?.deptId || null;
      try {
        setIsLoadingAllocations(true);
        const [allocRes, viewRes] = await Promise.all([
          getAllocations(selectedInstance, departmentId, token),
          getInstanceView(selectedInstance, token)
        ]);
        const allocData = allocRes?.data || {};
        setAllocations(Array.isArray(allocData.allocated) ? allocData.allocated : []);
        const viewData = viewRes?.data || viewRes;
        const instCourses = Array.isArray(viewData?.courses) ? viewData.courses : viewData?.courses || [];
        setInstanceCourses(Array.isArray(instCourses) ? instCourses : []);
      } catch (err) {
        setError(err?.response?.data?.error || 'Unable to load allocations');
        setAllocations([]);
        setInstanceCourses([]);
      } finally {
        setIsLoadingAllocations(false);
      }
    }

    loadForInstance();
  }, [selectedInstance, token, user]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <span>HOD Dashboard</span>
              <span className="text-3xl font-bold text-slate-500">-</span>
              <span className="text-3xl font-bold text-slate-600">{user?.name || user?.shortname || ''}</span>
            </h1>
            <p className="text-sm text-slate-600">Open Elective Management System.</p>
          </div>
          <button type="button" onClick={handleLogout} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Sign out
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.title} className={`${card.tone} rounded-xl p-5 text-white shadow-lg`}>
              <p className="text-3xl font-extrabold">{card.value}</p>
              <p className="mt-2 text-sm font-medium text-white/90">{card.title}</p>
            </div>
          ))}
        </div>



        <div className="mt-8 rounded-xl bg-white p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-slate-900 text-center">Department Allocations</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="relative w-full sm:flex-1 sm:min-w-0 sm:max-w-sm">
              <label className="sr-only">Search allocations</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="mt-1 w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="w-full sm:w-80 sm:max-w-md">
              <select
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm"
              >
                <option value="">Select Instance</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>{`${inst.instancename} (${inst.academic_year} - sem ${inst.semester})`}</option>
                ))}
              </select>
            </div>

          
          </div>

          {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}

          <div className="mt-6 rounded-lg overflow-auto border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600 rounded-t-lg">
                <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Sl.No</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-white">USN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-white">Preferred</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-white">Final Preference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Subject Allotted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoadingAllocations ? (
                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                ) : filteredAllocations.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No allocations found</td></tr>
                ) : (
                  filteredAllocations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row, idx) => (
                    <tr key={`${row.usn}-${row.coursecode}-${(page-1)*PAGE_SIZE+idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-900">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700 text-center">{row.usn}</td>
                      <td className="px-4 py-4 text-sm text-gray-700 text-left">{row.name}</td>
                      <td className="px-4 py-4 text-sm text-gray-700 text-center">{row.preferred != null ? String(row.preferred) : '-'}</td>
                      <td className="px-4 py-4 text-sm text-gray-700 text-center">{row.final_preference != null ? String(row.final_preference) : '-'}</td>
                      <td className="px-4 py-4 text-sm text-gray-700 text-left">{row.coursecode ? `${row.coursecode} - ${row.coursename || ''}` : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredAllocations.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">Showing {Math.min((page-1)*PAGE_SIZE+1, filteredAllocations.length)} to {Math.min(page*PAGE_SIZE, filteredAllocations.length)} of {filteredAllocations.length}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((c) => Math.max(1, c - 1))}
                  disabled={page === 1}
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 disabled:opacity-50"
                >Prev</button>
                <div className="flex items-center gap-1">
                  {visiblePages.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`rounded border px-3 py-1 ${page === pageNumber ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                    >{pageNumber}</button>
                  ))}
                </div>
                <span className="text-sm text-gray-700">of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
                  disabled={page === totalPages}
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 disabled:opacity-50"
                >Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
