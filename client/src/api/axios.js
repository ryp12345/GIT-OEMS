import axios from 'axios';

const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
const defaultBaseUrl = `${window.location.protocol}//${window.location.hostname}:3001/api`;

const api = axios.create({
	baseURL: envBaseUrl || defaultBaseUrl
});

api.interceptors.request.use((config) => {
	const token = localStorage.getItem('token');
	if (token) {
		config.headers = config.headers || {};
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

export default api;
