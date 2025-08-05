const asyncHandler = require('express-async-handler');
const scrapingService = require('../services/scrapingService');
const suggestionService = require('../services/suggestionService');
const cacheService = require('../services/cacheService');

/**
 * Debug endpoint to see raw scraped data (Legacy - Stage 1 & 2 only)
 * Query parameters:
 * - productTitle: string (required)
 * - condition: string (required) - Valid values: "new", "used" ONLY
 */
const getDebugScrapedData = asyncHandler(async (req, res) => {
  const { productTitle, condition } = req.query;
  
  if (!productTitle) {
    res.status(400);
    throw new Error("Product title is required");
  }
  
  if (!condition) {
    res.status(400);
    throw new Error("Condition is required. Must be either 'new' or 'used'");
  }
  
  // Validate condition parameter - only allow "new" or "used"
  const validConditions = ['new', 'used'];
  const normalizedCondition = condition.toLowerCase();
  if (!validConditions.includes(normalizedCondition)) {
    res.status(400);
    throw new Error(`Invalid condition. Must be either 'new' or 'used'`);
  }
  
  try {
    console.log(`🐛 DEBUG: Getting raw scraped data for "${productTitle}" with condition: "${normalizedCondition.toUpperCase()}"`);
    
    // Use legacy scraping for debug endpoint (Stage 1 + 2 only)
    const ebayResults = await scrapingService.scrapeEbay(productTitle, normalizedCondition);
    
    res.status(200).json({
      success: true,
      searchTerm: productTitle,
      condition: normalizedCondition.toUpperCase(),
      totalItems: ebayResults.length,
      rawData: ebayResults,
      message: `Found ${ebayResults.length} ${normalizedCondition.toUpperCase()} items from eBay scraping (Stages 1-2 only)`
    });
    
  } catch (error) {
    console.error("❌ Error in debug scraping:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to get debug scraped data",
      error: error.message
    });
  }
});

/**
 * Get price suggestion using the enhanced 5-stage system
 * Query parameters:
 * - productTitle: string (required)
 * - category: string (optional)
 * - condition: string (required) - Valid values: "new", "used" ONLY
 * - useAI: string (optional) - "true" to use AI filtering, "false" for traditional
 */
const getPriceSuggestion = asyncHandler(async (req, res) => {
  const { productTitle, category, condition, useAI } = req.query;
  
  if (!productTitle) {
    res.status(400);
    throw new Error("Product title is required");
  }
  
  if (!condition) {
    res.status(400);
    throw new Error("Condition is required. Must be either 'new' or 'used'");
  }
  
  // Validate condition parameter - only allow "new" or "used"
  const validConditions = ['new', 'used'];
  const normalizedCondition = condition.toLowerCase();
  if (!validConditions.includes(normalizedCondition)) {
    res.status(400);
    throw new Error(`Invalid condition. Must be either 'new' or 'used'`);
  }

  // Parse useAI parameter (default to true)
  const shouldUseAI = useAI !== 'false';
  
  try {
    console.log(`\n🔍 PRICE SUGGESTION REQUEST`);
    console.log(`   Product: "${productTitle}"`);
    console.log(`   Category: ${category || 'Not specified'}`);
    console.log(`   Condition: ${normalizedCondition.toUpperCase()}`);
    console.log(`   AI Enabled: ${shouldUseAI}`);
    console.log(`   ═══════════════════════════════════════════════════════`);
    
    // Check cache first
    console.log(`🔍 Checking cache for price suggestion...`);
    const cachedSuggestion = await cacheService.cache.priceSuggestion.get(
      productTitle, 
      category, 
      normalizedCondition, 
      shouldUseAI
    );
    
    if (cachedSuggestion) {
      console.log(`\n⚡ CACHE HIT - Returning cached price suggestion`);
      console.log(`   Recommended bid: $${cachedSuggestion.recommendedBid}`);
      console.log(`   Cache age: ${Math.round((Date.now() - new Date(cachedSuggestion.generatedAt)) / 1000 / 60)} minutes`);
      console.log(`   Original processing time: ${cachedSuggestion.processingTime}ms`);
      console.log(`   Adding 3-second delay to simulate processing...`);
      
      // Add 3-second delay to make cached responses feel more authentic
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return res.status(200).json({
        success: true,
        suggestion: cachedSuggestion,
        fromCache: true
      });
    }
    
    console.log(`❌ Cache miss - Processing fresh request`);
    
    // Use the new 5-stage price suggestion system
    const result = await suggestionService.generatePriceSuggestionFiveStage(
      productTitle, 
      category, 
      normalizedCondition, 
      shouldUseAI
    );
    
    // Handle successful completion
    if (result.success) {
      console.log(`\n✅ PRICE SUGGESTION SUCCESS`);
      console.log(`   Recommended bid: $${result.suggestion.recommendedBid}`);
      console.log(`   Based on: ${result.suggestion.sources} relevant items`);
      console.log(`   Processing time: ${result.suggestion.processingTime}ms`);
      
      // Cache the successful result
      console.log(`💾 Caching price suggestion result...`);
      await cacheService.cache.priceSuggestion.set(
        productTitle, 
        category, 
        normalizedCondition, 
        shouldUseAI, 
        result.suggestion
      );
      
      return res.status(200).json({
        success: true,
        suggestion: result.suggestion,
        fromCache: false
      });
    }
    
    // Handle various failure scenarios
    const statusCode = 200; // Return 200 for all cases to allow frontend to handle gracefully
    
    // Stage 1 failures (no items scraped)
    if (result.stage === 1) {
      console.log(`❌ Stage 1 failure: ${result.error}`);
      return res.status(statusCode).json({
        success: false,
        message: `No ${normalizedCondition.toUpperCase()} items found for "${productTitle}". Try adjusting your search terms.`,
        stage: result.stage,
        error: result.error,
        processingTime: result.processingTime
      });
    }
    
    // Stage 2 failures (no valid items after filtering)
    if (result.stage === 2) {
      console.log(`❌ Stage 2 failure: ${result.error}`);
      return res.status(statusCode).json({
        success: false,
        message: `Found items but none had valid pricing data. Try a different product title.`,
        stage: result.stage,
        error: result.error,
        processingTime: result.processingTime
      });
    }
    
    // Stage 3 failures (relevance/AI issues)
    if (result.stage === 3) {
      console.log(`❌ Stage 3 failure: ${result.reason || result.error}`);
      
      // Generic item detection with filtered items to show
      if (result.isGeneric && result.showFilteredList && result.similarItems) {
        return res.status(statusCode).json({
          success: false,
          isGeneric: true,
          message: result.reason,
          step: result.step,
          totalItemsScraped: result.totalItemsScraped,
          similarItems: result.similarItems,
          diversityInfo: result.diversityInfo,
          showFilteredList: true,
          processingTime: result.processingTime
        });
      }
      
      // Generic item detection without useful items
      if (result.isGeneric) {
        return res.status(statusCode).json({
          success: false,
          isGeneric: true,
          message: result.reason,
          step: result.step,
          totalItemsScraped: result.totalItemsScraped,
          processingTime: result.processingTime
        });
      }
      
      // Other Stage 3 failures
      return res.status(statusCode).json({
        success: false,
        message: result.reason || result.error || `No relevant ${normalizedCondition.toUpperCase()} items found for price analysis`,
        stage: result.stage,
        processingTime: result.processingTime
      });
    }
    
    // Stage 4 failures (outlier removal)
    if (result.stage === 4) {
      console.log(`❌ Stage 4 failure: ${result.error}`);
      return res.status(statusCode).json({
        success: false,
        message: `Found relevant items but prices were too inconsistent for reliable analysis. Try a more specific product title.`,
        stage: result.stage,
        error: result.error,
        processingTime: result.processingTime
      });
    }
    
    // Stage 5 failures (calculation)
    if (result.stage === 5) {
      console.log(`❌ Stage 5 failure: ${result.error}`);
      return res.status(statusCode).json({
        success: false,
        message: `Unable to calculate price recommendation. Please try again.`,
        stage: result.stage,
        error: result.error,
        processingTime: result.processingTime
      });
    }
    
    // Unknown failures
    console.log(`❌ Unknown stage failure:`, result);
    return res.status(statusCode).json({
      success: false,
      message: result.error || "An unexpected error occurred during price analysis",
      stage: result.stage || 'unknown',
      processingTime: result.processingTime || 0
    });
    
  } catch (error) {
    console.error("❌ CRITICAL ERROR in price suggestion:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to generate price suggestion due to a system error",
      error: error.message,
      stage: 'system_error'
    });
  }
});

