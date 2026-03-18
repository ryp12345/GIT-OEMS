import api from './axios';

const tokenHeaders = (token) => {
	return token ? { Authorization: `Bearer ${token}` } : {};
};

export function getStudents(token) {
	return api.get('/students', {
		headers: tokenHeaders(token)
	});
}

export function getStudentMeta(token) {
	return api.get('/students/meta', {
		headers: tokenHeaders(token)
	});
}

export function checkStudentDetails(payload, token) {
  return api.post('/students/check', payload, {
    headers: tokenHeaders(token)
  });
}

export function downloadStudentTemplate(token) {
	return api.get('/students/template', {
		headers: tokenHeaders(token),
		responseType: 'blob'
	});
}

export function createStudent(payload, token) {
	return api.post('/students', payload, {
		headers: tokenHeaders(token)
	});
}

export function importStudents(formData, token) {
	return api.post('/students/import', formData, {
		headers: tokenHeaders(token)
	});
}

export function updateStudent(id, payload, token) {
	return api.put(`/students/${id}`, payload, {
		headers: tokenHeaders(token)
	});
}

export function deleteStudent(id, token) {
	return api.delete(`/students/${id}`, {
		headers: tokenHeaders(token)
	});
}