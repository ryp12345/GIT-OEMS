const express = require('express');
const multer = require('multer');
const courseController = require('../controllers/course.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/meta', authMiddleware, courseController.meta);
router.get('/template', authMiddleware, courseController.template);
router.post('/import', authMiddleware, upload.single('file'), courseController.import);
router.get('/', authMiddleware, courseController.list);
router.post('/', authMiddleware, courseController.create);
router.put('/:id', authMiddleware, courseController.update);
router.delete('/:id', authMiddleware, courseController.remove);

module.exports = router;