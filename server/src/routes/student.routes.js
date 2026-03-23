const express = require('express');
const multer = require('multer');
const studentController = require('../controllers/student.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/meta', authMiddleware, studentController.meta);
router.post('/check', studentController.check);
router.get('/template', authMiddleware, studentController.template);
router.post('/import', authMiddleware, upload.single('file'), studentController.import);
router.get('/', authMiddleware, studentController.list);
router.post('/', authMiddleware, studentController.create);
router.put('/:id', authMiddleware, studentController.update);
router.delete('/:id', authMiddleware, studentController.remove);

module.exports = router;