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
 * STAGE 4: OUTLIER REMOVAL
 * Remove statistical outliers (too high/low prices)
 */
function removeOutliersStage4(stage3Result) {
  console.log(`\n🔄 STAGE 4: OUTLIER REMOVAL`);
  console.log(`   Processing ${stage3Result.items.length} relevant items`);
  
  if (stage3Result.items.length <= 2) {
    console.log(`   ⚠️  Too few items for outlier removal, keeping all`);
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
  
  const prices = stage3Result.items.map(item => item.price);
  const cleanedPrices = cleanPriceOutliers(prices);
  
  // Filter items to keep only those with non-outlier prices
  const filteredItems = stage3Result.items.filter(item => 
    cleanedPrices.includes(item.price)
  );
  
  const removedCount = stage3Result.items.length - filteredItems.length;
  
  console.log(`   📊 Stage 4 Results:`);
  console.log(`      - Original price range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)}`);
  console.log(`      - Removed ${removedCount} outliers`);
  console.log(`      - Clean price range: $${Math.min(...cleanedPrices).toFixed(2)} - $${Math.max(...cleanedPrices).toFixed(2)}`);
  console.log(`   ✅ Stage 4 Complete: ${filteredItems.length} items after outlier removal`);
  
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
      originalPrices: prices,
      cleanedPrices,
      method: 'iqr'
    }
  };
}

/**
 * STAGE 5: FINAL CALCULATION
 * Calculate price statistics and recommendation
 */
function calculateFinalPriceStage5(stage4Result) {
  console.log(`\n🔄 STAGE 5: FINAL CALCULATION`);
  console.log(`   Calculating from ${stage4Result.items.length} clean items`);
  
  if (stage4Result.items.length === 0) {
    console.log(`   ❌ No items available for calculation`);
    return {
      success: false,
      stage: 5,
      error: 'No items available for price calculation',
      searchTerm: stage4Result.searchTerm,
      condition: stage4Result.condition
    };
  }
  
  const prices = stage4Result.items.map(item => item.price);
  
  // Calculate statistics
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  
  // Sort for median
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
  
  // Calculate recommended bid (90% of median price)
  const recommendedBid = parseFloat((median * 0.9).toFixed(2));
  
  const calculation = {
    recommendedBid,
    reasoning: `Based on analysis of ${prices.length} similar items, with prices ranging from $${min.toFixed(2)} to $${max.toFixed(2)}.`,
    priceRange: { min: parseFloat(min.toFixed(2)), max: parseFloat(max.toFixed(2)) },
    averagePrice: parseFloat(avg.toFixed(2)),
    medianPrice: parseFloat(median.toFixed(2)),
    cleanedPrices: prices.map(p => parseFloat(p.toFixed(2))),
    itemCount: prices.length
  };
  
  console.log(`   📊 Stage 5 Results:`);
  console.log(`      - Recommended Bid: $${calculation.recommendedBid}`);
  console.log(`      - Price Range: $${calculation.priceRange.min} - $${calculation.priceRange.max}`);
  console.log(`      - Average: $${calculation.averagePrice}`);
  console.log(`      - Median: $${calculation.medianPrice}`);
  console.log(`   ✅ Stage 5 Complete: Price calculation finished`);
  
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
 * Clean price data by removing outliers using IQR method
 */
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