const express = require('express');
const instanceController = require('../controllers/instance.controller');

const router = express.Router();

router.get('/', instanceController.list);
router.get('/:id/view', instanceController.view);
router.get('/:id/preference-statistics', instanceController.getPreferenceStatistics);
router.get('/:id/preference-details', instanceController.getPreferenceStatisticsDetails);
router.post('/:id/reset-allocations', instanceController.resetAllocations);
router.put('/:id/courses', instanceController.updateMappings);
router.post('/', instanceController.create);
router.put('/:id', instanceController.update);
router.delete('/:id', instanceController.remove);

module.exports = router;