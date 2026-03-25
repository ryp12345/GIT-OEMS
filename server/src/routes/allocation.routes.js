const express = require('express');
const allocationController = require('../controllers/allocation.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// Download allocations Excel for an instance
router.get('/:id/download', authMiddleware, allocationController.downloadAllocations);
// JSON allocations (optional ?department_id=)
router.get('/:id', authMiddleware, allocationController.getAllocationsJson);

module.exports = router;
