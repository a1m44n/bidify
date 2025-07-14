const asyncHandler = require('express-async-handler');
const scrapingService = require('../services/scrapingService');
const suggestionService = require('../services/suggestionService');

/**
 * Debug endpoint to see raw scraped data
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
    
    // Get raw eBay results with condition filtering
    const ebayResults = await scrapingService.scrapeEbay(productTitle, normalizedCondition);
    
    res.status(200).json({
      success: true,
      searchTerm: productTitle,
      condition: normalizedCondition.toUpperCase(),
      totalItems: ebayResults.length,
      rawData: ebayResults,
      message: `Found ${ebayResults.length} ${normalizedCondition.toUpperCase()} items from eBay scraping`
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
 * Get price suggestion for a product
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
    console.log(`🔍 Getting price suggestion for "${productTitle}" (condition: ${normalizedCondition.toUpperCase()}, AI: ${shouldUseAI})`);
    
    // Step 1: Scrape items from eBay with condition filtering
    const ebayResults = await scrapingService.scrapeEbay(productTitle, normalizedCondition);
    
    if (ebayResults.length === 0) {
      return res.status(200).json({
        success: false,
        message: `No ${normalizedCondition.toUpperCase()} items found to generate a price suggestion`
      });
    }

    // Step 2: Filter for relevance using AI or traditional method
    let relevanceResult;
    
    if (shouldUseAI) {
      console.log('🤖 Using AI-powered relevance filtering');
      relevanceResult = await suggestionService.checkRelevanceWithAI(productTitle, ebayResults);
      
      // Handle generic item detection
      if (!relevanceResult.success && relevanceResult.isGeneric) {
        return res.status(200).json({
          success: false,
          isGeneric: true,
          message: relevanceResult.reason,
          step: relevanceResult.step,
          totalItemsScraped: ebayResults.length
        });
      }
    } else {
      console.log('📝 Using traditional string-based relevance filtering');
      const relevantItems = ebayResults.filter(item => 
        suggestionService.checkRelevance(
          productTitle, 
          item.title, 
          item.description || ''
        )
      );
      
      relevanceResult = {
        success: true,
        relevantItems,
        fallbackUsed: false,
        aiAnalysis: {
          method: 'traditional',
          totalItemsAnalyzed: ebayResults.length,
          relevantFound: relevantItems.length
        }
      };
    }

    const { relevantItems, aiAnalysis, fallbackUsed } = relevanceResult;
    
    if (!relevantItems || relevantItems.length === 0) {
      return res.status(200).json({
        success: false,
        message: `No relevant ${normalizedCondition.toUpperCase()} items found to generate a price suggestion`,
        aiAnalysis: aiAnalysis,
        fallbackUsed: fallbackUsed
      });
    }
    
    // Step 3: Extract prices from relevant items
    const prices = relevantItems.map(item => item.price);
    
    // Step 4: Calculate recommended bid and statistics
    const suggestion = suggestionService.calculateRecommendedBid(
      productTitle,
      category,
      prices,
      normalizedCondition
    );
    
    // Include a selection of the relevant items in the response
    const items = relevantItems.map(item => ({
      title: item.title,
      price: item.price,
      source: item.source,
      condition: item.condition,
      url: item.url,
      ...(item.aiClassification && { 
        aiConfidence: item.aiClassification.confidence,
        aiCategory: item.aiClassification.category
      })
    }));
    
    res.status(200).json({
      success: true,
      suggestion: {
        ...suggestion,
        condition: normalizedCondition.toUpperCase(),
        sources: relevantItems.length,
        items: items.slice(0, 10), // Return only top 10 items
        generatedAt: new Date().toISOString(),
        aiAnalysis: {
          ...aiAnalysis,
          methodUsed: shouldUseAI ? (fallbackUsed ? 'ai_with_fallback' : 'ai') : 'traditional',
          totalItemsScraped: ebayResults.length
        }
      }
    });
    
  } catch (error) {
    console.error("❌ Error generating price suggestion:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to generate price suggestion",
      error: error.message
    });
  }
});

module.exports = {
  getPriceSuggestion,
  getDebugScrapedData
}; 