/**
 * Get cache statistics
 */
const getCacheStats = asyncHandler(async (req, res) => {
  try {
    const stats = await cacheService.getStats();
    
    res.status(200).json({
      success: true,
      cache: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Clear cache by type
 */
const clearCache = asyncHandler(async (req, res) => {
  const { type } = req.params;
  
  const validTypes = ['price_suggestion', 'ebay_scrape', 'ai_analysis', 'processed_items', 'all'];
  
  if (!validTypes.includes(type)) {
    res.status(400);
    throw new Error(`Invalid cache type. Must be one of: ${validTypes.join(', ')}`);
  }
  
  try {
    let deletedCount = 0;
    
    if (type === 'all') {
      // Clear all cache types
      for (const cacheType of validTypes.slice(0, -1)) { // Exclude 'all'
        deletedCount += await cacheService.clearByType(cacheType);
      }
    } else {
      deletedCount = await cacheService.clearByType(type);
    }
    
    res.status(200).json({
      success: true,
      message: `Cache cleared successfully`,
      type,
      deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Manual cache cleanup
 */
const cleanupCache = asyncHandler(async (req, res) => {
  try {
    const deletedCount = await cacheService.cleanup();
    
    res.status(200).json({
      success: true,
      message: `Cache cleanup completed`,
      deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check endpoint for the suggestion system
 */
const getSystemHealth = asyncHandler(async (req, res) => {
  try {
    const cacheStats = await cacheService.getStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        scraping: 'available',
        aiFiltering: process.env.OPENAI_API_KEY ? 'available' : 'unavailable',
        database: 'available',
        cache: cacheStats ? 'available' : 'unavailable'
      },
      version: '5-stage-system-with-cache',
      cache: cacheStats ? {
        totalEntries: cacheStats.totalEntries,
        activeEntries: cacheStats.activeEntries,
        expiredEntries: cacheStats.expiredEntries
      } : null,
      features: {
        fiveStageProcessing: true,
        mongodbCaching: true,
        aiRelevanceFiltering: !!process.env.OPENAI_API_KEY,
        semanticMatching: true,
        brandIntelligence: true,
        outlierRemoval: true,
        legacySupport: true
      }
    };
    
    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = {
  getPriceSuggestion,
  getDebugScrapedData,
  getSystemHealth,
  getCacheStats,
  clearCache,
  cleanupCache
}; 