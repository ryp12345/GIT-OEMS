import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Notification from '../../components/common/Notification';
import { checkStudentDetails } from '../../api/student.api';

export default function CheckNamePage() {
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const [values, setValues] = useState({ uid1: '', name1: '', usn: '' });
  const [result, setResult] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await checkStudentDetails(values, token);
      setResult(res.data || res);
    } catch (err) {
      setNotification({ show: true, message: err?.response?.data?.error || err?.message || 'Check failed', type: 'error' });
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center p-6">
      <div className="w-full max-w-3xl">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: 'info' })} />

        <h1 className="text-2xl font-semibold mb-3">Check Student</h1>
        <form onSubmit={handleSubmit} className="mb-4 rounded-lg bg-white p-4 shadow">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input placeholder="UID" value={values.uid1} onChange={(e) => setValues((s) => ({ ...s, uid1: e.target.value }))} className="border p-2 rounded" />
            <input placeholder="Name" value={values.name1} onChange={(e) => setValues((s) => ({ ...s, name1: e.target.value }))} className="border p-2 rounded" />
            <input placeholder="USN" value={values.usn} onChange={(e) => setValues((s) => ({ ...s, usn: e.target.value }))} className="border p-2 rounded" />
          </div>
          <div className="mt-4 text-right">
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">Check</button>
          </div>
        </form>

        {result && (
          <div className="rounded-lg bg-white p-4 shadow">
            {!result.instance && result.message ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-4 text-amber-800">
                {result.message}
              </div>
            ) : result.registered ? (
              <>
                <h3 className="font-semibold mb-2">Existing Preferences</h3>
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-2">Course Code</th>
                      <th className="p-2">Course Name</th>
                      <th className="p-2">Pref</th>
                      <th className="p-2">Final</th>
                      <th className="p-2">Allocation Status</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.preferences.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{p.coursecode}</td>
                        <td className="p-2">{p.coursename}</td>
                        <td className="p-2">{p.preferred}</td>
                        <td className="p-2">{p.final_preference}</td>
                        <td className="p-2">{p.allocation_status}</td>
                        <td className="p-2">{p.status ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <>
                <div className="mb-4 rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                  Student verified for {result.instance?.instancename || 'active instance'}.
                </div>
                <h3 className="font-semibold mb-2">Available Courses (grouped)</h3>
                {Object.keys(result.courses || {}).map((grp) => (
                  <div key={grp} className="mb-4">
                    <h4 className="font-medium">{grp}</h4>
                    <table className="min-w-full table-auto mb-2">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="p-2">Code</th>
                          <th className="p-2">Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.courses[grp].map((c) => (
                          <tr key={c.icid} className="border-t">
                            <td className="p-2">{c.coursecode}</td>
                            <td className="p-2">{c.coursename}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                <div className="text-right">
                  <button onClick={() => navigate('/student/registration', { state: { usn: values.usn, uid: values.uid1, name: values.name1 } })} className="rounded bg-green-600 px-4 py-2 text-white">Go to Registration</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
