import api from './axios';

const tokenHeaders = (token) => {
	return token ? { Authorization: `Bearer ${token}` } : {};
};

export function getAllocations(instanceId, departmentId, token) {
	return api.get(`/allocations/${instanceId}`, {
		headers: tokenHeaders(token),
		params: departmentId ? { department_id: departmentId } : {}
	});
}
