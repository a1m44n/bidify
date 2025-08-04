const Message = require('../models/messageModel');
const User = require('../models/UserModels');
const telegramBot = require('./telegramBot');

/**
 * Service for handling notifications across different channels
 */
class NotificationService {
    /**
     * Send notification about being outbid
     * 
     * @param {object} product - Product details
     * @param {string} userId - Current bidder's user ID
     * @param {string} recipientId - Previous highest bidder's user ID
     * @param {number} price - New bid price 
     * @param {object} bidder - Current bidder's user object
     */
    async sendOutbidNotification(product, userId, recipientId, price, bidder) {
        try {
            // Create message for internal notifications
            const message = await Message.create({
                productId: product._id,
                productTitle: product.title,
                sender: userId, // Current bidder is the sender
                recipient: recipientId, // Previous highest bidder is the recipient
                messageType: 'AUCTION_OUTBID',
                message: `You have been outbid on "${product.title}". The new highest bid is $${price} by @${bidder.username}.`
            });

            // Check if recipient has Telegram notifications enabled
            const recipient = await User.findById(recipientId);
            
            console.log(`📱 Checking telegram settings for outbid notification to user ${recipientId}:`, {
                hasRecipient: !!recipient,
                username: recipient?.username,
                telegramChatId: recipient?.telegramChatId ? '***SET***' : 'NOT SET',
                telegramEnabled: recipient?.notificationPreferences?.telegram?.enabled,
                notifyOnOutbid: recipient?.notificationPreferences?.telegram?.notifyOnOutbid,
                fullPrefs: recipient?.notificationPreferences
            });
            
            if (recipient && 
                recipient.telegramChatId && 
                recipient.notificationPreferences?.telegram?.enabled &&
                recipient.notificationPreferences?.telegram?.notifyOnOutbid) {
                
                try {
                    console.log(`🚀 Sending telegram outbid notification to user ${recipientId}`);
                    
                    // Send Telegram notification
                    const telegramMessage = telegramBot.createOutbidMessage(product, price, bidder.username);
                    const result = await telegramBot.sendMessage(recipient.telegramChatId, telegramMessage);
                    
                    if (result.success) {
                        console.log(`✅ Telegram outbid notification sent successfully to user ${recipientId}`);
                    } else {
                        console.warn(`⚠️ Failed to send telegram outbid notification to user ${recipientId}:`, result.error);
                    }
                } catch (telegramError) {
                    console.error(`❌ Error sending telegram outbid notification to user ${recipientId}:`, telegramError.message);
                    // Don't throw - allow the bidding process to continue
                }
            } else {
                console.log(`🚫 Telegram outbid notification NOT sent to user ${recipientId}. Reason:`, {
                    hasRecipient: !!recipient,
                    hasChatId: !!recipient?.telegramChatId,
                    telegramEnabled: recipient?.notificationPreferences?.telegram?.enabled,
                    notifyOnOutbid: recipient?.notificationPreferences?.telegram?.notifyOnOutbid
                });
            }

            return message;
        } catch (error) {
            console.error('Error sending outbid notification:', error);
            throw error;
        }
    }

    /**
     * Send notification about being outbid by auto-bid system
     * 
     * @param {object} product - Product details
     * @param {string} autoBidUserId - Auto-bidder's user ID
     * @param {string} recipientId - Previous highest bidder's user ID
     * @param {number} price - New auto-bid price 
     * @param {object} autoBidder - Auto-bidder's user object
     */
    async sendAutoBidOutbidNotification(product, autoBidUserId, recipientId, price, autoBidder) {
        try {
            // Create message for internal notifications
            const message = await Message.create({
                productId: product._id,
                productTitle: product.title,
                sender: autoBidUserId, // Auto-bidder is the sender
                recipient: recipientId, // Previous highest bidder is the recipient
                messageType: 'AUCTION_AUTO_OUTBID',
                message: `You have been outbid on "${product.title}" by an auto-bidder. The new highest bid is $${price} by @${autoBidder.username}.`
            });

            // Check if recipient has Telegram notifications enabled
            const recipient = await User.findById(recipientId);
            
            if (recipient && 
                recipient.telegramChatId && 
                recipient.notificationPreferences?.telegram?.enabled &&
                recipient.notificationPreferences?.telegram?.notifyOnOutbid) {
                
                try {
                    // Send Telegram notification
                    const telegramMessage = telegramBot.createAutoBidOutbidMessage(product, price, autoBidder.username);
                    const result = await telegramBot.sendMessage(recipient.telegramChatId, telegramMessage);
                    
                    if (!result.success) {
                        console.warn(`Failed to send telegram auto-bid outbid notification to user ${recipientId}:`, result.error);
                    }
                } catch (telegramError) {
                    console.error(`Error sending telegram auto-bid outbid notification to user ${recipientId}:`, telegramError.message);
                    // Don't throw - allow the bidding process to continue
                }
            }

            return message;
        } catch (error) {
            console.error('Error sending auto-bid outbid notification:', error);
            throw error;
        }
    }

