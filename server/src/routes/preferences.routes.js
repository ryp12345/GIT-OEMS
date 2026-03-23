const express = require('express');
const preferencesController = require('../controllers/preferences.controller');

const router = express.Router();

// Student-facing: no auth required — students submit via their own token-less or token-bearing session
router.post('/', preferencesController.submit);

module.exports = router;
