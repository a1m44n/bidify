const Cache = require('../models/cacheModel');
const crypto = require('crypto');

/**
 * Cache Service for MongoDB-based caching
 * Supports different cache types with configurable TTL
 */

// Default TTL values in hours
const DEFAULT_TTL = {
  price_suggestion: 24,    // 24 hours for final price suggestions
  ebay_scrape: 6,         // 6 hours for eBay data
  ai_analysis: 12,        // 12 hours for AI analysis results
  processed_items: 8      // 8 hours for processed item data
};

/**
 * Generate a consistent cache key
 */
function generateCacheKey(type, params) {
  const keyData = {
    type,
    ...params
  };
  
  // Sort keys for consistent hashing
  const sortedParams = Object.keys(keyData)
    .sort()
    .reduce((result, key) => {
      result[key] = keyData[key];
      return result;
    }, {});
  
  const keyString = JSON.stringify(sortedParams);
  return crypto.createHash('md5').update(keyString).digest('hex');
}

/**
 * Get data from cache
 */
async function get(cacheType, params) {
  try {
    const key = generateCacheKey(cacheType, params);
    
    console.log(`🔍 Cache GET: ${cacheType} - Key: ${key.substring(0, 8)}...`);
    
    const cacheEntry = await Cache.findOne({ 
      key, 
      cacheType,
      expiresAt: { $gt: new Date() } // Only non-expired entries
    });
    
    if (cacheEntry) {
      console.log(`✅ Cache HIT: ${cacheType} - Age: ${Math.round((Date.now() - cacheEntry.createdAt) / 1000 / 60)} minutes`);
      
      // Increment hit count asynchronously
      cacheEntry.incrementHit().catch(err => 
        console.error('Cache hit count update failed:', err)
      );
      
      return cacheEntry.data;
    }
    
    console.log(`❌ Cache MISS: ${cacheType}`);
    return null;
    
  } catch (error) {
    console.error(`💥 Cache GET error for ${cacheType}:`, error);
    return null; // Fail gracefully
  }
}

/**
 * Set data in cache
 */
