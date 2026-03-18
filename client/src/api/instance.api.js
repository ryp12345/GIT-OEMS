import api from './axios';

const tokenHeaders = (token) => {
	return token ? { Authorization: `Bearer ${token}` } : {};
};

export function getInstances(token) {
	return api.get('/instances', {
		headers: tokenHeaders(token)
	});
}

export function getInstanceView(id, token) {
	return api.get(`/instances/${id}/view`, {
		headers: tokenHeaders(token)
	});
}

export function createInstance(payload, token) {
	return api.post('/instances', payload, {
		headers: tokenHeaders(token)
	});
}

export function updateInstance(id, payload, token) {
	return api.put(`/instances/${id}`, payload, {
		headers: tokenHeaders(token)
	});
}

export function updateInstanceCourses(id, payload, token) {
	return api.put(`/instances/${id}/courses`, payload, {
		headers: tokenHeaders(token)
	});
}

export function deleteInstance(id, token) {
	return api.delete(`/instances/${id}`, {
		headers: tokenHeaders(token)
	});
}

export function getPreferenceStatistics(instanceId, token) {
	return api.get(`/instances/${instanceId}/preference-statistics`, {
		headers: tokenHeaders(token)
	});
}

export function getPreferenceStatisticsDetails(instanceId, token) {
	return api.get(`/instances/${instanceId}/preference-details`, {
		headers: tokenHeaders(token)
	});
}

export function resetInstanceAllocations(instanceId, token) {
	return api.post(`/instances/${instanceId}/reset-allocations`, {}, {
		headers: tokenHeaders(token)
	});
}