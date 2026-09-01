import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Notification from '../../components/common/Notification';
import { checkStudentDetails, updateStudentEmail } from '../../api/student.api';
import { submitPreferences } from '../../api/preferences.api';

export default function CheckNamePage() {
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const [values, setValues] = useState({ uid1: '', name1: '', usn: '' });
  const [result, setResult] = useState(null);
  const [emailValue, setEmailValue] = useState('');
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [isEmailSaved, setIsEmailSaved] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const [selectedOrder, setSelectedOrder] = useState([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmittingPreferences, setIsSubmittingPreferences] = useState(false);
  const [hasSubmittedPreferences, setHasSubmittedPreferences] = useState(false);
  const forcedCourseIds = useMemo(
    () => (result?.forcedCourseIds || []).map((id) => String(id)),
    [result]
  );
  const isLearntOnlyForced = forcedCourseIds.length > 0;

  const availableCourses = useMemo(() => {
    return result?.courses || {};
  }, [result]);

  const totalAvailableCourses = useMemo(
    () => Object.values(availableCourses).flat().length,
    [availableCourses]
  );

  useEffect(() => {
    if (!result) return;
    const validIds = new Set(
      Object.values(availableCourses)
        .flat()
        .map((course) => String(course.icid ?? course.id))
    );
    setSelectedOrder((prev) => prev.filter((id) => validIds.has(String(id))));
  }, [availableCourses, result]);

  useEffect(() => {
    if (!result?.student?.usn) return;

    const storedEmail = localStorage.getItem(`student_email:${String(result.student.usn).toUpperCase()}`) || '';
    const currentEmail = String(result.student.email || storedEmail || '').trim();

    setEmailValue(currentEmail);
    setIsEmailSaved(Boolean(currentEmail));
    setShowEmailPrompt(!result.registered && !currentEmail);
  }, [result]);

  function persistEmail(email) {
    if (!result?.student?.usn) return;
    localStorage.setItem(`student_email:${String(result.student.usn).toUpperCase()}`, email);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const res = await checkStudentDetails(values, token);
      const data = res.data || res;
      setResult(data);
      setHasSubmittedPreferences(Boolean(data?.registered));
      const storedEmail = localStorage.getItem(`student_email:${String(data?.student?.usn || values.usn || '').toUpperCase()}`) || '';
      const currentEmail = String(data?.student?.email || storedEmail || '').trim();
      setEmailValue(currentEmail);
      setIsEmailSaved(Boolean(currentEmail));
      setShowEmailPrompt(!data?.registered && !currentEmail);
      const preselectedFromExisting = (data?.existingPreferences || [])
        .sort((a, b) => Number(a.preferred) - Number(b.preferred))
        .map((row) => String(row.instance_course_id));
      const preselected = (data?.forcedSelection && Array.isArray(data?.forcedCourseIds) && data.forcedCourseIds.length > 0)
        ? data.forcedCourseIds.map((id) => String(id))
        : preselectedFromExisting;
      setSelectedOrder(preselected);
    } catch (err) {
      setNotification({ show: true, message: err?.response?.data?.error || err?.message || 'Check failed', type: 'error' });
    }
  }

  function formatServerMessage(msg) {
    if (!msg) return '';
    const m = String(msg).toLowerCase();
    if (
      m.includes('no active instance')
      || m.includes('deadline')
      || m.includes('registration is currently disabled')
      || m.includes('registration is currently closed')
    ) {
      return 'Elective preference submission is currently closed.';
    }
    if (m.includes('student not found') || m.includes('not found with')) {
      return 'No student found with the given details.';
    }
    if (m.includes('academic record not found')) {
      return 'Academic record not found for student.';
    }
    return msg;
  }

  function isRegistrationClosedMessage(msg) {
    const m = String(msg || '').toLowerCase();
    return (
      m.includes('no active instance')
      || m.includes('deadline')
      || m.includes('registration is currently disabled')
      || m.includes('registration is currently closed')
    );
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
      const usn = String(result?.student?.usn || values.usn || '').trim();
      const response = await updateStudentEmail({ usn, email: normalizedEmail }, token);
      const updatedStudent = response?.data?.data || response?.data || response || {};

      persistEmail(normalizedEmail);
      setEmailValue(normalizedEmail);
      setIsEmailSaved(true);
      setShowEmailPrompt(false);
      setResult((current) => ({
        ...(current || {}),
        student: {
          ...(current?.student || {}),
          email: updatedStudent?.email || normalizedEmail
        }
      }));
      setNotification({ show: true, message: 'Email saved successfully', type: 'success' });
    } catch (err) {
      setNotification({ show: true, message: err?.response?.data?.error || err?.message || 'Unable to save email', type: 'error' });
    }
  }

  const isPreferencesLocked = hasSubmittedPreferences || Boolean(result?.registered);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-lg shadow p-6">
        <Notification show={notification.show} message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: 'info' })} />

        <h1 className="text-2xl font-semibold mb-3 text-center">Check Student Details</h1>
        <form onSubmit={handleSubmit} className="mb-4 rounded-lg bg-slate-50 p-4 shadow">
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
          <div className="rounded-lg bg-slate-50 p-4 shadow">
            {!result.instance && result.message ? (
              <div className={`rounded border p-3 text-sm ${isRegistrationClosedMessage(result.message) ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                {formatServerMessage(result.message)}
              </div>
            ) : result.registered ? (
              <>
                <h3 className="font-semibold mb-2">Existing Preferences</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-2">Elective Group</th>
                      <th className="p-2">Course Name</th>
                      <th className="p-2">Course Code</th>
                      <th className="p-2">Preference No</th>
                      <th className="p-2">Final Preference</th>
                      <th className="p-2">Allocation Status</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.preferences.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{p.group_name || 'No Group'}</td>
                        <td className="p-2">{p.coursename}</td>
                        <td className="p-2">{p.coursecode}</td>
                        <td className="p-2">{p.preferred}</td>
                        <td className="p-2">{p.final_preference}</td>
                        <td className="p-2">{p.allocation_status}</td>
                        <td className="p-2">{p.status ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {!isPreferencesLocked && (showEmailPrompt || !isEmailSaved) ? (
                  <div className="mb-4 rounded border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
                    <div className="mb-3 font-medium">Email Address</div>
                    <p className="mb-3 text-xs text-indigo-800">
                      {result.student?.email ? 'This email is already saved and will be used for submission confirmation.' : 'Please add an email address for submission confirmation.'}
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
                ) : (
                  <div className="mb-4 rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {result.student?.email ? `Email on record: ${result.student.email}` : 'An email address will be required before submission.'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="mb-4 rounded border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                  Student verified for {result.instance?.instancename || 'the active instance'}.
                </div>
                {isPreferencesLocked ? (
                  <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    Preferences have already been submitted for this student.
                  </div>
                ) : null}
                {isLearntOnlyForced && !isPreferencesLocked && (
                  <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Based on learnt compulsory prerequisite, only the listed compulsory course can be selected.
                  </div>
                )}
                <h3 className="font-semibold mb-2">Available Courses (grouped)</h3>
                {!isPreferencesLocked && totalAvailableCourses === 0 && (
                  <div className="mb-2">No courses are listed for your branch. Contact Dean Academics Development</div>
                )}
                {!isPreferencesLocked ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (selectedOrder.length === 0) {
                      setNotification({ show: true, message: 'Please select courses before submitting', type: 'error' });
                      return;
                    }

                    if (selectedOrder.length !== totalAvailableCourses) {
                      setNotification({ show: true, message: 'Please select all listed courses before submitting', type: 'error' });
                      return;
                    }

                    setIsConfirmOpen(true);
                  }}>
                    {Object.keys(availableCourses).map((grp) => (
                      <div key={grp} className="mb-4">
                        <h4 className="font-medium">{grp}</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full table-auto mb-2">
                          <thead>
                            <tr className="bg-gray-100 text-left">
                              <th className="p-2">Elective Group</th>
                              <th className="p-2">Course Name</th>
                              <th className="p-2">Course Code</th>
                              <th className="p-2">Action</th>
                              <th className="p-2">Preference No</th>
                            </tr>
                          </thead>
                          <tbody>
                            {availableCourses[grp].map((c) => {
                              const courseId = String(c.icid ?? c.id);
                              const idx = selectedOrder.indexOf(courseId);
                              const checked = idx >= 0;
                              return (
                                <tr key={courseId} className="border-t">
                                  <input type="hidden" name="usn" value={values.usn} />
                                  <input type="hidden" name={`instance_course_id`} value={courseId} />
                                  <td className="p-2">{c.group_name || grp || 'No Group'}</td>
                                  <td className="p-2">{c.coursename}</td>
                                  <td className="p-2">{c.coursecode}</td>
                                  <td className="p-2">
                                    <input type="checkbox" className="preference_check" value={`i_${courseId}`} checked={checked} onChange={(e) => {
                                      if (isLearntOnlyForced) return;
                                      setSelectedOrder((prev) => {
                                        const copy = [...prev];
                                        if (e.target.checked) {
                                          if (!copy.includes(courseId)) copy.push(courseId);
                                        } else {
                                          const i = copy.indexOf(courseId);
                                          if (i >= 0) copy.splice(i, 1);
                                        }
                                        return copy;
                                      });
                                    }} disabled={isLearntOnlyForced} />
                                  </td>
                                  <td className="p-2"> 
                                    <input className="form-control" type="text" readOnly id={`i_${courseId}`} value={checked ? idx + 1 : ''} name={`i_${courseId}`} style={{ width: '50px' }} />
                                    <input type="hidden" name={`cc_${courseId}`} id={`cc_${courseId}`} value={c.coursecode} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={5} className="text-center">
                                <button type="submit" className="rounded bg-green-600 px-4 py-2 text-white">Verify & Submit</button>
                              </td>
                            </tr>
                          </tfoot>
                          </table>
                        </div>
                      </div>
                    ))}
                  </form>
                ) : null}
                {isConfirmOpen && !isPreferencesLocked && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
                      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                        <h3 className="text-lg font-semibold text-slate-900">Confirm Your Preferences</h3>
                        <button type="button" onClick={() => setIsConfirmOpen(false)} className="text-slate-500 hover:text-slate-800">✕</button>
                      </div>
                      <div className="px-6 py-4">
                        <div className="overflow-x-auto">
                          <table className="min-w-full table-auto">
                          <thead>
                            <tr className="bg-slate-100 text-left">
                              <th className="p-2">Course Code</th>
                              <th className="p-2">Course Name</th>
                              <th className="p-2">Preference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrder.map((id, idx) => {
                              const course = Object.values(availableCourses).flat().find((c) => String(c.icid ?? c.id) === String(id));
                              return (
                                <tr key={id} className="border-t">
                                  <td className="p-2">{course?.coursecode}</td>
                                  <td className="p-2">{course?.coursename}</td>
                                  <td className="p-2">{idx + 1}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                        <button type="button" onClick={() => setIsConfirmOpen(false)} disabled={isSubmittingPreferences} className="rounded border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-50">Cancel</button>
                        <button type="button" disabled={isSubmittingPreferences} onClick={async () => {
                          if (isSubmittingPreferences) return;

                          const normalizedEmail = String(emailValue || result?.student?.email || '').trim().toLowerCase();
                          if (!normalizedEmail) {
                            setNotification({ show: true, message: 'Please provide an email before confirming', type: 'error' });
                            return;
                          }

                          const preferences = selectedOrder.map((id, idx) => ({ instance_course_id: Number(id), usn: values.usn, preferred: idx + 1 }));
                          try {
                            setIsSubmittingPreferences(true);
                            await submitPreferences({ preferences, email: normalizedEmail }, token);
                            persistEmail(normalizedEmail);
                            setHasSubmittedPreferences(true);

                            const submittedPreferences = selectedOrder.map((id, idx) => {
                              const course = Object.values(availableCourses).flat().find((c) => String(c.icid ?? c.id) === String(id));
                              return {
                                group_name: course?.group_name || 'No Group',
                                coursename: course?.coursename || '-',
                                coursecode: course?.coursecode || '-',
                                preferred: idx + 1,
                                final_preference: course?.final_preference ?? '-',
                                allocation_status: course?.allocation_status ?? '-',
                                status: course?.status ?? '-',
                                instance_course_id: Number(id)
                              };
                            });

                            setResult((current) => ({
                              ...(current || {}),
                              registered: true,
                              preferences: submittedPreferences
                            }));

                            setNotification({ show: true, message: `Preferences submitted successfully. A confirmation email has been sent to ${normalizedEmail}.`, type: 'success' });
                            setIsConfirmOpen(false);
                            setShowEmailPrompt(false);
                            setSelectedOrder([]);
                          } catch (err) {
                            const errorMessage = err?.response?.data?.error || err?.message || 'Failed to save';
                            if (isRegistrationClosedMessage(errorMessage)) {
                              setResult({ instance: null, message: errorMessage });
                              setIsConfirmOpen(false);
                            }
                            setNotification({ show: true, message: formatServerMessage(errorMessage), type: 'error' });
                          } finally {
                            setIsSubmittingPreferences(false);
                          }
                        }} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{isSubmittingPreferences ? 'Submitting...' : 'Confirm'}</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
