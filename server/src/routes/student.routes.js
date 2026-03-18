const express = require('express');
const multer = require('multer');
const studentController = require('../controllers/student.controller');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/meta', studentController.meta);
router.post('/check', studentController.check);
router.get('/template', studentController.template);
router.post('/import', upload.single('file'), studentController.import);
router.get('/', studentController.list);
router.post('/', studentController.create);
router.put('/:id', studentController.update);
router.delete('/:id', studentController.remove);

module.exports = router;