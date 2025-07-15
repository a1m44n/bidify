const axios = require('axios');
const OpenAI = require('openai');
const scrapingService = require('./scrapingService');
const aiFilteringService = require('./aiFilteringService');

// Configure OpenAI with new syntax
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * FIVE-STAGE PRICE SUGGESTION ORCHESTRATOR
 * 
 * This is the main orchestrator that runs all 5 stages in sequence:
 * Stage 1: Initial Scrape - Raw data extraction from eBay
 * Stage 2: Initial Filtering - Remove invalid items  
 * Stage 3: AI Relevance Check - Enhanced semantic filtering
 * Stage 4: Outlier Removal - Statistical price cleaning
 * Stage 5: Final Calculation - Price recommendation
 */
async function generatePriceSuggestionFiveStage(productTitle, category, condition, useAI = true) {
  console.log(`\n🚀 STARTING 5-STAGE PRICE SUGGESTION PROCESS`);
  console.log(`   Product: "${productTitle}"`);
  console.log(`   Category: ${category || 'Not specified'}`);
  console.log(`   Condition: ${condition}`);
  console.log(`   AI Enabled: ${useAI}`);
  console.log(`   ═══════════════════════════════════════════════════════`);
  
  const startTime = Date.now();
  
  try {
    // STAGE 1: INITIAL SCRAPE
    console.log(`\n📍 STAGE 1/5: INITIAL SCRAPE`);
    const stage1Result = await scrapingService.scrapeEbayStage1(productTitle, condition);
    
    if (!stage1Result.success || stage1Result.items.length === 0) {
      return {
        success: false,
        stage: 1,
        error: stage1Result.error || `No items found for "${productTitle}" in ${condition} condition`,
        processingTime: Date.now() - startTime,
        stageResults: { stage1: stage1Result }
      };
    }
    
    // STAGE 2: INITIAL FILTERING
    console.log(`\n📍 STAGE 2/5: INITIAL FILTERING`);
    const stage2Result = scrapingService.filterItemsStage2(stage1Result);
    
    if (!stage2Result.success || stage2Result.items.length === 0) {
      return {
        success: false,
        stage: 2,
        error: `No valid items remaining after initial filtering`,
        processingTime: Date.now() - startTime,
        stageResults: { stage1: stage1Result, stage2: stage2Result }
      };
    }
    
    // STAGE 3: RELEVANCE CHECK (AI or Traditional)
    console.log(`\n📍 STAGE 3/5: RELEVANCE CHECK`);
    let stage3Result;
    
    if (useAI) {
      try {
        stage3Result = await aiFilteringService.checkRelevanceWithAIStage3(stage2Result);
      } catch (aiError) {
        console.error('   ❌ AI failed, falling back to traditional method:', aiError);
        stage3Result = aiFilteringService.checkRelevanceTraditional(stage2Result.searchTerm, stage2Result.items);
        stage3Result.searchTerm = stage2Result.searchTerm;
        stage3Result.condition = stage2Result.condition;
      }
    } else {
      stage3Result = aiFilteringService.checkRelevanceTraditional(stage2Result.searchTerm, stage2Result.items);
      stage3Result.searchTerm = stage2Result.searchTerm;
      stage3Result.condition = stage2Result.condition;
    }
    
    // Handle various Stage 3 failure cases
    if (!stage3Result.success) {
      const processingTime = Date.now() - startTime;
      
      // Generic/diverse results - return with filtered items if available
      if (stage3Result.isGeneric && stage3Result.relevantItems && stage3Result.relevantItems.length > 0) {
        return {
          success: false,
          stage: 3,
          isGeneric: true,
          reason: stage3Result.reason,
          step: stage3Result.step,
          totalItemsScraped: stage1Result.items.length,
          similarItems: stage3Result.relevantItems.slice(0, 15).map(formatItemForResponse),
          diversityInfo: stage3Result.analysis,
          showFilteredList: true,
          processingTime,
          stageResults: { stage1: stage1Result, stage2: stage2Result, stage3: stage3Result }
        };
      }
      
      // No relevant items or other failures
      return {
        success: false,
        stage: 3,
        isGeneric: stage3Result.isGeneric || false,
        reason: stage3Result.reason,
        step: stage3Result.step,
        totalItemsScraped: stage1Result.items.length,
        processingTime,
        stageResults: { stage1: stage1Result, stage2: stage2Result, stage3: stage3Result }
      };
    }
    
    if (stage3Result.items.length === 0) {
      return {
        success: false,
        stage: 3,
        error: `No relevant items found after relevance filtering`,
        processingTime: Date.now() - startTime,
        stageResults: { stage1: stage1Result, stage2: stage2Result, stage3: stage3Result }
      };
    }
    
    // STAGE 4: OUTLIER REMOVAL
    console.log(`\n📍 STAGE 4/5: OUTLIER REMOVAL`);
    const stage4Result = scrapingService.removeOutliersStage4(stage3Result);
    
    if (!stage4Result.success || stage4Result.items.length === 0) {
      return {
        success: false,
        stage: 4,
        error: `No items remaining after outlier removal`,
        processingTime: Date.now() - startTime,
        stageResults: { stage1: stage1Result, stage2: stage2Result, stage3: stage3Result, stage4: stage4Result }
      };
    }
    
    // STAGE 5: FINAL CALCULATION
    console.log(`\n📍 STAGE 5/5: FINAL CALCULATION`);
    const stage5Result = scrapingService.calculateFinalPriceStage5(stage4Result);
    
    if (!stage5Result.success) {
      return {
        success: false,
        stage: 5,
        error: stage5Result.error,
        processingTime: Date.now() - startTime,
        stageResults: { stage1: stage1Result, stage2: stage2Result, stage3: stage3Result, stage4: stage4Result, stage5: stage5Result }
      };
    }
    
    // SUCCESS - All stages completed
    const processingTime = Date.now() - startTime;
    
    console.log(`\n🎉 5-STAGE PROCESS COMPLETED SUCCESSFULLY`);
    console.log(`   Processing time: ${processingTime}ms`);
    console.log(`   Final recommendation: $${stage5Result.calculation.recommendedBid}`);
    console.log(`   Based on ${stage5Result.items.length} relevant items`);
    console.log(`   ═══════════════════════════════════════════════════════`);
    
    return {
      success: true,
      suggestion: formatEnhancedSuggestionResponse(stage5Result, processingTime, {
        stage1: stage1Result,
        stage2: stage2Result,
        stage3: stage3Result,
        stage4: stage4Result,
        stage5: stage5Result
      })
    };
    
  } catch (error) {
    console.error('❌ 5-Stage process failed:', error);
    return {
      success: false,
      stage: 'unknown',
      error: `Price suggestion process failed: ${error.message}`,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Format item for API response
 */
function formatItemForResponse(item) {
  return {
    title: item.title,
    price: item.price,
    source: item.source,
    condition: item.condition,
    url: item.url,
    ...(item.aiClassification && { 
      aiConfidence: item.aiClassification.confidence,
      aiCategory: item.aiClassification.category,
      aiReasoning: item.aiClassification.reasoning
    }),
    ...(item.traditionalMatch && { traditionalMatch: true })
  };
}

/**
 * Format enhanced suggestion response with all new fields
 */
function formatEnhancedSuggestionResponse(stage5Result, processingTime, stageResults) {
  return {
    // Core recommendation
    recommendedBid: stage5Result.calculation.recommendedBid,
    reasoning: stage5Result.calculation.reasoning,
    confidence: stage5Result.calculation.confidence,
    sampleQuality: stage5Result.calculation.sampleQuality,
    
    // Price analysis
    priceRange: stage5Result.calculation.priceRange,
    averagePrice: stage5Result.calculation.averagePrice,
    medianPrice: stage5Result.calculation.medianPrice,
    priceVariance: stage5Result.calculation.priceVariance,
    
    // Item details
    condition: stage5Result.condition,
    sources: stage5Result.items.length,
    itemCount: stage5Result.calculation.itemCount,
    items: stage5Result.items.slice(0, 10).map(formatItemForResponse),
    
    // Processing metadata
    generatedAt: new Date().toISOString(),
    processingTime,
    
    // Enhanced 5-stage analysis
    fiveStageAnalysis: {
      stage1: {
        itemsScraped: stageResults.stage1.items.length,
        success: stageResults.stage1.success,
        description: "Initial eBay scraping"
      },
      stage2: {
        itemsAfterFiltering: stageResults.stage2.items.length,
        itemsRemoved: stageResults.stage1.items.length - stageResults.stage2.items.length,
        removedCount: stageResults.stage2.removedCount,
        description: "Basic data validation"
      },
      stage3: {
        method: stageResults.stage3.aiAnalysis ? 
          (stageResults.stage3.fallbackUsed ? 'ai_with_fallback' : 'ai') : 'traditional',
        itemsAfterRelevance: stageResults.stage3.items.length,
        itemsRemoved: stageResults.stage2.items.length - stageResults.stage3.items.length,
        description: "AI relevance filtering",
        ...(stageResults.stage3.aiAnalysis && { aiAnalysis: stageResults.stage3.aiAnalysis })
      },
      stage4: {
        itemsAfterOutliers: stageResults.stage4.items.length,
        itemsRemoved: stageResults.stage3.items.length - stageResults.stage4.items.length,
        outlierInfo: stageResults.stage4.outlierInfo,
        description: "Comprehensive outlier removal"
      },
      stage5: {
        finalItemCount: stage5Result.items.length,
        calculation: {
          recommendedBid: stage5Result.calculation.recommendedBid,
          confidence: stage5Result.calculation.confidence,
          priceVariance: stage5Result.calculation.priceVariance
        },
        description: "Enhanced price calculation"
      }
    }
  };
}

/**
 * LEGACY SUPPORT FUNCTIONS
 * These maintain backwards compatibility with existing code
 */

// Generate expanded keywords for better search results (legacy)
async function generateExpandedKeywords(productTitle, category) {
  try {
    const prompt = `
Generate 5-7 search keywords or phrases for finding similar items to: "${productTitle}" (Category: ${category}).
Include synonyms, model numbers if applicable, and common market phrases.
Format as a JSON array of strings.
Example: ["keyword1", "keyword2", ...]
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const content = response.choices[0].message.content.trim();
    // Extract JSON array from response
    const match = content.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [productTitle]; // Fallback to original title
  } catch (error) {
    console.error("Error generating keywords:", error);
    return [productTitle]; // Fallback to original title
  }
}

// Traditional relevance checking (legacy)
function checkRelevance(originalItem, scrapedItemTitle, scrapedItemDescription = "") {
  const normalizedOriginal = originalItem.toLowerCase().trim();
  const normalizedTitle = scrapedItemTitle.toLowerCase().trim();
  const normalizedDesc = scrapedItemDescription.toLowerCase().trim();
  
  // Split search terms and check if they appear in the title or description
  const searchTerms = normalizedOriginal.split(/\s+/);
  const matchCount = searchTerms.filter(term => 
    normalizedTitle.includes(term) || normalizedDesc.includes(term)
  ).length;
  
  // Consider it relevant if at least 50% of search terms are found
  return matchCount >= Math.ceil(searchTerms.length * 0.5);
}

// AI relevance checking (legacy wrapper)
async function checkRelevanceWithAI(searchTerm, scrapedItems) {
  try {
    console.log(`🔄 Legacy AI wrapper called for "${searchTerm}" with ${scrapedItems.length} items`);
    
    // Convert to new stage format
    const stage2Result = {
      items: scrapedItems,
      searchTerm,
      condition: 'USED' // Default for legacy calls
    };
    
    const result = await aiFilteringService.checkRelevanceWithAIStage3(stage2Result);
    
    if (!result.success) {
      // Handle various failure cases for legacy compatibility
      if (result.isGeneric && result.relevantItems && result.relevantItems.length > 0) {
        return {
          success: false,
          isGeneric: result.isGeneric,
          reason: result.reason,
          step: result.step,
          fallbackUsed: false,
          hasRelevantItems: true,
          relevantItems: result.relevantItems,
          analysis: result.analysis
        };
      }
      
      return {
        success: false,
        isGeneric: result.isGeneric,
        reason: result.reason,
        step: result.step,
        fallbackUsed: false
      };
    }
    
    // Return successful AI filtering results
    return {
      success: true,
      relevantItems: result.items,
      aiAnalysis: result.aiAnalysis,
      fallbackUsed: false
    };
    
  } catch (error) {
    console.error('❌ Legacy AI relevance check failed, falling back to traditional method:', error);
    
    // Fallback to traditional string matching
    const relevantItems = scrapedItems.filter(item => 
      checkRelevance(searchTerm, item.title, item.description || '')
    );
    
    return {
      success: true,
      relevantItems,
      aiAnalysis: {
        error: error.message,
        fallbackUsed: true,
        totalItemsAnalyzed: scrapedItems.length,
        relevantFound: relevantItems.length
      },
      fallbackUsed: true
    };
  }
}

// Clean price data by removing outliers (legacy)
function cleanPriceOutliers(prices) {
  return scrapingService.cleanPriceOutliers(prices);
}

// Calculate recommended bid based on cleaned data (legacy)
function calculateRecommendedBid(productTitle, category, prices, itemCondition = "New") {
  // Clean outliers
  const cleanedPrices = cleanPriceOutliers(prices);
  
  if (cleanedPrices.length === 0) return null;
  
  // Calculate statistics
  const min = Math.min(...cleanedPrices);
  const max = Math.max(...cleanedPrices);
  const avg = cleanedPrices.reduce((sum, price) => sum + price, 0) / cleanedPrices.length;
  
  // Sort for median
  const sortedPrices = [...cleanedPrices].sort((a, b) => a - b);
  const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
  
  // Calculate recommended bid (90% of median price)
  const recommendedBid = parseFloat((median * 0.9).toFixed(2));
  
  return {
    recommendedBid,
    reasoning: `Based on analysis of similar items, with prices ranging from $${min.toFixed(2)} to $${max.toFixed(2)}.`,
    priceRange: { min, max },
    averagePrice: parseFloat(avg.toFixed(2)),
    medianPrice: parseFloat(median.toFixed(2)),
    cleanedPrices,
    originalPrices: prices
  };
}

module.exports = {
  // NEW 5-STAGE SYSTEM
  generatePriceSuggestionFiveStage,
  formatItemForResponse,
  formatEnhancedSuggestionResponse,
  
  // LEGACY SUPPORT (for backwards compatibility)
  generateExpandedKeywords,
  checkRelevance,
  checkRelevanceWithAI,
  cleanPriceOutliers,
  calculateRecommendedBid
}; 