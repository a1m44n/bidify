const express = require('express');
const { getPriceSuggestion, getDebugScrapedData, getSystemHealth } = require('../controllers/suggestionCtr');
const router = express.Router();

// Main endpoints
router.get("/price", getPriceSuggestion);
router.get("/debug", getDebugScrapedData);
router.get("/health", getSystemHealth);

module.exports = router; 