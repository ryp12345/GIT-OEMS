import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import { getInstances } from '../../api/instance.api';
import { getCourseMeta } from '../../api/course.api';
import { getAllocations } from '../../api/allocation.api';

const cards = [
  { title: 'Messages', value: '4', tone: 'bg-sky-600' },
  { title: 'Notifications', value: '10', tone: 'bg-amber-500' },
  { title: 'Tasks', value: '9', tone: 'bg-emerald-600' },
  { title: 'Reports', value: '65', tone: 'bg-indigo-600' }
];

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

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    async function loadMeta() {
      try {
        const instRes = await getInstances(token);
        const instData = instRes?.data?.data || instRes?.data || [];
        setInstances(Array.isArray(instData) ? instData : []);
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
        const res = await getAllocations(selectedInstance, departmentId, token);
        const data = res?.data || {};
        setAllocations(Array.isArray(data.allocated) ? data.allocated : []);
      } catch (err) {
        setError(err?.response?.data?.error || 'Unable to load allocations');
        setAllocations([]);
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
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700">Instance</label>
              <select
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
                className="mt-1 block w-96 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                aria-label="Select instance"
              >
                <option value="">-- Select instance --</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>{`${inst.instancename} (${inst.academic_year} - sem ${inst.semester})`}</option>
                ))}
              </select>
            </div>

            

            <div className="ml-auto" />
          </div>

          {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}

          <div className="mt-6 rounded-lg overflow-auto border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-600 rounded-t-lg">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-white">USN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Name</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-white">Preferred</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-white">Final Preference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white">Subject Allotted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoadingAllocations ? (
                  <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                ) : allocations.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No allocations found</td></tr>
                ) : (
                  allocations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row, idx) => (
                    <tr key={`${row.usn}-${row.coursecode}-${(page-1)*PAGE_SIZE+idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
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
          {allocations.length > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">Showing {Math.min((page-1)*PAGE_SIZE+1, allocations.length)} to {Math.min(page*PAGE_SIZE, allocations.length)} of {allocations.length}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((c) => Math.max(1, c - 1))}
                  disabled={page === 1}
                  className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 disabled:opacity-50"
                >Prev</button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.max(1, Math.ceil(allocations.length / PAGE_SIZE)) }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i + 1)}
                      className={`rounded border px-3 py-1 ${page === i + 1 ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                    >{i + 1}</button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPage((c) => Math.min(Math.ceil(allocations.length / PAGE_SIZE), c + 1))}
                  disabled={page === Math.ceil(allocations.length / PAGE_SIZE)}
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
