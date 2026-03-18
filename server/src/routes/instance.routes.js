const express = require('express');
const instanceController = require('../controllers/instance.controller');

const router = express.Router();

router.get('/', instanceController.list);
router.get('/:id/view', instanceController.view);
router.get('/:id/preference-statistics', instanceController.getPreferenceStatistics);
router.get('/:id/preference-details', instanceController.getPreferenceStatisticsDetails);
router.post('/:id/set-final-preferences', instanceController.setFinalPreferences);
router.post('/:id/reject-courses', instanceController.rejectUnderSubscribedCourses);
router.post('/:id/upgrade-preferences', instanceController.upgradePreferences);
router.post('/:id/allocate', instanceController.allocate);
router.post('/:id/reset-allocations', instanceController.resetAllocations);
router.post('/:id/run-allocation', instanceController.runAllocation);
router.put('/:id/courses', instanceController.updateMappings);
router.post('/', instanceController.create);
router.put('/:id', instanceController.update);
router.delete('/:id', instanceController.remove);

module.exports = router;