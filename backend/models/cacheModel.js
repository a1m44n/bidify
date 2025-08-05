const mongoose = require('mongoose');

const cacheSchema = mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  cacheType: {
    type: String,
    required: true,
    enum: ['price_suggestion', 'ebay_scrape', 'ai_analysis', 'processed_items'],
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index for automatic cleanup
  },
  metadata: {
    productTitle: String,
    category: String,
    condition: String,
    useAI: Boolean,
    dataSize: Number,
    hitCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound index for faster lookups
cacheSchema.index({ cacheType: 1, key: 1 });
cacheSchema.index({ 'metadata.productTitle': 1, 'metadata.condition': 1 });

// Update hit count when cache is accessed
cacheSchema.methods.incrementHit = function() {
  this.metadata.hitCount += 1;
  return this.save();
};

// Static method to clean up expired entries manually (backup to TTL)
cacheSchema.statics.cleanupExpired = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to get cache statistics
cacheSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$cacheType',
        count: { $sum: 1 },
        totalHits: { $sum: '$metadata.hitCount' },
        avgDataSize: { $avg: '$metadata.dataSize' },
        oldestEntry: { $min: '$createdAt' },
        newestEntry: { $max: '$createdAt' }
      }
    }
  ]);
};

const Cache = mongoose.model('Cache', cacheSchema);
module.exports = Cache; 