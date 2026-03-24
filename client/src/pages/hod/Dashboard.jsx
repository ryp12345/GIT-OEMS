import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const cards = [
  { title: 'Messages', value: '4', tone: 'bg-sky-600' },
  { title: 'Notifications', value: '10', tone: 'bg-amber-500' },
  { title: 'Tasks', value: '9', tone: 'bg-emerald-600' },
  { title: 'Reports', value: '65', tone: 'bg-indigo-600' }
];

export default function HodDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-6 md:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">HOD Dashboard</h1>
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
          <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
          <p className="mt-2 text-sm text-slate-600">
            This dashboard mirrors the legacy HOD page. Additional HOD-specific controls can be attached here.
          </p>
        </div>
      </div>
    </div>
  );
}
