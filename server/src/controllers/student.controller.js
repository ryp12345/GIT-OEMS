const studentService = require('../services/student.service');

exports.list = async (req, res, next) => {
	try {
		const students = await studentService.getStudents();
		res.json(students);
	} catch (error) {
		next(error);
	}
};

exports.meta = async (req, res, next) => {
	try {
		const metadata = await studentService.getStudentMeta();
		res.json(metadata);
	} catch (error) {
		next(error);
	}
};

exports.template = async (req, res, next) => {
	try {
		const buffer = await studentService.generateStudentTemplateBuffer();
		res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		res.setHeader('Content-Disposition', 'attachment; filename="StudentTemplate.xlsx"');
		res.send(buffer);
	} catch (error) {
		next(error);
	}
};

exports.create = async (req, res, next) => {
	try {
		const created = await studentService.addStudent(req.body);
		res.status(201).json(created);
	} catch (error) {
		next(error);
	}
};

exports.import = async (req, res, next) => {
	try {
		if (!req.file?.buffer) {
			const error = new Error('Please upload a file');
			error.statusCode = 400;
			throw error;
		}

		const result = await studentService.importStudentsFromFile(req.file.buffer);
		res.status(201).json(result);
	} catch (error) {
		next(error);
	}
};

exports.update = async (req, res, next) => {
	try {
		const updated = await studentService.editStudent(req.params.id, req.body);
		res.json(updated);
	} catch (error) {
		next(error);
	}
};

exports.remove = async (req, res, next) => {
	try {
		await studentService.removeStudent(req.params.id);
		res.status(204).send();
	} catch (error) {
		next(error);
	}
};