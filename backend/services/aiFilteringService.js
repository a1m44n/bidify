const OpenAI = require('openai');

// Configure OpenAI with API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration for AI filtering
const AI_CONFIG = {
  timeout: 20000,     // 20 seconds timeout
  batchSize: 20,      // Process 20 items per batch
  maxRetries: 3,
  retryDelay: 2000,
  confidenceThreshold: 0.7,
  model: "gpt-4o"     // Use GPT-4o for optimal performance
};

/**
 * Check if a title is too generic for price suggestions
 * @param {string} title - Product title to analyze
 * @returns {boolean} - True if title is too generic
 */
function isTitleTooGeneric(title) {
  if (!title || typeof title !== 'string') return true;
  
  const normalizedTitle = title.toLowerCase().trim();
  const words = normalizedTitle.split(/\s+/).filter(word => word.length > 1);
  
  // Single word titles are almost always too generic
  if (words.length <= 1) return true;
  
  // Common generic terms that need more specificity
  const genericTerms = [
    'table', 'chair', 'shoe', 'shirt', 'car', 'phone', 'laptop', 'watch',
    'bag', 'book', 'toy', 'game', 'part', 'kit', 'set', 'tool', 'device'
  ];
  
  // If title is just generic terms without descriptors, it's too generic
  const hasOnlyGenericTerms = words.every(word => 
    genericTerms.includes(word) || 
    ['the', 'a', 'an', 'and', 'or', 'for', 'with'].includes(word)
  );
  
  return hasOnlyGenericTerms;
}

/**
 * Create AI prompt for batch item classification
 * @param {string} searchTerm - Original search term
 * @param {Array} items - Array of scraped items to classify
 * @returns {string} - Formatted prompt for OpenAI
 */
function createClassificationPrompt(searchTerm, items) {
  return `Analyze these marketplace items for relevance to the search: "${searchTerm}"

For each item, determine if it matches what someone searching for "${searchTerm}" would actually want to buy.

Consider these universal rules:
1. MAIN_PRODUCT: The actual item being searched for
2. ACCESSORY: Cases, covers, parts, attachments, add-ons for the main product
3. DIFFERENT_MODEL: Similar but different version/generation/variant of the product
4. UNRELATED: Completely different product category

Examples of what to REJECT:
- Phone cases when searching for phones
- Screen protectors when searching for tablets  
- Car parts when searching for whole cars
- Book covers when searching for books
- Clothing accessories when searching for clothing items
- Different generations unless very similar (iPhone 12 vs iPhone 13)
- Different sizes/models unless very similar

Items to analyze:
${items.map((item, index) => 
  `${index + 1}. "${item.title}" - $${item.price}\n   Description: ${item.description || 'N/A'}`
).join('\n')}

Return JSON array with exactly this format:
[
  {
    "itemIndex": 1,
    "relevant": true,
    "confidence": 0.95,
    "category": "main_product",
    "reasoning": "exact match for the searched product"
  }
]

Important: Only return the JSON array, no additional text.`;
}

/**
 * Classify a batch of items using OpenAI
 * @param {string} searchTerm - Original search term
 * @param {Array} items - Array of items to classify
 * @returns {Promise<Array>} - Array of classification results
 */
