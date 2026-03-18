const courseService = require('../services/course.service');

exports.list = async (req, res, next) => {
	try {
		const courses = await courseService.getCourses();
		res.json(courses);
	} catch (error) {
		next(error);
	}
};

exports.meta = async (req, res, next) => {
	try {
		const metadata = await courseService.getCourseMeta();
		res.json(metadata);
	} catch (error) {
		next(error);
	}
};

exports.template = async (req, res, next) => {
	try {
		const buffer = await courseService.generateCourseTemplateBuffer();
		res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		res.setHeader('Content-Disposition', 'attachment; filename="CourseTemplate.xlsx"');
		res.send(buffer);
	} catch (error) {
		next(error);
	}
};

exports.create = async (req, res, next) => {
	try {
		const created = await courseService.addCourse(req.body);
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

		const result = await courseService.importCoursesFromFile(req.file.buffer);
		res.status(201).json(result);
	} catch (error) {
		next(error);
	}
};

exports.update = async (req, res, next) => {
	try {
		const updated = await courseService.editCourse(req.params.id, req.body);
		res.json(updated);
	} catch (error) {
		next(error);
	}
};

exports.remove = async (req, res, next) => {
	try {
		await courseService.removeCourse(req.params.id);
		res.status(204).send();
	} catch (error) {
		next(error);
	}
};