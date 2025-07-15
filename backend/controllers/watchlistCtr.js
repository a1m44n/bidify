const Watchlist = require('../models/watchlistModel');
const Product = require('../models/productModels');
const BiddingProduct = require('../models/biddingModel');
const asyncHandler = require('express-async-handler');

// Add product to watchlist
const addToWatchlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Check if user is trying to add their own product to watchlist
  if (product.user.toString() === userId.toString()) {
    res.status(400);
    throw new Error('You cannot add your own products to your watchlist');
  }

  // Check if already in watchlist
  const existingWatchlistItem = await Watchlist.findOne({ userId, productId });
  if (existingWatchlistItem) {
    res.status(400);
    throw new Error('Product already in watchlist');
  }

  // Add to watchlist
  const watchlistItem = await Watchlist.create({
    userId,
    productId
  });

  res.status(201).json({
    success: true,
    data: watchlistItem
  });
});

// Remove product from watchlist
const removeFromWatchlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  // Check if user has placed any bids on this product
  const userBid = await BiddingProduct.findOne({ 
    user: userId, 
    product: productId 
  });

  if (userBid) {
    res.status(400);
    throw new Error('Cannot remove product from watchlist - you have placed a bid on this item');
  }

  const watchlistItem = await Watchlist.findOneAndDelete({ userId, productId });

  if (!watchlistItem) {
    res.status(404);
    throw new Error('Watchlist item not found');
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});

// Get user's watchlist
const getWatchlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const watchlistItems = await Watchlist.find({ userId })
    .populate({
      path: 'productId',
      select: 'title description image price category condition isSoldOut isArchived auctionEndTime'
    })
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: watchlistItems.length,
    data: watchlistItems
  });
});

// Check if product is in user's watchlist
const checkWatchlistItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  const watchlistItem = await Watchlist.findOne({ userId, productId });

  res.status(200).json({
    success: true,
    isWatchlisted: !!watchlistItem
  });
});

module.exports = {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  checkWatchlistItem
}; 