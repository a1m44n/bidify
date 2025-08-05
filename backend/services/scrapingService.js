const axios = require('axios');
const cheerio = require('cheerio');

/**
 * STAGE 1: INITIAL SCRAPE
 * Scrapes eBay search results page and finds all item containers
 */
async function scrapeEbayStage1(searchTerm, condition) {
  try {
    const encodedSearchTerm = encodeURIComponent(searchTerm);
    
    // Validate condition parameter
    if (!condition || !['new', 'used'].includes(condition.toLowerCase())) {
      throw new Error('Condition is required and must be either "new" or "used"');
    }
    
    const normalizedCondition = condition.toLowerCase();
    
    // Add condition filtering to URL
    let conditionParam = '';
    if (normalizedCondition === 'new') {
      conditionParam = '&LH_ItemCondition=1000'; // New items only
    } else if (normalizedCondition === 'used') {
      conditionParam = '&LH_ItemCondition=3000'; // Used items only
    }
    
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedSearchTerm}&_sacat=0&LH_Sold=1&LH_Complete=1${conditionParam}`;
    
    console.log(`\n🔍 STAGE 1: INITIAL SCRAPE`);
    console.log(`   Searching for: "${searchTerm}" with condition: "${normalizedCondition.toUpperCase()}"`);
    console.log(`   URL: ${url}`);
    
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    const rawItems = [];
    
    console.log(`📊 Found ${$('.s-item__wrapper').length} item wrappers on page`);
    
    $('.s-item__wrapper').each((index, element) => {
      // Skip the first element which is usually a heading
      if (index === 0) return;
      
      // Extract all raw data without filtering
      const title = $(element).find('.s-item__title').text().trim();
      const priceText = $(element).find('.s-item__price').text().trim();
      const url = $(element).find('a.s-item__link').attr('href');
      const description = $(element).find('.s-item__subtitle').text().trim();
      
      rawItems.push({
        title,
        priceText,
        url,
        description,
        condition: normalizedCondition.toUpperCase(),
        source: 'eBay',
        stage1Index: index
      });
    });
    
    console.log(`   ✅ Stage 1 Complete: ${rawItems.length} raw items scraped`);
    return {
      success: true,
      stage: 1,
      items: rawItems,
      searchTerm,
      condition: normalizedCondition.toUpperCase()
    };
    
  } catch (error) {
    console.error(`❌ Stage 1 Error:`, error);
    return {
      success: false,
      stage: 1,
      error: error.message,
      items: []
    };
  }
}

/**
 * STAGE 2: INITIAL FILTERING
 * Remove invalid prices, shop links, wrong conditions
 */
function filterItemsStage2(stage1Result) {
  console.log(`\n🔄 STAGE 2: INITIAL FILTERING`);
  console.log(`   Processing ${stage1Result.items.length} raw items`);
  
  const filteredItems = [];
  let removedCount = {
    noTitle: 0,
    shopLinks: 0,
    invalidPrice: 0,
    missingUrl: 0
  };
  
  stage1Result.items.forEach((item, index) => {
    // Filter 1: Remove items with no title or "Shop on eBay" in title
    if (!item.title || item.title.includes('Shop on eBay')) {
      removedCount.noTitle++;
      console.log(`   ❌ Removed (no title/shop link): "${item.title}"`);
      return;
    }
    
    // Filter 2: Remove items with invalid prices
    let priceText = item.priceText;
    // Remove "to" price ranges if present
    if (priceText.includes(' to ')) {
      priceText = priceText.split(' to ')[0];
    }
    
    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
    if (isNaN(price) || price <= 0) {
      removedCount.invalidPrice++;
      console.log(`   ❌ Removed (invalid price): "${item.title}" - "${item.priceText}"`);
      return;
    }
    
    // Filter 3: Remove items with missing URLs
    if (!item.url) {
      removedCount.missingUrl++;
      console.log(`   ❌ Removed (missing URL): "${item.title}"`);
      return;
    }
    
    // Item passed all filters
    filteredItems.push({
      ...item,
      price,
      originalPriceText: item.priceText,
      stage2Index: filteredItems.length
    });
  });
  
  console.log(`   📊 Stage 2 Results:`);
  console.log(`      - Started with: ${stage1Result.items.length} items`);
  console.log(`      - Removed ${removedCount.noTitle} items (no title/shop links)`);
  console.log(`      - Removed ${removedCount.invalidPrice} items (invalid prices)`);
  console.log(`      - Removed ${removedCount.missingUrl} items (missing URLs)`);
  console.log(`   ✅ Stage 2 Complete: ${filteredItems.length} valid items remaining`);
  
  return {
    success: true,
    stage: 2,
    items: filteredItems,
    searchTerm: stage1Result.searchTerm,
    condition: stage1Result.condition,
    removedCount
  };
}

/**
 * STAGE 4: OUTLIER REMOVAL - COMPREHENSIVE HYBRID APPROACH
 * Remove statistical outliers using multiple advanced techniques
 */
function removeOutliersStage4(stage3Result) {
  console.log(`\n🔄 STAGE 4: COMPREHENSIVE OUTLIER REMOVAL`);
  console.log(`   Processing ${stage3Result.items.length} relevant items`);
  
  if (stage3Result.items.length <= 1) {
    console.log(`   ⚠️  Only ${stage3Result.items.length} item(s), skipping outlier removal`);
    return {
      success: true,
      stage: 4,
      items: stage3Result.items,
      searchTerm: stage3Result.searchTerm,
      condition: stage3Result.condition,
      outlierInfo: {
        originalCount: stage3Result.items.length,
        removedCount: 0,
        finalCount: stage3Result.items.length,
        method: 'insufficient_data'
      }
    };
  }
  
  const originalPrices = stage3Result.items.map(item => item.price);
  const cleanedPrices = comprehensiveHybridOutlierRemoval(originalPrices);
  
  // Filter items to keep only those with non-outlier prices
  const filteredItems = stage3Result.items.filter(item => 
    cleanedPrices.includes(item.price)
  );
  
  const removedCount = stage3Result.items.length - filteredItems.length;
  
  console.log(`   📊 Stage 4 Results:`);
  console.log(`      - Original price range: $${Math.min(...originalPrices).toFixed(2)} - $${Math.max(...originalPrices).toFixed(2)}`);
  console.log(`      - Removed ${removedCount} outliers`);
  if (cleanedPrices.length > 0) {
    console.log(`      - Clean price range: $${Math.min(...cleanedPrices).toFixed(2)} - $${Math.max(...cleanedPrices).toFixed(2)}`);
  }
  console.log(`   ✅ Stage 4 Complete: ${filteredItems.length} items after comprehensive outlier removal`);
  
  return {
    success: true,
    stage: 4,
    items: filteredItems,
    searchTerm: stage3Result.searchTerm,
    condition: stage3Result.condition,
    outlierInfo: {
      originalCount: stage3Result.items.length,
      removedCount,
      finalCount: filteredItems.length,
      originalPrices,
      cleanedPrices,
      method: 'comprehensive_hybrid'
    }
  };
}

/**
 * COMPREHENSIVE HYBRID OUTLIER REMOVAL
 * Multi-layer approach combining ratio filtering, clustering, and enhanced IQR
 */
function comprehensiveHybridOutlierRemoval(prices) {
  if (prices.length <= 1) return prices;
  
  console.log(`\n   🔧 COMPREHENSIVE HYBRID OUTLIER REMOVAL`);
  console.log(`      Starting with ${prices.length} prices`);
  
  let filtered = [...prices];
  const originalCount = filtered.length;
  
  // LAYER 1: EXTREME OUTLIER REMOVAL (Ratio-based)
  console.log(`\n   📊 Layer 1: Extreme Outlier Removal`);
  const median = calculateMedian(filtered);
  const beforeLayer1 = filtered.length;
  
  filtered = filtered.filter(price => {
    const ratio = price / median;
    const isValid = ratio >= 0.1 && ratio <= 10;
    if (!isValid) {
      console.log(`      ❌ Extreme outlier: $${price} (${ratio.toFixed(2)}x median)`);
    }
    return isValid;
  });
  
  console.log(`      Result: ${beforeLayer1} → ${filtered.length} items (removed ${beforeLayer1 - filtered.length} extreme outliers)`);
  
  if (filtered.length <= 1) {
    console.log(`      ⚠️  Too few items after extreme outlier removal, returning remaining items`);
    return filtered;
  }
  
  // LAYER 2: DYNAMIC RATIO FILTERING
  console.log(`\n   📈 Layer 2: Dynamic Ratio Filtering`);
  const beforeLayer2 = filtered.length;
  filtered = dynamicRatioFiltering(filtered);
  console.log(`      Result: ${beforeLayer2} → ${filtered.length} items (removed ${beforeLayer2 - filtered.length} via dynamic ratios)`);
  
  if (filtered.length <= 2) {
    console.log(`      ⚠️  Too few items after dynamic filtering, returning remaining items`);
    return filtered;
  }
  
  // LAYER 3: CLUSTERING-BASED SEPARATION
  console.log(`\n   🔍 Layer 3: Clustering-Based Separation`);
  const beforeLayer3 = filtered.length;
  filtered = clusterBasedOutliers(filtered);
  console.log(`      Result: ${beforeLayer3} → ${filtered.length} items (removed ${beforeLayer3 - filtered.length} via clustering)`);
  
  if (filtered.length <= 2) {
    console.log(`      ⚠️  Too few items after clustering, returning remaining items`);
    return filtered;
  }
  
  // LAYER 4: ENHANCED IQR
  console.log(`\n   📉 Layer 4: Enhanced IQR (Stricter)`);
  const beforeLayer4 = filtered.length;
  filtered = enhancedIQRFiltering(filtered);
  console.log(`      Result: ${beforeLayer4} → ${filtered.length} items (removed ${beforeLayer4 - filtered.length} via enhanced IQR)`);
  
  // LAYER 5: PERCENTILE TRIMMING (if enough items)
  if (filtered.length > 10) {
    console.log(`\n   ✂️  Layer 5: Percentile Trimming (5% from each end)`);
    const beforeLayer5 = filtered.length;
    filtered = percentileTrimming(filtered, 0.05, 0.95);
    console.log(`      Result: ${beforeLayer5} → ${filtered.length} items (removed ${beforeLayer5 - filtered.length} via percentile trimming)`);
  }
  
  console.log(`\n   🎯 COMPREHENSIVE FILTERING COMPLETE:`);
  console.log(`      Original: ${originalCount} items`);
  console.log(`      Final: ${filtered.length} items`);
  console.log(`      Removed: ${originalCount - filtered.length} outliers (${((originalCount - filtered.length) / originalCount * 100).toFixed(1)}%)`);
  
  return filtered;
}

/**
 * LAYER 2: Dynamic Ratio Filtering
 */
function dynamicRatioFiltering(prices) {
  const sorted = [...prices].sort((a, b) => a - b);
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const priceRange = p75 / p25;
  const median = calculateMedian(prices);
  
  let maxRatio, minRatio, category;
  
  if (priceRange < 1.5) {
    // VERY TIGHT (luxury items, specific models)
    maxRatio = 2; minRatio = 0.5;
    category = "very_tight";
  } else if (priceRange < 3) {
    // TIGHT (specific products)
    maxRatio = 3; minRatio = 0.33;
    category = "tight";
  } else if (priceRange < 6) {
    // MEDIUM (product category)
    maxRatio = 5; minRatio = 0.2;
    category = "medium";
  } else if (priceRange < 15) {
    // WIDE (mixed products)
    maxRatio = 8; minRatio = 0.125;
    category = "wide";
  } else {
    // VERY WIDE (everything mixed)
    maxRatio = 10; minRatio = 0.1;
    category = "very_wide";
  }
  
  console.log(`      Price spread: ${priceRange.toFixed(2)}x (${category}) → Filter: ${minRatio}x - ${maxRatio}x median`);
  
  const minPrice = median * minRatio;
  const maxPrice = median * maxRatio;
  
  const filtered = prices.filter(price => price >= minPrice && price <= maxPrice);
  const removed = prices.filter(price => price < minPrice || price > maxPrice);
  
  if (removed.length > 0) {
    console.log(`      Removed: $${removed.map(p => p.toFixed(2)).join(', $')}`);
  }
  
  return filtered;
}

/**
 * LAYER 3: Clustering-Based Outlier Detection
 */
function clusterBasedOutliers(prices) {
  if (prices.length <= 3) return prices;
  
  const sorted = [...prices].sort((a, b) => a - b);
  
  // Find the biggest ratio gap in prices
  let maxGap = 0;
  let splitIndex = 0;
  
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] / sorted[i-1]; // Ratio gap
    if (gap > maxGap) {
      maxGap = gap;
      splitIndex = i;
    }
  }
  
  console.log(`      Largest price gap: ${maxGap.toFixed(2)}x between $${sorted[splitIndex-1]} and $${sorted[splitIndex]}`);
  
  // If there's a significant gap (>4x), take the larger cluster
  if (maxGap > 4) {
    const lowerCluster = sorted.slice(0, splitIndex);
    const upperCluster = sorted.slice(splitIndex);
    
    console.log(`      Found clusters: Lower (${lowerCluster.length} items), Upper (${upperCluster.length} items)`);
    
    // Take the larger cluster (more representative)
    const selectedCluster = upperCluster.length >= lowerCluster.length ? upperCluster : lowerCluster;
    console.log(`      Selected ${selectedCluster === upperCluster ? 'upper' : 'lower'} cluster with ${selectedCluster.length} items`);
    
    return selectedCluster;
  }
  
  console.log(`      No significant clustering detected (gap ${maxGap.toFixed(2)}x < 4x)`);
  return prices;
}

/**
 * LAYER 4: Enhanced IQR Filtering
 */
function enhancedIQRFiltering(prices) {
  if (prices.length <= 3) return prices;
  
  const sorted = [...prices].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  // Use 1.0 multiplier instead of 1.5 for stricter filtering
  const multiplier = 1.0;
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;
  
  console.log(`      IQR: Q1=$${q1}, Q3=$${q3}, IQR=$${iqr.toFixed(2)}`);
  console.log(`      Bounds (${multiplier}x): $${lowerBound.toFixed(2)} - $${upperBound.toFixed(2)}`);
  
  const filtered = prices.filter(price => price >= lowerBound && price <= upperBound);
  const removed = prices.filter(price => price < lowerBound || price > upperBound);
  
  if (removed.length > 0) {
    console.log(`      Removed: $${removed.map(p => p.toFixed(2)).join(', $')}`);
  }
  
  return filtered;
}

/**
 * LAYER 5: Percentile Trimming
 */
function percentileTrimming(prices, lowerPercentile, upperPercentile) {
  const sorted = [...prices].sort((a, b) => a - b);
  const startIndex = Math.floor(sorted.length * lowerPercentile);
  const endIndex = Math.ceil(sorted.length * upperPercentile);
  
  console.log(`      Trimming ${(lowerPercentile*100)}% - ${(upperPercentile*100)}%: indices ${startIndex} to ${endIndex-1}`);
  
  return sorted.slice(startIndex, endIndex);
}

/**
 * STAGE 5: FINAL CALCULATION - ENHANCED (ALWAYS CALCULATES)
 * Calculate price statistics and recommendation even with limited data
 */
function calculateFinalPriceStage5(stage4Result) {
  console.log(`\n🔄 STAGE 5: ENHANCED FINAL CALCULATION`);
  console.log(`   Calculating from ${stage4Result.items.length} clean items`);
  
  // ALWAYS calculate, even with minimal data
  if (stage4Result.items.length === 0) {
    console.log(`   ❌ No items available - cannot calculate price`);
    return {
      success: false,
      stage: 5,
      error: 'No items available for price calculation',
      searchTerm: stage4Result.searchTerm,
      condition: stage4Result.condition
    };
  }
  
  const prices = stage4Result.items.map(item => item.price);
  
  // Enhanced calculation that works with any number of items
  const calculation = calculateEnhancedPriceRecommendation(prices, stage4Result.items.length);
  
  console.log(`   📊 Stage 5 Results:`);
  console.log(`      - Recommended Bid: $${calculation.recommendedBid}`);
  console.log(`      - Price Range: $${calculation.priceRange.min} - $${calculation.priceRange.max}`);
  console.log(`      - Average: $${calculation.averagePrice}`);
  console.log(`      - Median: $${calculation.medianPrice}`);
  console.log(`      - Confidence: ${calculation.confidence}`);
  console.log(`   ✅ Stage 5 Complete: Price calculation finished with ${calculation.confidence} confidence`);
  
  return {
    success: true,
    stage: 5,
    calculation,
    items: stage4Result.items,
    searchTerm: stage4Result.searchTerm,
    condition: stage4Result.condition
  };
}

/**
 * Enhanced Price Recommendation - Always calculates regardless of sample size
 */
function calculateEnhancedPriceRecommendation(prices, itemCount) {
  // Basic statistics
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  
  // Sort for median
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
  
  // Enhanced recommendation logic based on sample size and distribution
  let recommendedBid, confidence, reasoning;
  
  if (prices.length === 1) {
    // Single item - be conservative
    recommendedBid = parseFloat((prices[0] * 0.85).toFixed(2));
    confidence = "low";
    reasoning = `Based on single item analysis. Recommending 85% of the found price ($${prices[0].toFixed(2)}) for competitive bidding.`;
    
  } else if (prices.length <= 3) {
    // Few items - use average with conservative discount
    recommendedBid = parseFloat((avg * 0.88).toFixed(2));
    confidence = "medium-low";
    reasoning = `Based on ${prices.length} items with limited data. Recommending 88% of average price ($${avg.toFixed(2)}) for competitive bidding.`;
    
  } else if (prices.length <= 7) {
    // Medium sample - blend median and average
    const blended = (median * 0.7) + (avg * 0.3);
    recommendedBid = parseFloat((blended * 0.90).toFixed(2));
    confidence = "medium";
    reasoning = `Based on ${prices.length} items. Recommending 90% of blended price (70% median + 30% average) for competitive bidding.`;
    
  } else {
    // Good sample size - use median with standard discount
    recommendedBid = parseFloat((median * 0.92).toFixed(2));
    confidence = "high";
    reasoning = `Based on robust analysis of ${prices.length} items. Recommending 92% of median price for competitive bidding.`;
  }
  
  // Price variance analysis for additional context
  const variance = max / min;
  let varianceNote = "";
  
  if (variance > 5) {
    varianceNote = " Note: High price variance detected - consider going through the items yourself to estimate the item's value.";
    confidence = confidence === "high" ? "medium-high" : confidence;
  } else if (variance < 1.5) {
    varianceNote = " Note: Very consistent pricing found - high confidence in recommendation.";
    confidence = confidence === "low" ? "medium-low" : confidence;
  }
  
  return {
    recommendedBid,
    reasoning: reasoning + varianceNote,
    confidence,
    priceRange: { 
      min: parseFloat(min.toFixed(2)), 
      max: parseFloat(max.toFixed(2)) 
    },
    averagePrice: parseFloat(avg.toFixed(2)),
    medianPrice: parseFloat(median.toFixed(2)),
    cleanedPrices: prices.map(p => parseFloat(p.toFixed(2))),
    itemCount,
    priceVariance: parseFloat(variance.toFixed(2)),
    sampleQuality: confidence
  };
}

/**
 * Helper function to calculate median
 */
function calculateMedian(prices) {
  const sorted = [...prices].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  } else {
    return sorted[middle];
  }
}

/**
 * Clean price data by removing outliers using IQR method (Legacy function for compatibility)
 */
function cleanPriceOutliers(prices) {
  // Use the new comprehensive method
  return comprehensiveHybridOutlierRemoval(prices);
}

module.exports = {
  scrapeEbayStage1,
  filterItemsStage2,
  removeOutliersStage4,
  calculateFinalPriceStage5,
  cleanPriceOutliers,
  // Keep the old method for backwards compatibility
  scrapeEbay: async (searchTerm, condition) => {
    const stage1 = await scrapeEbayStage1(searchTerm, condition);
    if (!stage1.success) return [];
    
    const stage2 = filterItemsStage2(stage1);
    return stage2.items;
  }
}; 