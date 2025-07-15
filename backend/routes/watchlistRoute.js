const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleWare');
const {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  checkWatchlistItem
} = require('../controllers/watchlistCtr');

// All routes are protected
router.use(protect);

router.route('/')
  .get(getWatchlist);

router.route('/:productId')
  .post(addToWatchlist)
  .delete(removeFromWatchlist);

router.route('/check/:productId')
  .get(checkWatchlistItem);

module.exports = router; 