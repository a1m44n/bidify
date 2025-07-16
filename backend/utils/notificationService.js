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
            
            if (recipient && 
                recipient.telegramChatId && 
                recipient.notificationPreferences?.telegram?.enabled &&
                recipient.notificationPreferences?.telegram?.notifyOnOutbid) {
                
                try {
                    // Send Telegram notification
                    const telegramMessage = telegramBot.createOutbidMessage(product, price, bidder.username);
                    const result = await telegramBot.sendMessage(recipient.telegramChatId, telegramMessage);
                    
                    if (!result.success) {
                        console.warn(`Failed to send telegram outbid notification to user ${recipientId}:`, result.error);
                    }
                } catch (telegramError) {
                    console.error(`Error sending telegram outbid notification to user ${recipientId}:`, telegramError.message);
                    // Don't throw - allow the bidding process to continue
                }
            }

            return message;
        } catch (error) {
            console.error('Error sending outbid notification:', error);
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
            console.log(`🏆 Sending auction win notification to user ${recipientId} for product "${product.title}"`);
            
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

            console.log(`✅ Internal auction win message created for user ${recipientId}`);

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
     */
    async sendAuctionEndNotification(product, recipientId) {
        try {
            // Create message for internal notifications
            const message = await Message.create({
                productId: product._id,
                productTitle: product.title,
                sender: product.user, // Seller is the sender
                recipient: recipientId,
                messageType: 'AUCTION_END',
                message: `The auction for "${product.title}" has ended.`
            });

            // Check if recipient has Telegram notifications enabled
            const recipient = await User.findById(recipientId);
            
            if (recipient && 
                recipient.telegramChatId && 
                recipient.notificationPreferences?.telegram?.enabled &&
                recipient.notificationPreferences?.telegram?.notifyOnAuctionEnd) {
                
                try {
                    // Send Telegram notification
                    const telegramMessage = telegramBot.createAuctionEndMessage(product);
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