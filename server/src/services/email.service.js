const nodemailer = require('nodemailer');
const config = require('../config');

function createTransporter() {
	const emailConfig = config.email || {};

	if (emailConfig.service) {
		return nodemailer.createTransport({
			service: emailConfig.service,
			auth: emailConfig.user && emailConfig.pass ? { user: emailConfig.user, pass: emailConfig.pass } : undefined
		});
	}

	if (!emailConfig.host) {
		return null;
	}

	return nodemailer.createTransport({
		host: emailConfig.host,
		port: emailConfig.port,
		secure: emailConfig.secure,
		auth: emailConfig.user && emailConfig.pass ? { user: emailConfig.user, pass: emailConfig.pass } : undefined
	});
}

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function buildPreferenceTableHtml(preferences) {
	const rows = Array.isArray(preferences) ? preferences : [];
	const tableRows = rows.map((row) => {
		const rowColor = Number(row.preferred) % 2 === 0 ? '#f8fafc' : '#ffffff';
		return `<tr style="background:${rowColor};">
			<td style="border:1px solid #d1d5db;padding:10px;font-weight:600;color:#0f172a;">${escapeHtml(row.preferred)}</td>
			<td style="border:1px solid #d1d5db;padding:10px;color:#0f172a;">${escapeHtml(row.coursecode)}</td>
			<td style="border:1px solid #d1d5db;padding:10px;color:#0f172a;">${escapeHtml(row.coursename)}</td>
			<td style="border:1px solid #d1d5db;padding:10px;color:#0f172a;">${escapeHtml(row.group_name || 'No Group')}</td>
		</tr>`;
	}).join('');

	return `
		<table style="border-collapse:collapse;width:100%;margin-top:14px;font-family:Arial,sans-serif;font-size:14px;">
			<thead>
				<tr style="background:#1d4ed8;color:#ffffff;">
					<th style="border:1px solid #1d4ed8;padding:10px;text-align:left;">Preference</th>
					<th style="border:1px solid #1d4ed8;padding:10px;text-align:left;">Course Code</th>
					<th style="border:1px solid #1d4ed8;padding:10px;text-align:left;">Course Name</th>
					<th style="border:1px solid #1d4ed8;padding:10px;text-align:left;">Elective Group</th>
				</tr>
			</thead>
			<tbody>
				${tableRows || '<tr><td colspan="4" style="border:1px solid #d1d5db;padding:10px;background:#ffffff;">No preferences submitted</td></tr>'}
			</tbody>
		</table>`;
}

async function sendPreferenceConfirmationEmail({ to, usn, studentName, preferences }) {
	const transporter = createTransporter();
	if (!transporter) {
		const error = new Error('Email delivery is not configured');
		error.statusCode = 500;
		throw error;
	}

	const from = (config.email && config.email.from) || config.email.user;
	if (!from) {
		const error = new Error('Email sender is not configured');
		error.statusCode = 500;
		throw error;
	}

	const preferenceRows = Array.isArray(preferences) ? preferences : [];
	const preferenceTableHtml = buildPreferenceTableHtml(preferenceRows);
	const preferenceSummaryText = preferenceRows.map((row) => {
		return `${row.preferred}. ${row.coursecode} - ${row.coursename} (${row.group_name || 'No Group'})`;
	}).join('\n');
	const displayName = String(studentName || '').trim();

	await transporter.sendMail({
		from,
		to,
		subject: 'Elective preferences received',
		text: [
			displayName ? `Student: ${displayName}` : null,
			`Your elective preferences for USN ${usn} have been received successfully.`,
			`A confirmation copy has been sent to ${to}.`,
			'',
			preferenceSummaryText || 'No preferences submitted',
			'',
			'If you did not submit this request, please contact the administration team.'
		].join('\n'),
		html: `
			<div style="font-family:Arial,sans-serif;color:#0f172a;">
				<h2 style="margin:0 0 8px 0;color:#1d4ed8;">Elective Preferences Received</h2>
				<p style="margin:0 0 6px 0;">${displayName ? `<strong>Student:</strong> ${escapeHtml(displayName)}<br>` : ''}<strong>USN:</strong> ${escapeHtml(usn)}</p>
				<p style="margin:0 0 12px 0;">Your elective preferences have been received successfully. A confirmation copy has been sent to <strong>${escapeHtml(to)}</strong>.</p>
				${preferenceTableHtml}
				<p style="margin-top:14px;color:#b91c1c;">If you did not submit this request, please contact the administration team.</p>
			</div>`
	});
}

module.exports = { sendPreferenceConfirmationEmail };