async function set(cacheType, params, data, customTTLHours = null) {
  try {
    const key = generateCacheKey(cacheType, params);
    const ttlHours = customTTLHours || DEFAULT_TTL[cacheType] || 24;
    const expiresAt = new Date(Date.now() + (ttlHours * 60 * 60 * 1000));
    
    console.log(`💾 Cache SET: ${cacheType} - TTL: ${ttlHours}h - Key: ${key.substring(0, 8)}...`);
    
    // Calculate data size for monitoring
    const dataSize = JSON.stringify(data).length;
    
    // Create metadata from params
    const metadata = {
      dataSize,
      hitCount: 0,
      ...extractMetadata(params)
    };
    
    // Use upsert to update if exists, create if not
    const result = await Cache.findOneAndUpdate(
      { key, cacheType },
      {
        key,
        data,
        cacheType,
        expiresAt,
        metadata
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );
    
    console.log(`✅ Cache SET complete: ${cacheType} - Size: ${(dataSize / 1024).toFixed(2)}KB`);
    return result;
    
  } catch (error) {
    console.error(`💥 Cache SET error for ${cacheType}:`, error);
    // Don't throw - cache failures shouldn't break the main flow
    return null;
  }
}

/**
 * Delete from cache
 */
async function del(cacheType, params) {
  try {
    const key = generateCacheKey(cacheType, params);
    
    console.log(`🗑️ Cache DELETE: ${cacheType} - Key: ${key.substring(0, 8)}...`);
    
    const result = await Cache.deleteOne({ key, cacheType });
    
    if (result.deletedCount > 0) {
      console.log(`✅ Cache DELETE success: ${cacheType}`);
      return true;
    } else {
      console.log(`⚠️ Cache DELETE: Entry not found for ${cacheType}`);
      return false;
    }
    
  } catch (error) {
    console.error(`💥 Cache DELETE error for ${cacheType}:`, error);
    return false;
  }
}

/**
 * Clear all cache entries of a specific type
 */
async function clearByType(cacheType) {
  try {
    console.log(`🧹 Cache CLEAR ALL: ${cacheType}`);
    
    const result = await Cache.deleteMany({ cacheType });
    
    console.log(`✅ Cache CLEAR complete: Removed ${result.deletedCount} entries of type ${cacheType}`);
    return result.deletedCount;
    
  } catch (error) {
    console.error(`💥 Cache CLEAR error for ${cacheType}:`, error);
    return 0;
  }
}

/**
 * Get cache statistics
 */
async function getStats() {
  try {
    const stats = await Cache.getStats();
    const totalEntries = await Cache.countDocuments();
    const expiredEntries = await Cache.countDocuments({ expiresAt: { $lt: new Date() } });
    
    return {
      totalEntries,
      expiredEntries,
      activeEntries: totalEntries - expiredEntries,
      byType: stats,
      generated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('💥 Cache STATS error:', error);
    return null;
  }
}

/**
 * Manual cleanup of expired entries
 */
async function cleanup() {
  try {
    console.log('🧹 Running manual cache cleanup...');
    
    const result = await Cache.cleanupExpired();
    
    console.log(`✅ Cache cleanup complete: Removed ${result.deletedCount} expired entries`);
    return result.deletedCount;
    
  } catch (error) {
    console.error('💥 Cache cleanup error:', error);
    return 0;
  }
}

/**
 * Extract metadata from cache parameters
 */
function extractMetadata(params) {
  const metadata = {};
  
  // Extract common fields
  if (params.productTitle) metadata.productTitle = params.productTitle;
  if (params.category) metadata.category = params.category;
  if (params.condition) metadata.condition = params.condition;
  if (params.useAI !== undefined) metadata.useAI = params.useAI;
  
  return metadata;
}

/**
 * Convenience methods for different cache types
 */
const cache = {
  // Price suggestion cache
  priceSuggestion: {
    get: (productTitle, category, condition, useAI) => 
      get('price_suggestion', { productTitle, category, condition, useAI }),
    set: (productTitle, category, condition, useAI, data, ttlHours) => 
      set('price_suggestion', { productTitle, category, condition, useAI }, data, ttlHours),
    del: (productTitle, category, condition, useAI) => 
      del('price_suggestion', { productTitle, category, condition, useAI })
  },
  
  // eBay scrape cache
  ebayScrape: {
    get: (searchTerm, condition) => 
      get('ebay_scrape', { searchTerm, condition }),
    set: (searchTerm, condition, data, ttlHours) => 
      set('ebay_scrape', { searchTerm, condition }, data, ttlHours),
    del: (searchTerm, condition) => 
      del('ebay_scrape', { searchTerm, condition })
  },
  
  // AI analysis cache
  aiAnalysis: {
    get: (searchTerm, condition, itemsHash) => 
      get('ai_analysis', { searchTerm, condition, itemsHash }),
    set: (searchTerm, condition, itemsHash, data, ttlHours) => 
      set('ai_analysis', { searchTerm, condition, itemsHash }, data, ttlHours),
    del: (searchTerm, condition, itemsHash) => 
      del('ai_analysis', { searchTerm, condition, itemsHash })
  },
  
  // Processed items cache
  processedItems: {
    get: (searchTerm, condition, useAI) => 
      get('processed_items', { searchTerm, condition, useAI }),
    set: (searchTerm, condition, useAI, data, ttlHours) => 
      set('processed_items', { searchTerm, condition, useAI }, data, ttlHours),
    del: (searchTerm, condition, useAI) => 
      del('processed_items', { searchTerm, condition, useAI })
  }
};

module.exports = {
  // Core methods
  get,
  set,
  del,
  clearByType,
  getStats,
  cleanup,
  generateCacheKey,
  
  // Convenience methods
  cache,
  
  // Constants
  DEFAULT_TTL
}; 