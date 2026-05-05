import { useEffect } from 'react';

const toneClasses = {
	success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	error: 'border-red-200 bg-red-50 text-red-700',
	info: 'border-blue-200 bg-blue-50 text-blue-700'
};

const positionClasses = {
	inline: 'mb-6',
	topRight: 'fixed right-6 top-6 z-50 w-full max-w-md'
};

function Notification({ show, message, type = 'info', onClose, position = 'inline' }) {
	useEffect(() => {
		if (!show) return undefined;

		const timeoutId = window.setTimeout(() => {
			onClose?.();
		}, 4000);

		return () => window.clearTimeout(timeoutId);
	}, [show, onClose]);

	if (!show || !message) return null;

	return (
		<div className={`${positionClasses[position] || positionClasses.inline} flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow ${toneClasses[type] || toneClasses.info}`}>
			<span>{message}</span>
			<button
				type="button"
				onClick={onClose}
				className="rounded-md px-2 py-1 text-xs font-semibold transition hover:bg-black/5"
			>
				Close
			</button>
		</div>
	);
}

export { Notification };
export default Notification;