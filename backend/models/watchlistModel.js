const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure a user can't watchlist the same product twice
watchlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

const Watchlist = mongoose.model('Watchlist', watchlistSchema);
module.exports = Watchlist; 