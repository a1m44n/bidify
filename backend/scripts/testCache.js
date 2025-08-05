const mongoose = require('mongoose');
const dotenv = require('dotenv').config();
const cacheService = require('../services/cacheService');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.DATABASE_CLOUD, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Test cache functionality
async function testCache() {
  console.log('\n🧪 TESTING CACHE FUNCTIONALITY\n');
  
  try {
    // Test 1: Basic cache operations
    console.log('📋 Test 1: Basic Cache Operations');
    console.log('--------------------------------');
    
    const testData = {
      recommendedBid: 45.99,
      reasoning: "Test price suggestion",
      confidence: "high",
      processingTime: 2500,
      generatedAt: new Date().toISOString()
    };
    
    // Set cache
    console.log('Setting cache...');
    await cacheService.cache.priceSuggestion.set(
      'iPhone 12 Pro Max',
      'Electronics',
      'used',
      true,
      testData
    );
    
    // Get cache
    console.log('Getting cache...');
    const cachedData = await cacheService.cache.priceSuggestion.get(
      'iPhone 12 Pro Max',
      'Electronics',
      'used',
      true
    );
    
    if (cachedData && cachedData.recommendedBid === testData.recommendedBid) {
      console.log('✅ Cache SET/GET test passed');
    } else {
      console.log('❌ Cache SET/GET test failed');
    }
    
    // Test 2: Cache statistics
    console.log('\n📊 Test 2: Cache Statistics');
    console.log('----------------------------');
    
    const stats = await cacheService.getStats();
    console.log('Cache Stats:', JSON.stringify(stats, null, 2));
    
    // Test 3: Cache key generation
    console.log('\n🔑 Test 3: Cache Key Generation');
    console.log('--------------------------------');
    
    const key1 = cacheService.generateCacheKey('price_suggestion', {
      productTitle: 'iPhone 12',
      category: 'Electronics',
      condition: 'used',
      useAI: true
    });
    
    const key2 = cacheService.generateCacheKey('price_suggestion', {
      useAI: true,
      condition: 'used',
      productTitle: 'iPhone 12',
      category: 'Electronics'
    });
    
    if (key1 === key2) {
      console.log('✅ Cache key consistency test passed');
      console.log(`   Generated key: ${key1.substring(0, 16)}...`);
    } else {
      console.log('❌ Cache key consistency test failed');
      console.log(`   Key1: ${key1}`);
      console.log(`   Key2: ${key2}`);
    }
    
    // Test 4: TTL and expiration
    console.log('\n⏱️  Test 4: TTL Configuration');
    console.log('-----------------------------');
    
    console.log('Default TTL values:');
    Object.entries(cacheService.DEFAULT_TTL).forEach(([type, hours]) => {
      console.log(`   ${type}: ${hours} hours`);
    });
    
    // Test 5: Different cache types
    console.log('\n🏷️  Test 5: Different Cache Types');
    console.log('----------------------------------');
    
    // eBay scrape cache test
    const ebayData = {
      success: true,
      items: [
        { title: 'iPhone 12 Pro Max', price: 599.99, condition: 'USED' },
        { title: 'iPhone 12 Pro Max 128GB', price: 649.99, condition: 'USED' }
      ],
      searchTerm: 'iPhone 12 Pro Max',
      condition: 'USED'
    };
    
    await cacheService.cache.ebayScrape.set('iPhone 12 Pro Max', 'used', ebayData);
    const cachedEbayData = await cacheService.cache.ebayScrape.get('iPhone 12 Pro Max', 'used');
    
    if (cachedEbayData && cachedEbayData.items.length === 2) {
      console.log('✅ eBay cache test passed');
    } else {
      console.log('❌ eBay cache test failed');
    }
    
    // AI analysis cache test
    const aiData = {
      success: true,
      items: [{ title: 'iPhone 12 Pro Max', price: 599.99 }],
      aiAnalysis: {
        method: 'ai',
        confidence: 0.85,
        relevantFound: 1
      }
    };
    
    await cacheService.cache.aiAnalysis.set('iPhone 12 Pro Max', 'used', 'abc12345', aiData);
    const cachedAiData = await cacheService.cache.aiAnalysis.get('iPhone 12 Pro Max', 'used', 'abc12345');
    
    if (cachedAiData && cachedAiData.aiAnalysis.confidence === 0.85) {
      console.log('✅ AI analysis cache test passed');
    } else {
      console.log('❌ AI analysis cache test failed');
    }
    
    // Final stats
    console.log('\n📈 Final Cache Statistics');
    console.log('-------------------------');
    const finalStats = await cacheService.getStats();
    console.log(`Total entries: ${finalStats.totalEntries}`);
    console.log(`Active entries: ${finalStats.activeEntries}`);
    
    console.log('\n🎉 Cache testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Cache test failed:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 Cache Testing Script Starting...\n');
  
  await connectDB();
  await testCache();
  
  console.log('\n✅ Cache testing complete. You can now test the price suggestion API with caching enabled.');
  console.log('\nEndpoints to test:');
  console.log('  GET /api/suggestion/price?productTitle=iPhone 12&condition=used');
  console.log('  GET /api/suggestion/cache/stats');
  console.log('  DELETE /api/suggestion/cache/clear/all');
  console.log('  POST /api/suggestion/cache/cleanup');
  
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { testCache }; 