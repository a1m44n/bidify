const axios = require('axios');
const OpenAI = require('openai');
const aiFilteringService = require('./aiFilteringService');

// Configure OpenAI with new syntax
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate expanded keywords for better search results
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

// Clean price data by removing outliers
function cleanPriceOutliers(prices) {
  if (prices.length <= 2) return prices;
  
  // Sort prices
  const sortedPrices = [...prices].sort((a, b) => a - b);
  
  // Calculate Q1, Q3, and IQR
  const q1Index = Math.floor(sortedPrices.length * 0.25);
  const q3Index = Math.floor(sortedPrices.length * 0.75);
  const q1 = sortedPrices[q1Index];
  const q3 = sortedPrices[q3Index];
  const iqr = q3 - q1;
  
  // Define outlier boundaries (1.5 * IQR)
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  // Filter out outliers
  return prices.filter(price => price >= lowerBound && price <= upperBound);
}

// Check if a scraped item is relevant to the original search using simple string matching
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

/**
 * Enhanced relevance checking using AI
 * @param {string} searchTerm - Original search term
 * @param {Array} scrapedItems - Array of scraped items to filter
 * @returns {Promise<Object>} - Object containing relevant items or error information
 */
async function checkRelevanceWithAI(searchTerm, scrapedItems) {
  try {
    console.log(`🤖 Starting AI relevance check for "${searchTerm}" with ${scrapedItems.length} items`);
    
    // Use AI filtering service to classify items
    const aiResult = await aiFilteringService.classifyItemsWithAI(searchTerm, scrapedItems);
    
    if (!aiResult.success) {
      // Check if it's a diversity issue - if so, try to get the relevant items anyway
      if (aiResult.step === "diversity_analysis" && aiResult.relevantItems && aiResult.relevantItems.length > 0) {
        // We have relevant items but diversity issues - return them for display without price calculations
        console.log(`🔄 Diversity issue detected, but ${aiResult.relevantItems.length} relevant items found`);
        
        return {
          success: false,
          isGeneric: aiResult.isGeneric,
          reason: aiResult.reason,
          step: aiResult.step,
          fallbackUsed: false,
          hasRelevantItems: true,
          relevantItems: aiResult.relevantItems,
          analysis: aiResult.analysis
        };
      }
      
      // Return error information for generic items (no relevant items case)
      return {
        success: false,
        isGeneric: aiResult.isGeneric,
        reason: aiResult.reason,
        step: aiResult.step,
        fallbackUsed: false
      };
    }
    
    // Return successful AI filtering results
    return {
      success: true,
      relevantItems: aiResult.relevantItems,
      aiAnalysis: aiResult.aiAnalysis,
      fallbackUsed: false
    };
    
  } catch (error) {
    console.error('❌ AI relevance check failed, falling back to traditional method:', error);
    
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

// Calculate recommended bid based on cleaned data
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
  generateExpandedKeywords,
  checkRelevance,
  checkRelevanceWithAI,
  cleanPriceOutliers,
  calculateRecommendedBid
}; 