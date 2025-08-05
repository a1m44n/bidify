const express = require('express');
const { 
  getPriceSuggestion, 
  getDebugScrapedData, 
  getSystemHealth,
  getCacheStats,
  clearCache,
  cleanupCache
} = require('../controllers/suggestionCtr');
const router = express.Router();

// Main endpoints
router.get("/price", getPriceSuggestion);
router.get("/debug", getDebugScrapedData);
router.get("/health", getSystemHealth);

// Cache management endpoints
router.get("/cache/stats", getCacheStats);
router.delete("/cache/clear/:type", clearCache);
router.post("/cache/cleanup", cleanupCache);

module.exports = router; 