async function classifyItemsBatch(searchTerm, items) {
  try {
    const prompt = createClassificationPrompt(searchTerm, items);
    
    console.log(`🤖 AI: Classifying ${items.length} items for "${searchTerm}"`);
    
    const response = await openai.chat.completions.create({
      model: AI_CONFIG.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Low temperature for consistent classification
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content.trim();
    
    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response');
    }
    
    const classifications = JSON.parse(jsonMatch[0]);
    
    // Validate classifications
    if (!Array.isArray(classifications) || classifications.length === 0) {
      throw new Error('Invalid classification format');
    }
    
    console.log(`✅ AI: Successfully classified ${classifications.length} items`);
    return classifications;
    
  } catch (error) {
    console.error('❌ AI: Error in batch classification:', error);
    throw error;
  }
}

/**
 * Analyze if scraped results are too diverse/generic
 * @param {Array} classificationResults - Results from AI classification
 * @param {Array} originalItems - Original scraped items
 * @returns {Object} - Analysis results
 */
function analyzeResultsDiversity(classificationResults, originalItems) {
  const relevantItems = classificationResults.filter(result => result.relevant);
  const totalItems = classificationResults.length;
  
  if (relevantItems.length === 0) {
    return {
      tooGeneric: true,
      reason: "No relevant items found",
      relevantCount: 0,
      totalCount: totalItems
    };
  }
  
  // Calculate relevance ratio
  const relevanceRatio = relevantItems.length / totalItems;
  
  // If less than 20% of items are relevant, results are too diverse
  if (relevanceRatio < 0.2) {
    return {
      tooGeneric: true,
      reason: `Only ${Math.round(relevanceRatio * 100)}% of results are relevant`,
      relevantCount: relevantItems.length,
      totalCount: totalItems
    };
  }
  
  // Calculate price variance for relevant items
  const relevantPrices = relevantItems.map(result => {
    const itemIndex = result.itemIndex - 1;
    return originalItems[itemIndex]?.price;
  }).filter(price => price && !isNaN(price));
  
  if (relevantPrices.length > 1) {
    const minPrice = Math.min(...relevantPrices);
    const maxPrice = Math.max(...relevantPrices);
    const priceVariance = maxPrice / minPrice;
    
    // If price variance is too high, results might be too diverse
    if (priceVariance > 10) {
      return {
        tooGeneric: true,
        reason: `Price range too wide ($${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)})`,
        relevantCount: relevantItems.length,
        totalCount: totalItems,
        priceVariance
      };
    }
  }
  
  return {
    tooGeneric: false,
    relevantCount: relevantItems.length,
    totalCount: totalItems,
    relevanceRatio
  };
}

/**
 * Main function to classify items with AI and handle genericity
 * @param {string} searchTerm - Original search term
 * @param {Array} scrapedItems - Array of scraped items
 * @returns {Promise<Object>} - Classification results or genericity error
 */
async function classifyItemsWithAI(searchTerm, scrapedItems) {
  try {
    // Step 1: Check if title is too generic
    if (isTitleTooGeneric(searchTerm)) {
      return {
        success: false,
        isGeneric: true,
        reason: "Product title is too generic. Please add more details like brand, model, or specifications for accurate pricing.",
        step: "title_analysis"
      };
    }
    
    // Step 2: Process items in batches
    const batchSize = AI_CONFIG.batchSize;
    const allClassifications = [];
    
    for (let i = 0; i < scrapedItems.length; i += batchSize) {
      const batch = scrapedItems.slice(i, i + batchSize);
      
      // Adjust item indices for this batch
      const batchWithIndices = batch.map((item, batchIndex) => ({
        ...item,
        originalIndex: i + batchIndex
      }));
      
      try {
        const batchResults = await classifyItemsBatch(searchTerm, batchWithIndices);
        
        // Adjust indices back to original array
        const adjustedResults = batchResults.map(result => ({
          ...result,
          itemIndex: result.itemIndex + i
        }));
        
        allClassifications.push(...adjustedResults);
        
        // Small delay between batches to be respectful to API
        if (i + batchSize < scrapedItems.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (batchError) {
        console.error(`❌ AI: Batch ${i}-${i + batchSize} failed:`, batchError);
        // Continue with other batches
      }
    }
    
    if (allClassifications.length === 0) {
      throw new Error('All AI classification batches failed');
    }
    
    // Step 3: Analyze diversity of results
    const diversityAnalysis = analyzeResultsDiversity(allClassifications, scrapedItems);
    
    if (diversityAnalysis.tooGeneric) {
      return {
        success: false,
        isGeneric: true,
        reason: `Search results are too varied. ${diversityAnalysis.reason}. Try being more specific with your product title.`,
        step: "diversity_analysis",
        analysis: diversityAnalysis
      };
    }
    
    // Step 4: Return successful classification
    const relevantItems = allClassifications
      .filter(result => result.relevant && result.confidence >= AI_CONFIG.confidenceThreshold)
      .map(result => {
        const itemIndex = result.itemIndex - 1;
        return {
          ...scrapedItems[itemIndex],
          aiClassification: result
        };
      });
    
    console.log(`🎯 AI: Filtered ${scrapedItems.length} → ${relevantItems.length} relevant items`);
    
    return {
      success: true,
      relevantItems,
      totalProcessed: scrapedItems.length,
      aiAnalysis: {
        totalItemsAnalyzed: allClassifications.length,
        relevantFound: relevantItems.length,
        averageConfidence: relevantItems.reduce((sum, item) => 
          sum + item.aiClassification.confidence, 0) / relevantItems.length,
        diversityAnalysis
      }
    };
    
  } catch (error) {
    console.error('❌ AI: Classification failed:', error);
    throw error;
  }
}

module.exports = {
  classifyItemsWithAI,
  isTitleTooGeneric,
  AI_CONFIG
}; 