    /**
     * Send notification when someone exceeds auto-bid maximum
     * 
     * @param {object} product - Product details
     * @param {string} autoBidOwnerId - Auto-bid owner's user ID
     * @param {number} newBidPrice - The bid that exceeded the maximum
     * @param {number} maxBidAmount - The auto-bid maximum amount
     * @param {object} bidder - User who placed the exceeding bid
     */
    async sendMaxBidExceededNotification(product, autoBidOwnerId, newBidPrice, maxBidAmount, bidder) {
        try {
            // Create message for internal notifications
            const message = await Message.create({
                productId: product._id,
                productTitle: product.title,
                sender: bidder._id, // Current bidder is the sender
                recipient: autoBidOwnerId, // Auto-bid owner is the recipient
                messageType: 'AUTO_BID_MAX_EXCEEDED',
                message: `Someone bid $${newBidPrice} on "${product.title}", exceeding your maximum auto-bid of $${maxBidAmount}. Manual action required!`
            });

            // Check if recipient has Telegram notifications enabled
            const recipient = await User.findById(autoBidOwnerId);
            
            if (recipient && 
                recipient.telegramChatId && 
                recipient.notificationPreferences?.telegram?.enabled &&
                recipient.notificationPreferences?.telegram?.notifyOnOutbid) {
                
                try {
                    // Send Telegram notification
                    const telegramMessage = telegramBot.createMaxBidExceededMessage(product, newBidPrice, maxBidAmount, bidder.username);
                    const result = await telegramBot.sendMessage(recipient.telegramChatId, telegramMessage);
                    
                    if (!result.success) {
                        console.warn(`Failed to send telegram max bid exceeded notification to user ${autoBidOwnerId}:`, result.error);
                    }
                } catch (telegramError) {
                    console.error(`Error sending telegram max bid exceeded notification to user ${autoBidOwnerId}:`, telegramError.message);
                    // Don't throw - allow the bidding process to continue
                }
            }

            return message;
        } catch (error) {
            console.error('Error sending max bid exceeded notification:', error);
            throw error;
        }
    }

    /**
     * Send notification to auto-bid owner when their system responds
     * 
     * @param {object} product - Product details
     * @param {string} autoBidOwnerId - Auto-bid owner's user ID
     * @param {number} autoBidPrice - The auto-bid price that was placed
     * @param {object} autoBidder - Auto-bidder's user object
     */
    async sendAutoBidResponseNotification(product, autoBidOwnerId, autoBidPrice, autoBidder) {
        try {
            // Create message for internal notifications
            const message = await Message.create({
                productId: product._id,
                productTitle: product.title,
                sender: autoBidOwnerId, // Auto-bid owner is both sender and recipient
                recipient: autoBidOwnerId,
                messageType: 'AUTO_BID_RESPONSE',
                message: `Your auto-bid system automatically placed a bid of $${autoBidPrice} on "${product.title}". You are now the highest bidder!`
            });

            // Check if recipient has Telegram notifications enabled
            const recipient = await User.findById(autoBidOwnerId);
            
            if (recipient && 
                recipient.telegramChatId && 
                recipient.notificationPreferences?.telegram?.enabled &&
                recipient.notificationPreferences?.telegram?.notifyOnOutbid) {
                
                try {
                    // Send Telegram notification
                    const telegramMessage = telegramBot.createAutoBidResponseMessage(product, autoBidPrice);
                    const result = await telegramBot.sendMessage(recipient.telegramChatId, telegramMessage);
                    
                    if (!result.success) {
                        console.warn(`Failed to send telegram auto-bid response notification to user ${autoBidOwnerId}:`, result.error);
                    }
                } catch (telegramError) {
                    console.error(`Error sending telegram auto-bid response notification to user ${autoBidOwnerId}:`, telegramError.message);
                    // Don't throw - allow the bidding process to continue
                }
            }

            return message;
        } catch (error) {
            console.error('Error sending auto-bid response notification:', error);
            throw error;
        }
    }

