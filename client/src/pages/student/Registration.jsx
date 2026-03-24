import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Notification from '../../components/common/Notification';
import { submitPreferences } from '../../api/preferences.api';
import { checkStudentDetails } from '../../api/student.api';

export default function StudentRegistrationPage() {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const [agreed, setAgreed] = useState(false);
  const [showBasic, setShowBasic] = useState(false);
  const [showCourses, setShowCourses] = useState(false);
  const [basic, setBasic] = useState({ usn: '', uid: '', name: '' });
  const [courses, setCourses] = useState([]);
  const [registeredPreferences, setRegisteredPreferences] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  useEffect(() => {
    const state = location?.state || {};
    if (state.usn || state.uid || state.name) {
      setBasic((current) => ({
        ...current,
        usn: state.usn || current.usn,
        uid: state.uid || current.uid,
        name: state.name || current.name
      }));
      setAgreed(true);
      setShowBasic(true);
    }
  }, [location]);

  const groupedCourses = useMemo(() => {
    const grouped = {};
    courses.forEach((course) => {
      const key = course.group_name || 'No Group';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(course);
    });
    return grouped;
  }, [courses]);

  const selectedPreferences = useMemo(() => {
    return selectedOrder.map((courseId, index) => {
      const course = courses.find((row) => String(row.icid ?? row.id) === String(courseId));
      return {
        instance_course_id: Number(courseId),
        preferred: index + 1,
        coursecode: course?.coursecode || '-',
        coursename: course?.coursename || '-'
      };
    });
  }, [courses, selectedOrder]);

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
        setSelectedOrder([]);
      } else {
        if (!data.instance) {
          setRegisteredPreferences(null);
          setCourses([]);
          setShowCourses(false);
          setNotification({ show: true, message: data.message || 'No active elective instance for your semester', type: 'error' });
          return;
        }

        // data.courses is an object grouped by group name
        const grouped = data.courses || {};
        const flat = [];
        Object.keys(grouped).forEach((grp) => {
          grouped[grp].forEach((c) => flat.push({ ...c, group_name: grp }));
        });
        setRegisteredPreferences(null);
        setCourses(flat);
        setSelectedOrder([]);
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
        if (copy.indexOf(courseId) === -1) {
          copy.push(courseId);
        }
      } else {
        const idx = copy.indexOf(courseId);
        if (idx >= 0) copy.splice(idx, 1);
      }
      return copy;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (selectedOrder.length === 0) {
      setNotification({ show: true, message: 'Please select courses before confirming', type: 'error' });
      return;
    }

    if (selectedOrder.length !== courses.length) {
      setNotification({ show: true, message: 'Please select all listed courses to continue', type: 'error' });
      return;
    }

    setIsConfirmOpen(true);
  }

  async function handleConfirmSubmission() {
    const preferences = selectedPreferences.map((row) => ({
      instance_course_id: row.instance_course_id,
      usn: basic.usn,
      preferred: row.preferred
    }));

    try {
      await submitPreferences({ preferences }, token);
      setIsConfirmOpen(false);
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
            I have read the user manual. I will save my preferences by clicking on confirm. I agree that I am responsible if preferences are not saved.
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
                  <th className="p-2">Internal Status</th>
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
                    <td className="p-2">{p.status ?? '-'}</td>
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
                    <th className="p-2">Elective Group</th>
                    <th className="p-2">Select</th>
                    <th className="p-2">Course Code</th>
                    <th className="p-2">Course Name</th>
                    <th className="p-2">Preference No</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(groupedCourses).map((groupName) => (
                    groupedCourses[groupName].map((c) => {
                      const selectedIndex = selectedOrder.indexOf(String(c.icid ?? c.id));
                      const checked = selectedIndex >= 0;
                      const courseId = String(c.icid ?? c.id);

                      return (
                    <tr key={courseId} className="border-t">
                      <td className="p-2">{groupName}</td>
                      <td className="p-2">
                        <input type="checkbox" checked={checked} onChange={(e) => handleCheckChange(courseId, e.target.checked)} />
                      </td>
                      <td className="p-2">{c.coursecode}</td>
                      <td className="p-2">{c.coursename}</td>
                      <td className="p-2">{checked ? selectedIndex + 1 : '-'}</td>
                    </tr>
                      );
                    })
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div>Selected: {selectedOrder.length}</div>
              <div>
                <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white">Verify & Submit</button>
              </div>
            </div>
          </form>
        )}

        {isConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Confirm Your Preferences</h3>
                <button type="button" onClick={() => setIsConfirmOpen(false)} className="text-slate-500 hover:text-slate-800">✕</button>
              </div>
              <div className="px-6 py-4">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-slate-100 text-left">
                      <th className="p-2">Course Code</th>
                      <th className="p-2">Course Name</th>
                      <th className="p-2">Preference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPreferences.map((row) => (
                      <tr key={row.instance_course_id} className="border-t">
                        <td className="p-2">{row.coursecode}</td>
                        <td className="p-2">{row.coursename}</td>
                        <td className="p-2">{row.preferred}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button type="button" onClick={() => setIsConfirmOpen(false)} className="rounded border border-slate-300 px-4 py-2 text-slate-700">
                  Cancel
                </button>
                <button type="button" onClick={handleConfirmSubmission} className="rounded bg-blue-600 px-4 py-2 text-white">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
