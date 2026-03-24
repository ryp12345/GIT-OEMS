const express = require('express');
const allocationController = require('../controllers/allocation.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// Download allocations Excel for an instance
router.get('/:id/download', authMiddleware, allocationController.downloadAllocations);

module.exports = router;
