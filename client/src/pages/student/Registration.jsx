import { useState } from 'react';
import Notification from '../../components/common/Notification';
import { submitPreferences } from '../../api/preferences.api';
import { checkStudentDetails } from '../../api/student.api';

export default function StudentRegistrationPage() {
  const token = localStorage.getItem('token');
  const [agreed, setAgreed] = useState(false);
  const [showBasic, setShowBasic] = useState(false);
  const [showCourses, setShowCourses] = useState(false);
  const [basic, setBasic] = useState({ usn: '', uid: '', name: '' });
  const [courses, setCourses] = useState([]);
  const [registeredPreferences, setRegisteredPreferences] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  async function handleProceed() {
    if (!basic.usn || !basic.uid || !basic.name) {
      setNotification({ show: true, message: 'Please fill basic details', type: 'error' });
      return;
    }

    try {
      const res = await checkStudentDetails({ uid1: basic.uid, name1: basic.name, usn: basic.usn }, token);
      const data = res?.data || {};
      if (data.registered) {
        setRegisteredPreferences(data.preferences || []);
        setCourses([]);
      } else {
        // data.courses is an object grouped by group name
        const grouped = data.courses || {};
        const flat = [];
        Object.keys(grouped).forEach((grp) => {
          grouped[grp].forEach((c) => flat.push({ ...c, group_name: grp }));
        });
        setCourses(flat);
      }
      setShowBasic(false);
      setShowCourses(true);
    } catch (err) {
      setNotification({ show: true, message: err?.response?.data?.error || err?.message || 'Failed to verify', type: 'error' });
    }
  }

  function handleCheckChange(courseId, checked) {
    setSelectedOrder((prev) => {
      const copy = [...prev];
      if (checked) {
        copy.push(courseId);
      } else {
        const idx = copy.indexOf(courseId);
        if (idx >= 0) copy.splice(idx, 1);
      }
      return copy;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selectedOrder.length === 0) {
      setNotification({ show: true, message: 'Please select at least one course', type: 'error' });
      return;
    }

    const preferences = selectedOrder.map((courseId, index) => ({
      instance_course_id: Number(courseId),
      usn: basic.usn,
      preferred: index + 1
    }));

    try {
      await submitPreferences({ preferences }, token);
      setNotification({ show: true, message: 'Preferences saved', type: 'success' });
    } catch (err) {
      setNotification({ show: true, message: err?.response?.data?.error || 'Failed to save', type: 'error' });
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center p-6">
      <div className="w-full max-w-4xl">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: 'info' })} />

        <h1 className="text-2xl font-semibold">Elective Registration</h1>
        <p className="text-sm text-gray-600 mb-4">Follow the steps to save your preferences.</p>

        <div className="mb-6">
          <label className="inline-flex items-center">
            <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setShowBasic(true); }} className="mr-2" />
            I have read the user manual.
          </label>
        </div>

        {showBasic && (
          <div className="mb-6 rounded-lg bg-white p-4 shadow">
            <h2 className="font-semibold">Basic Details</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 mt-3">
              <input placeholder="USN" value={basic.usn} onChange={(e) => setBasic((s) => ({ ...s, usn: e.target.value }))} className="border p-2 rounded" />
              <input placeholder="UID" value={basic.uid} onChange={(e) => setBasic((s) => ({ ...s, uid: e.target.value }))} className="border p-2 rounded" />
              <input placeholder="Full name" value={basic.name} onChange={(e) => setBasic((s) => ({ ...s, name: e.target.value }))} className="border p-2 rounded" />
            </div>
            <div className="mt-4 text-right">
              <button type="button" onClick={() => setShowBasic(false)} className="mr-2 rounded border px-3 py-1">Back</button>
              <button type="button" onClick={handleProceed} className="rounded bg-blue-600 px-4 py-1 text-white">Proceed</button>
            </div>
          </div>
        )}

        {showCourses && registeredPreferences && (
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="font-semibold mb-3">Existing Preferences</h3>
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2">Course Code</th>
                  <th className="p-2">Course Name</th>
                  <th className="p-2">Preference</th>
                  <th className="p-2">Final Preference</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {registeredPreferences.map((p, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{p.coursecode}</td>
                    <td className="p-2">{p.coursename}</td>
                    <td className="p-2">{p.preferred}</td>
                    <td className="p-2">{p.final_preference}</td>
                    <td className="p-2">{p.allocation_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showCourses && !registeredPreferences && (
          <form onSubmit={handleSubmit} className="rounded-lg bg-white p-4 shadow">
            <h3 className="font-semibold mb-3">Available Courses</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-2">Select</th>
                    <th className="p-2">Course Code</th>
                    <th className="p-2">Course Name</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">
                        <input type="checkbox" checked={selectedOrder.indexOf(String(c.id)) >= 0 || selectedOrder.indexOf(c.id) >= 0} onChange={(e) => handleCheckChange(String(c.id), e.target.checked)} />
                      </td>
                      <td className="p-2">{c.coursecode}</td>
                      <td className="p-2">{c.coursename}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>Selected: {selectedOrder.length}</div>
              <div>
                <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white">Confirm Preferences</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
