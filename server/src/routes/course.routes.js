const express = require('express');
const multer = require('multer');
const courseController = require('../controllers/course.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/meta', courseController.meta);
router.get('/template', courseController.template);
router.post('/import', upload.single('file'), courseController.import);
router.get('/', courseController.list);
router.post('/', courseController.create);
router.put('/:id', courseController.update);
router.delete('/:id', courseController.remove);

module.exports = router;