    /**
     * Send notification about winning an auction
     * 
     * @param {object} product - Product details
     * @param {string} recipientId - Winner's user ID
     * @param {number} winningBid - Winning bid amount
     */
    async sendAuctionWinNotification(product, recipientId, winningBid) {
        try {
            console.log(`🏆 Attempting to send auction win notification to user ${recipientId} for product "${product.title}"`);
            
            // Check for existing win notification to prevent duplicates
            const existingWinNotification = await Message.findOne({
                productId: product._id,
                recipient: recipientId,
                messageType: 'AUCTION_WIN'
            });

            if (existingWinNotification) {
                console.log(`⚠️ Auction win notification already exists for user ${recipientId} and product ${product._id}. Skipping duplicate.`);
                return existingWinNotification;
            }

            console.log(`✅ No existing win notification found. Proceeding to send notification.`);
            
            // Create message for internal notifications
            const message = await Message.create({
                productId: product._id,
                productTitle: product.title,
                sender: product.user, // Seller is the sender
                recipient: recipientId, // Winner is the recipient
                messageType: 'AUCTION_WIN',
                message: `Congratulations! You won the auction for "${product.title}" with a bid of $${winningBid}.`,
                winningBid
            });

            console.log(`✅ Internal auction win message created for user ${recipientId} for product ${product._id}`);

            // Check if recipient has Telegram notifications enabled
            const recipient = await User.findById(recipientId);
            
            if (!recipient) {
                console.log(`❌ Recipient ${recipientId} not found in database`);
                return message;
            }

            console.log(`📱 Checking telegram settings for user ${recipientId}:`, {
                telegramChatId: recipient.telegramChatId ? '***set***' : 'NOT SET',
                telegramEnabled: recipient.notificationPreferences?.telegram?.enabled,
                notifyOnWin: recipient.notificationPreferences?.telegram?.notifyOnWin,
                fullPrefs: recipient.notificationPreferences
            });
            
            if (recipient && 
                recipient.telegramChatId && 
                recipient.notificationPreferences?.telegram?.enabled &&
                recipient.notificationPreferences?.telegram?.notifyOnWin) {
                
                try {
                    console.log(`🚀 Sending telegram auction win notification to user ${recipientId}`);
                    
                    // Fetch seller information for contact details
                    const seller = await User.findById(product.user, "username telegramHandle");
                    
                    // Send Telegram notification
                    const telegramMessage = telegramBot.createAuctionWinMessage(product, winningBid, seller);
                    const result = await telegramBot.sendMessage(recipient.telegramChatId, telegramMessage);
                    
                    if (result.success) {
                        console.log(`✅ Telegram auction win notification sent successfully to user ${recipientId}`);
                    } else {
                        console.warn(`⚠️ Failed to send telegram win notification to user ${recipientId}:`, result.error);
                    }
                } catch (telegramError) {
                    console.error(`❌ Error sending telegram win notification to user ${recipientId}:`, telegramError.message);
                    // Don't throw - allow the auction completion process to continue
                }
            } else {
                console.log(`🚫 Telegram win notification NOT sent to user ${recipientId}. Reason:`, {
                    hasRecipient: !!recipient,
                    hasChatId: !!recipient?.telegramChatId,
                    telegramEnabled: recipient?.notificationPreferences?.telegram?.enabled,
                    notifyOnWin: recipient?.notificationPreferences?.telegram?.notifyOnWin
                });
            }

            return message;
        } catch (error) {
            console.error('Error sending auction win notification:', error);
            throw error;
        }
    }

    /**
     * Send notification about auction ending
     * 
     * @param {object} product - Product details
     * @param {string} recipientId - User ID to notify
     * @param {object} winner - Winner details (optional)
     * @param {number} finalPrice - Final selling price (optional)
     */
    async sendAuctionEndNotification(product, recipientId, winner = null, finalPrice = null) {
        try {
            console.log(`🏁 Attempting to send auction end notification to user ${recipientId} for product "${product.title}"`);
            
            // Check for existing auction end notification to prevent duplicates
            const existingEndNotification = await Message.findOne({
                productId: product._id,
                recipient: recipientId,
                messageType: 'AUCTION_END'
            });

            if (existingEndNotification) {
                console.log(`⚠️ Auction end notification already exists for user ${recipientId} and product ${product._id}. Skipping duplicate.`);
                return existingEndNotification;
            }

            console.log(`✅ No existing auction end notification found. Proceeding to send notification.`);

            // Create appropriate message based on whether there was a winner
            let internalMessage;
            if (winner && finalPrice) {
                internalMessage = `The auction for "${product.title}" has ended. Winner: ${winner.username} with a bid of $${finalPrice}.`;
            } else {
                internalMessage = `The auction for "${product.title}" has ended with no bids.`;
            }

            // Create message for internal notifications
            const message = await Message.create({
                productId: product._id,
                productTitle: product.title,
                sender: product.user, // Seller is the sender
                recipient: recipientId,
                messageType: 'AUCTION_END',
                message: internalMessage
            });

            console.log(`✅ Internal auction end message created for user ${recipientId} for product ${product._id}`);

            // Check if recipient has Telegram notifications enabled
            const recipient = await User.findById(recipientId);
            
            if (recipient && 
                recipient.telegramChatId && 
                recipient.notificationPreferences?.telegram?.enabled &&
                recipient.notificationPreferences?.telegram?.notifyOnAuctionEnd) {
                
                try {
                    // Send Telegram notification with winner information
                    const telegramMessage = telegramBot.createAuctionEndMessage(product, winner, finalPrice);
                    const result = await telegramBot.sendMessage(recipient.telegramChatId, telegramMessage);
                    
                    if (!result.success) {
                        console.warn(`Failed to send telegram auction end notification to user ${recipientId}:`, result.error);
                    }
                } catch (telegramError) {
                    console.error(`Error sending telegram auction end notification to user ${recipientId}:`, telegramError.message);
                    // Don't throw - allow the auction process to continue
                }
            }

            return message;
        } catch (error) {
            console.error('Error sending auction end notification:', error);
            throw error;
        }
    }
}

module.exports = new NotificationService(); 