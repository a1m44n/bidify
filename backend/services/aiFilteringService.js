const OpenAI = require('openai');

// Configure OpenAI with API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configuration for AI filtering
const AI_CONFIG = {
  timeout: 30000,     // 30 seconds timeout for complex analysis
  batchSize: 15,      // Process 15 items per batch for better accuracy
  maxRetries: 3,
  retryDelay: 2000,
  confidenceThreshold: 0.75, // Higher threshold for better accuracy
  model: "gpt-4o"     // Use GPT-4o for optimal performance
};

/**
 * STAGE 3: RELEVANCE CHECK WITH AI
 * Enhanced AI filtering to solve semantic understanding, synonyms, brand intelligence, etc.
 */
async function checkRelevanceWithAIStage3(stage2Result) {
  console.log(`\n🤖 STAGE 3: AI RELEVANCE CHECK`);
  console.log(`   Processing ${stage2Result.items.length} filtered items with AI`);
  
  try {
    // Check if title is too generic first
    if (isTitleTooGeneric(stage2Result.searchTerm)) {
      console.log(`   ❌ Search term too generic: "${stage2Result.searchTerm}"`);
      return {
        success: false,
        stage: 3,
        isGeneric: true,
        reason: "Product title is too generic. Please add more details like brand, model, or specifications for accurate pricing.",
        step: "title_analysis",
        searchTerm: stage2Result.searchTerm,
        condition: stage2Result.condition
      };
    }
    
    // Process items in batches for better AI analysis
    const batchSize = AI_CONFIG.batchSize;
    const allClassifications = [];
    
    for (let i = 0; i < stage2Result.items.length; i += batchSize) {
      const batch = stage2Result.items.slice(i, i + batchSize);
      
      console.log(`   🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(stage2Result.items.length/batchSize)} (${batch.length} items)`);
      
      try {
        const batchResults = await classifyItemsBatchEnhanced(stage2Result.searchTerm, batch, stage2Result.condition);
        
        // Adjust indices for global array
        const adjustedResults = batchResults.map((result, index) => ({
          ...result,
          originalIndex: i + index,
          batchIndex: Math.floor(i/batchSize) + 1
        }));
        
        allClassifications.push(...adjustedResults);
        
        // Small delay between batches
        if (i + batchSize < stage2Result.items.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (batchError) {
        console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, batchError);
        // Continue with other batches rather than failing completely
      }
    }
    
    if (allClassifications.length === 0) {
      throw new Error('All AI classification batches failed');
    }
    
    // Filter for relevant items with high confidence
    const relevantItems = allClassifications
      .filter(result => result.relevant && result.confidence >= AI_CONFIG.confidenceThreshold)
      .map(result => {
        const originalItem = stage2Result.items[result.originalIndex];
        return {
          ...originalItem,
          aiClassification: result,
          stage3Index: result.originalIndex
        };
      });

    // Analyze diversity of results
    const diversityAnalysis = analyzeResultsDiversityEnhanced(allClassifications, stage2Result.items);
    
    if (diversityAnalysis.tooGeneric) {
      console.log(`   ⚠️  Diversity issue: ${diversityAnalysis.reason}`);
      return {
        success: false,
        stage: 3,
        isGeneric: true,
        reason: `Search results are too varied. ${diversityAnalysis.reason}. Try being more specific with your product title.`,
        step: "diversity_analysis",
        analysis: diversityAnalysis,
        relevantItems: relevantItems.length > 0 ? relevantItems : null,
        searchTerm: stage2Result.searchTerm,
        condition: stage2Result.condition
      };
    }
    
    if (relevantItems.length === 0) {
      console.log(`   ❌ No relevant items found after AI filtering`);
      return {
        success: false,
        stage: 3,
        reason: `No relevant items found. AI analysis showed the search results don't match "${stage2Result.searchTerm}".`,
        searchTerm: stage2Result.searchTerm,
        condition: stage2Result.condition,
        aiAnalysis: {
          totalItemsAnalyzed: allClassifications.length,
          relevantFound: 0,
          averageConfidence: 0
        }
      };
    }
    
    const averageConfidence = relevantItems.reduce((sum, item) => 
      sum + item.aiClassification.confidence, 0) / relevantItems.length;
    
    console.log(`   📊 Stage 3 Results:`);
    console.log(`      - AI analyzed: ${allClassifications.length} items`);
    console.log(`      - Relevant found: ${relevantItems.length} items`);
    console.log(`      - Average confidence: ${(averageConfidence * 100).toFixed(1)}%`);
    console.log(`   ✅ Stage 3 Complete: ${relevantItems.length} relevant items identified by AI`);
    
    return {
      success: true,
      stage: 3,
      items: relevantItems,
      searchTerm: stage2Result.searchTerm,
      condition: stage2Result.condition,
      aiAnalysis: {
        totalItemsAnalyzed: allClassifications.length,
        relevantFound: relevantItems.length,
        averageConfidence: averageConfidence,
        diversityAnalysis,
        batchesProcessed: Math.ceil(stage2Result.items.length / batchSize)
      }
    };
    
  } catch (error) {
    console.error('❌ AI Stage 3 failed:', error);
    throw error;
  }
}

/**
 * Enhanced AI prompt for better semantic understanding and relevance checking
 */
function createEnhancedClassificationPrompt(searchTerm, items, condition) {
  return `You are an expert product matching system for an auction platform. Analyze if these marketplace items are ACTUALLY relevant to what someone searching for "${searchTerm}" (condition: ${condition}) would want to buy.

🎯 SEARCH INTENT: "${searchTerm}" in ${condition} condition

🧠 ENHANCED MATCHING RULES:

1. SEMANTIC UNDERSTANDING:
   - "iPhone 13 Pro" = "Apple Phone 13 Professional" = "Apple iPhone 13 Pro"
   - Understand product names regardless of exact wording
   
2. BRAND INTELLIGENCE:
   - MacBook = Apple laptop, iPad = Apple tablet
   - Galaxy = Samsung, Pixel = Google, Surface = Microsoft
   - Connect products to their correct brands automatically
   
3. VERSION/MODEL AWARENESS:
   - iPhone 13 ≠ iPhone 13 Pro ≠ iPhone 13 Pro Max (different models)
   - iPhone 12 ≠ iPhone 13 (different generations)
   - Be strict about model/version differences
   
4. SYNONYM RECOGNITION:
   - laptop = notebook = computer
   - car = vehicle = automobile
   - phone = smartphone = mobile
   
5. CONDITION MATCHING:
   - ${condition} condition must match or be compatible
   - "refurbished" ≈ "used" but "new" ≠ "used"
   - "open box" ≈ "new" condition

6. ACCESSORY FILTERING:
   - REJECT: cases, covers, screen protectors, chargers, parts
   - REJECT: accessories that go WITH the product, not the product itself
   - ONLY ACCEPT: the actual product being searched for

🔍 ITEMS TO ANALYZE:
${items.map((item, index) => 
  `${index + 1}. "${item.title}" - $${item.price} [${item.condition}]
   Description: ${item.description || 'N/A'}`
).join('\n')}

📋 CLASSIFICATION CATEGORIES:
- EXACT_MATCH: Perfect match (same product, brand, model)
- SEMANTIC_MATCH: Same product with different wording
- COMPATIBLE_MODEL: Very similar model/variant of the same product
- DIFFERENT_MODEL: Same brand/category but different model/generation
- ACCESSORY: Cases, parts, accessories FOR the product
- UNRELATED: Completely different product

🎯 CONFIDENCE LEVELS:
- 0.95-1.0: Perfect match, exactly what user wants
- 0.85-0.94: Very good match, slight wording differences
- 0.75-0.84: Good match, compatible variant
- 0.65-0.74: Questionable match, might be relevant
- Below 0.65: Not relevant

Return JSON array:
[
  {
    "itemIndex": 1,
    "relevant": true,
    "confidence": 0.95,
    "category": "exact_match",
    "reasoning": "Perfect match for iPhone 13 Pro",
    "semanticMatches": ["iPhone", "13", "Pro"],
    "brandDetected": "Apple",
    "versionMatch": true,
    "conditionCompatible": true
  }
]

CRITICAL: Only return the JSON array, no additional text.`;
}

/**
 * Enhanced batch classification with improved AI analysis
 */
async function classifyItemsBatchEnhanced(searchTerm, items, condition) {
  try {
    const prompt = createEnhancedClassificationPrompt(searchTerm, items, condition);
    
    console.log(`      🤖 AI analyzing ${items.length} items for semantic relevance...`);
    
    const response = await openai.chat.completions.create({
      model: AI_CONFIG.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Very low temperature for consistent analysis
      max_tokens: 3000,
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
    
    // Enhance classifications with additional metadata
    const enhancedClassifications = classifications.map(result => ({
      ...result,
      timestamp: new Date().toISOString(),
      model: AI_CONFIG.model,
      enhanced: true
    }));
    
    console.log(`      ✅ AI classified ${enhancedClassifications.length} items successfully`);
    return enhancedClassifications;
    
  } catch (error) {
    console.error('      ❌ AI batch classification failed:', error);
    throw error;
  }
}

/**
 * Check if a title is too generic for price suggestions
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
    'bag', 'book', 'toy', 'game', 'part', 'kit', 'set', 'tool', 'device',
    'computer', 'tablet', 'camera', 'headphones', 'speaker', 'mouse'
  ];
  
  // If title is mostly generic terms without specific descriptors
  const genericCount = words.filter(word => genericTerms.includes(word)).length;
  const specificityRatio = (words.length - genericCount) / words.length;
  
  // Need at least 60% non-generic words for specific search
  return specificityRatio < 0.6;
}

/**
 * Enhanced diversity analysis for better generic detection
 */
function analyzeResultsDiversityEnhanced(classificationResults, originalItems) {
  const relevantItems = classificationResults.filter(result => result.relevant);
  const totalItems = classificationResults.length;
  
  if (relevantItems.length === 0) {
    return {
      tooGeneric: true,
      reason: "No relevant items found by AI analysis",
      relevantCount: 0,
      totalCount: totalItems
    };
  }
  
  // Calculate relevance ratio
  const relevanceRatio = relevantItems.length / totalItems;
  
  // If less than 25% of items are relevant, results are too diverse
  if (relevanceRatio < 0.25) {
    return {
      tooGeneric: true,
      reason: `Only ${Math.round(relevanceRatio * 100)}% of results are relevant to the search`,
      relevantCount: relevantItems.length,
      totalCount: totalItems,
      relevanceRatio
    };
  }
  
  // Analyze category diversity - if too many different categories, it's generic
  const categories = relevantItems.map(item => item.category);
  const uniqueCategories = [...new Set(categories)];
  
  if (uniqueCategories.length > 3 && relevantItems.length > 10) {
    return {
      tooGeneric: true,
      reason: `Results span too many different product categories (${uniqueCategories.length} categories)`,
      relevantCount: relevantItems.length,
      totalCount: totalItems,
      categoryDiversity: uniqueCategories.length
    };
  }
  
  // Calculate price variance for relevant items
  const relevantPrices = relevantItems.map(result => {
    return originalItems[result.originalIndex || result.itemIndex - 1]?.price;
  }).filter(price => price && !isNaN(price));
  
  if (relevantPrices.length > 1) {
    const minPrice = Math.min(...relevantPrices);
    const maxPrice = Math.max(...relevantPrices);
    const priceVariance = maxPrice / minPrice;
    
    // If price variance is too high, results might be too diverse
    if (priceVariance > 15) { // Slightly more lenient for AI-filtered results
      return {
        tooGeneric: true,
        reason: `Price range too wide ($${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}) indicating diverse product types`,
        relevantCount: relevantItems.length,
        totalCount: totalItems,
        priceVariance
      };
    }
  }
  
  // Check confidence spread - if confidences vary too much, search might be ambiguous
  const confidences = relevantItems.map(item => item.confidence);
  const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  
  if (avgConfidence < 0.8) {
    return {
      tooGeneric: true,
      reason: `AI confidence too low (${(avgConfidence * 100).toFixed(1)}%) indicating ambiguous search results`,
      relevantCount: relevantItems.length,
      totalCount: totalItems,
      averageConfidence: avgConfidence
    };
  }
  
  return {
    tooGeneric: false,
    relevantCount: relevantItems.length,
    totalCount: totalItems,
    relevanceRatio,
    categoryDiversity: uniqueCategories.length,
    averageConfidence: avgConfidence
  };
}

/**
 * Fallback to traditional string matching if AI fails
 */
function checkRelevanceTraditional(searchTerm, items) {
  console.log(`   🔄 Using traditional string matching as fallback`);
  
  const relevantItems = items.filter(item => {
    const normalizedOriginal = searchTerm.toLowerCase().trim();
    const normalizedTitle = item.title.toLowerCase().trim();
    const normalizedDesc = (item.description || '').toLowerCase().trim();
    
    // Split search terms and check if they appear in the title or description
    const searchTerms = normalizedOriginal.split(/\s+/);
    const matchCount = searchTerms.filter(term => 
      normalizedTitle.includes(term) || normalizedDesc.includes(term)
    ).length;
    
    // Consider it relevant if at least 50% of search terms are found
    return matchCount >= Math.ceil(searchTerms.length * 0.5);
  });
  
  return {
    success: true,
    stage: 3,
    items: relevantItems.map((item, index) => ({
      ...item,
      stage3Index: index,
      traditionalMatch: true
    })),
    fallbackUsed: true,
    aiAnalysis: {
      method: 'traditional_fallback',
      totalItemsAnalyzed: items.length,
      relevantFound: relevantItems.length
    }
  };
}

module.exports = {
  checkRelevanceWithAIStage3,
  classifyItemsBatchEnhanced,
  isTitleTooGeneric,
  analyzeResultsDiversityEnhanced,
  checkRelevanceTraditional,
  // Backwards compatibility
  classifyItemsWithAI: async (searchTerm, scrapedItems) => {
    // Convert old format to new stage format
    const stage2Result = {
      items: scrapedItems,
      searchTerm,
      condition: 'USED' // Default for backwards compatibility
    };
    
    const result = await checkRelevanceWithAIStage3(stage2Result);
    
    if (!result.success) {
      return {
        success: false,
        isGeneric: result.isGeneric,
        reason: result.reason,
        step: result.step
      };
    }
    
    return {
      success: true,
      relevantItems: result.items,
      aiAnalysis: result.aiAnalysis
    };
  }
}; 