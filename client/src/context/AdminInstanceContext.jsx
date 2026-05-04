import { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'oems_admin_active_instance';

const AdminInstanceContext = createContext(null);

function readStoredInstance() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || !parsed.id) return null;
		return {
			id: Number(parsed.id),
			instancename: String(parsed.instancename || ''),
			semester: parsed.semester != null ? Number(parsed.semester) : null,
			academic_year: String(parsed.academic_year || '')
		};
	} catch (_error) {
		return null;
	}
}

function writeStoredInstance(instance) {
	if (!instance) {
		localStorage.removeItem(STORAGE_KEY);
		return;
	}

	localStorage.setItem(STORAGE_KEY, JSON.stringify({
		id: Number(instance.id),
		instancename: String(instance.instancename || ''),
		semester: instance.semester != null ? Number(instance.semester) : null,
		academic_year: String(instance.academic_year || '')
	}));
}

export function useAdminInstance() {
	const context = useContext(AdminInstanceContext);
	if (!context) {
		throw new Error('useAdminInstance must be used within AdminInstanceProvider');
	}
	return context;
}

export default function AdminInstanceProvider({ children }) {
	const [activeInstance, setActiveInstance] = useState(() => readStoredInstance());

	function selectInstance(instance) {
		if (!instance || !instance.id) return;
		const normalized = {
			id: Number(instance.id),
			instancename: String(instance.instancename || ''),
			semester: instance.semester != null ? Number(instance.semester) : null,
			academic_year: String(instance.academic_year || '')
		};
		setActiveInstance(normalized);
		writeStoredInstance(normalized);
	}

	function clearInstance() {
		setActiveInstance(null);
		writeStoredInstance(null);
	}

	const value = useMemo(() => ({
		activeInstance,
		activeInstanceId: activeInstance?.id ? String(activeInstance.id) : '',
		hasActiveInstance: Boolean(activeInstance?.id),
		selectInstance,
		clearInstance
	}), [activeInstance]);

	return (
		<AdminInstanceContext.Provider value={value}>
			{children}
		</AdminInstanceContext.Provider>
	);
}
