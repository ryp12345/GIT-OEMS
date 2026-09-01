import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Notification from '../../components/common/Notification';
import { submitPreferences } from '../../api/preferences.api';
import { checkStudentDetails, updateStudentEmail } from '../../api/student.api';

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
  const [forcedCourseIds, setForcedCourseIds] = useState([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [isEmailSaved, setIsEmailSaved] = useState(false);
  const [hasSubmittedPreferences, setHasSubmittedPreferences] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const [registrationNotice, setRegistrationNotice] = useState('');
  const isLearntOnlyForced = forcedCourseIds.length > 0;

  function formatRegistrationMessage(message) {
    const source = String(message || '').trim();
    const normalized = source.toLowerCase();

    if (
      normalized.includes('registration is currently disabled')
      || normalized.includes('registration is currently closed')
      || normalized.includes('no active instance')
    ) {
      return 'Elective preference submission is currently closed. Please contact the administrator.';
    }

    return source;
  }

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

  const isPreferencesLocked = hasSubmittedPreferences || Boolean(registeredPreferences?.length);

  useEffect(() => {
    if (!basic.usn) return;

    const storedEmail = localStorage.getItem(`student_email:${String(basic.usn).toUpperCase()}`) || '';
    const normalizedStoredEmail = String(storedEmail || '').trim();
    setEmailValue((current) => current || normalizedStoredEmail);
    setIsEmailSaved(Boolean(normalizedStoredEmail));
    setShowEmailPrompt(!isPreferencesLocked && !String(normalizedStoredEmail || emailValue || '').trim());
  }, [basic.usn, isPreferencesLocked, emailValue]);

  function persistEmail(email) {
    if (!basic.usn) return;
    localStorage.setItem(`student_email:${String(basic.usn).toUpperCase()}`, email);
  }

  async function handleSaveEmail() {
    const normalizedEmail = String(emailValue || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setNotification({ show: true, message: 'Please enter your email address.', type: 'error' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setNotification({ show: true, message: 'Please enter a valid email address.', type: 'error' });
      return;
    }

    try {
      const response = await updateStudentEmail({ usn: basic.usn, email: normalizedEmail }, token);
      const updatedStudent = response?.data?.data || response?.data || response || {};

      persistEmail(normalizedEmail);
      setEmailValue(normalizedEmail);
      setIsEmailSaved(true);
      setShowEmailPrompt(false);
      setNotification({ show: true, message: `Email saved successfully. Confirmation will be sent to ${normalizedEmail}.`, type: 'success' });

      setRegisteredPreferences((current) => current && updatedStudent?.email ? current : current);
    } catch (err) {
      setNotification({ show: true, message: err?.response?.data?.error || err?.message || 'Unable to save email', type: 'error' });
    }
  }

  async function handleProceed() {
    const trimmedUsn = basic.usn.trim();
    if (!trimmedUsn || !basic.uid || !basic.name) {
      setNotification({ show: true, message: 'Please fill basic details', type: 'error' });
      return;
    }

    try {
      setRegistrationNotice('');
      const res = await checkStudentDetails({ uid1: basic.uid, name1: basic.name, usn: trimmedUsn }, token);
      const data = res?.data || {};
      if (data.registered) {
        setRegisteredPreferences(data.preferences || []);
        setCourses([]);
        setSelectedOrder([]);
        setForcedCourseIds((data.forcedCourseIds || []).map((id) => String(id)));
        setHasSubmittedPreferences(true);
        setIsEmailSaved(Boolean(String(data?.student?.email || localStorage.getItem(`student_email:${String(trimmedUsn).toUpperCase()}`) || '').trim()));
      } else {
        if (!data.instance) {
          const formattedMessage = formatRegistrationMessage(data.message || 'No active elective instance for your semester');
          setRegisteredPreferences(null);
          setCourses([]);
          setShowCourses(false);
          setForcedCourseIds([]);
          setRegistrationNotice(formattedMessage);
          setNotification({ show: true, message: formattedMessage, type: 'error' });
          return;
        }

        // data.courses is an object grouped by group name
        const grouped = data.courses || {};
        const flat = [];
        Object.keys(grouped).forEach((grp) => {
          grouped[grp].forEach((c) => flat.push({ ...c, group_name: grp }));
        });
        const validCourseIds = new Set(flat.map((row) => String(row.icid ?? row.id)));
        const preselected = (data.existingPreferences || [])
          .sort((a, b) => Number(a.preferred) - Number(b.preferred))
          .map((row) => String(row.instance_course_id))
          .filter((id) => validCourseIds.has(id));
        const normalizedForced = (data.forcedCourseIds || [])
          .map((id) => String(id))
          .filter((id) => validCourseIds.has(id));
        setRegisteredPreferences(null);
        setCourses(flat);
        setForcedCourseIds(normalizedForced);
        setSelectedOrder(normalizedForced.length > 0 ? normalizedForced : preselected);
        setHasSubmittedPreferences(false);
        setIsEmailSaved(Boolean(String(data?.student?.email || localStorage.getItem(`student_email:${String(trimmedUsn).toUpperCase()}`) || '').trim()));
      }
      setRegistrationNotice('');
      // setShowBasic(false); // Keep basic details and Proceed button visible
      setShowCourses(true);
    } catch (err) {
      const formattedMessage = formatRegistrationMessage(err?.response?.data?.error || err?.message || 'Failed to verify');
      setRegistrationNotice(formattedMessage);
      setNotification({ show: true, message: formattedMessage, type: 'error' });
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
    if (isSavingPreferences) return;

    const normalizedEmail = String(emailValue || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setNotification({ show: true, message: 'Please provide an email before confirming', type: 'error' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setNotification({ show: true, message: 'Please enter a valid email address.', type: 'error' });
      return;
    }

    const trimmedUsn = basic.usn.trim();
    const preferences = selectedPreferences.map((row) => ({
      instance_course_id: row.instance_course_id,
      usn: trimmedUsn,
      preferred: row.preferred
    }));

    try {
      setIsSavingPreferences(true);
      await submitPreferences({ preferences, email: normalizedEmail }, token);
      persistEmail(normalizedEmail);
      setIsEmailSaved(true);

      const refreshed = await checkStudentDetails({ uid1: basic.uid, name1: basic.name, usn: trimmedUsn }, token);
      const refreshedData = refreshed?.data || {};

      if (refreshedData.registered) {
        setRegisteredPreferences(refreshedData.preferences || []);
        setCourses([]);
        setSelectedOrder([]);
        setForcedCourseIds((refreshedData.forcedCourseIds || []).map((id) => String(id)));
        setHasSubmittedPreferences(true);
      }

      setIsConfirmOpen(false);
      setNotification({ show: true, message: `Preferences submitted successfully. A confirmation email has been sent to ${normalizedEmail}.`, type: 'success' });
    } catch (err) {
      setNotification({ show: true, message: err?.response?.data?.error || 'Failed to save', type: 'error' });
    } finally {
      setIsSavingPreferences(false);
    }
  }


  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-lg shadow p-6">
        <Notification
          show={notification.show}
          message={notification.message}
          type={notification.type}
          position="topRight"
          onClose={() => setNotification({ show: false, message: '', type: 'info' })}
        />

        <h1 className="text-2xl font-semibold mb-2 text-center">Elective Registration</h1>
        <p className="text-sm text-gray-600 mb-6">Complete the following steps to submit your preferences.</p>

        {registrationNotice && (
          <div className="mb-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {registrationNotice}
          </div>
        )}

        <div className="mb-6">
          <label className="inline-flex items-center">
            <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setShowBasic(true); }} className="mr-2" />
            I have read the user manual. I will save my preferences by clicking on confirm. I agree that I am responsible if preferences are not saved.
          </label>
        </div>

        {showBasic && (
          <div className="mb-6 rounded-lg bg-slate-50 p-4 shadow">
            <h2 className="font-semibold mb-2">Basic Details</h2>
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

        {showCourses && !isPreferencesLocked && !isEmailSaved && (
          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
            <div className="mb-2 font-medium text-indigo-900">Email Address</div>
            <p className="mb-3 text-sm text-indigo-800">
              {emailValue ? 'This email will be used for submission confirmation.' : 'Please enter an email address for submission confirmation.'}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="student@example.com"
                className="min-w-0 flex-1 rounded border border-indigo-300 px-3 py-2"
              />
              <button type="button" onClick={handleSaveEmail} className="rounded bg-indigo-600 px-4 py-2 text-white">
                Save Email
              </button>
            </div>
          </div>
        )}

        {showCourses && registeredPreferences && (
          <div className="rounded-lg bg-slate-50 p-4 shadow">
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

        {showCourses && !isPreferencesLocked && !registeredPreferences && (
          <form onSubmit={handleSubmit} className="rounded-lg bg-white p-4 shadow">
            <h3 className="font-semibold mb-3">Available Courses</h3>
            {isLearntOnlyForced && (
              <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Based on learnt compulsory prerequisite, only the listed compulsory course can be selected.
              </div>
            )}
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
                        <input type="checkbox" checked={checked} disabled={isLearntOnlyForced} onChange={(e) => handleCheckChange(courseId, e.target.checked)} />
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
                <button
                  type="button"
                  onClick={handleConfirmSubmission}
                  disabled={isSavingPreferences}
                  className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingPreferences ? 'Submitting...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isPreferencesLocked && (
          <div className="mt-6 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    Preferences have already been submitted for this student.
          </div>
        )}
      </div>
    </div>
  );
}
