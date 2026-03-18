import api from './axios';

const tokenHeaders = (token) => {
	return token ? { Authorization: `Bearer ${token}` } : {};
};

export function getCourses(token) {
	return api.get('/courses', {
		headers: tokenHeaders(token)
	});
}

export function getCourseMeta(token) {
	return api.get('/courses/meta', {
		headers: tokenHeaders(token)
	});
}

export function downloadCourseTemplate(token) {
	return api.get('/courses/template', {
		headers: tokenHeaders(token),
		responseType: 'blob'
	});
}

export function createCourse(payload, token) {
	return api.post('/courses', payload, {
		headers: tokenHeaders(token)
	});
}

export function importCourses(formData, token) {
	return api.post('/courses/import', formData, {
		headers: tokenHeaders(token)
	});
}

export function updateCourse(id, payload, token) {
	return api.put(`/courses/${id}`, payload, {
		headers: tokenHeaders(token)
	});
}

export function deleteCourse(id, token) {
	return api.delete(`/courses/${id}`, {
		headers: tokenHeaders(token)
	});
}