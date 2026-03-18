import api from './axios';

const tokenHeaders = (token) => {
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function submitPreferences(payload, token) {
  // payload expected: { preferences: [{ instance_course_id, usn, preferred }, ...] }
  return api.post('/preferences', payload, { headers: tokenHeaders(token) });
}
