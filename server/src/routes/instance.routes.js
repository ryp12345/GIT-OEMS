const express = require('express');
const instanceController = require('../controllers/instance.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authMiddleware, instanceController.list);
router.get('/:id/view', authMiddleware, instanceController.view);
router.get('/:id/preference-statistics', authMiddleware, instanceController.getPreferenceStatistics);
router.get('/:id/preference-details', authMiddleware, instanceController.getPreferenceStatisticsDetails);
router.get('/:id/preference-form-status', authMiddleware, instanceController.getPreferenceFormStatus);
router.post('/:id/preference-form-status', authMiddleware, instanceController.setPreferenceFormStatus);
router.post('/:id/set-final-preferences', authMiddleware, instanceController.setFinalPreferences);
router.post('/:id/reject-courses', authMiddleware, instanceController.rejectUnderSubscribedCourses);
router.post('/:id/upgrade-preferences', authMiddleware, instanceController.upgradePreferences);
router.post('/:id/allocate', authMiddleware, instanceController.allocate);
router.post('/:id/reset-allocations', authMiddleware, instanceController.resetAllocations);
router.post('/:id/run-allocation', authMiddleware, instanceController.runAllocation);
router.put('/:id/courses', authMiddleware, instanceController.updateMappings);
router.post('/', authMiddleware, instanceController.create);
router.put('/:id', authMiddleware, instanceController.update);
router.delete('/:id', authMiddleware, instanceController.remove);

module.exports = router;