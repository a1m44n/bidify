const axios = require('axios');

/**
 * Utility for sending notifications via Telegram Bot API
 */
class TelegramBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        
        // Validate token exists and has basic format
        if (!this.token) {
            console.warn('⚠️  TELEGRAM_BOT_TOKEN is not set. Telegram notifications will be disabled.');
        } else if (!this.token.match(/^\d+:[A-Za-z0-9_-]+$/)) {
            console.warn('⚠️  TELEGRAM_BOT_TOKEN format appears invalid. Expected format: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"');
        }
        
        this.apiUrl = `https://api.telegram.org/bot${this.token}`;
    }

    /**
     * Set up webhook for the bot
     * 
     * @param {string} url - The webhook URL
     * @returns {Promise} - The response from the Telegram API
     */
    async setWebhook(url) {
        try {
            const response = await axios.post(`${this.apiUrl}/setWebhook`, {
                url: url
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error setting webhook:', error.response?.data || error.message);
            return { success: false, error: error.response?.data || error.message };
        }
    }

    /**
     * Send a message to a specific chat
     * 
     * @param {string} chatId - The Telegram chat ID to send the message to
     * @param {string} text - The message text
     * @returns {Promise} - The response from the Telegram API
     */
    async sendMessage(chatId, text, retryCount = 0) {
        const maxRetries = 10;
        const retryDelay = 2000; // 2 seconds
        
        try {
            if (!this.token) {
                console.warn('Telegram bot token not configured, skipping notification');
                return { success: false, error: 'Telegram bot token not configured' };
            }
            
            if (!chatId) {
                return { success: false, error: 'Missing chat ID' };
            }

            console.log(`📡 Attempting to send Telegram message (attempt ${retryCount + 1}/${maxRetries + 1})`);

            const response = await axios.post(`${this.apiUrl}/sendMessage`, {
                chat_id: chatId,
                text,
                parse_mode: 'HTML'
            }, {
                timeout: 30000 // 30 second timeout
            });

            console.log(`✅ Telegram message sent successfully on attempt ${retryCount + 1}`);
            return { success: true, data: response.data };
        } catch (error) {
            const isNetworkError = error.code === 'ETIMEDOUT' || 
                                 error.code === 'ECONNRESET' || 
                                 error.code === 'ENOTFOUND';
            
            console.error(`❌ Error sending Telegram message (attempt ${retryCount + 1}):`, {
                errorMessage: error.message,
                errorCode: error.code,
                responseData: error.response?.data,
                responseStatus: error.response?.status,
                isNetworkError,
                willRetry: isNetworkError && retryCount < maxRetries
            });
            
            // Retry on network errors
            if (isNetworkError && retryCount < maxRetries) {
                console.log(`⏳ Retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return this.sendMessage(chatId, text, retryCount + 1);
            }
            
            const errorMsg = error.response?.data?.description || 
                           error.response?.data || 
                           error.message || 
                           'Unknown Telegram API error';
            
            return { success: false, error: errorMsg };
        }
    }

    /**
     * Creates a message for auction outbid notification
     * 
     * @param {object} productDetails - Product details
     * @param {number} price - New bid price
     * @param {string} bidderUsername - Username of the new highest bidder
     * @returns {string} - Formatted message
     */
    createOutbidMessage(productDetails, price, bidderUsername) {
        return `🔔 <b>You've Been Outbid!</b>\n\n` +
            `You have been outbid on "${productDetails.title}".\n` +
            `New highest bid: $${price} by @${bidderUsername}`;
    }

    /**
     * Creates a message for auto-bid outbid notification
     * 
     * @param {object} productDetails - Product details
     * @param {number} price - New bid price
     * @param {string} bidderUsername - Username of the auto-bidder
     * @returns {string} - Formatted message
     */
    createAutoBidOutbidMessage(productDetails, price, bidderUsername) {
        return `🤖 <b>You Have Been Outbid by Auto-Bid!</b>\n\n` +
            `You have been outbid on "${productDetails.title}" by an auto-bidding system.\n` +
            `New highest bid: $${price} by @${bidderUsername}`;
    }

    /**
     * Creates a message for when someone exceeds auto-bid maximum
     * 
     * @param {object} productDetails - Product details
     * @param {number} newBidPrice - The bid that exceeded the max
     * @param {number} maxBidAmount - The user's maximum auto-bid amount
     * @param {string} bidderUsername - Username who placed the exceeding bid
     * @returns {string} - Formatted message
     */
    createMaxBidExceededMessage(productDetails, newBidPrice, maxBidAmount, bidderUsername) {
        return `❌ <b>Auto-Bid Maximum Exceeded!</b>\n\n` +
            `Someone bid $${newBidPrice} on "${productDetails.title}", exceeding your maximum auto-bid of $${maxBidAmount}.\n` +
            `New highest bid: $${newBidPrice} by @${bidderUsername}\n\n` +
            `<b>Manual action required!</b> Increase your auto-bid limit or place a manual bid to continue.`;
    }

    /**
     * Creates a message for auto-bid owner when their system responds
     * 
     * @param {object} productDetails - Product details
     * @param {number} autoBidPrice - The auto-bid price that was placed
     * @returns {string} - Formatted message
     */
    createAutoBidResponseMessage(productDetails, autoBidPrice) {
        return `🤖 <b>Auto-Bid System Responded!</b>\n\n` +
            `Your auto-bid system automatically placed a bid of $${autoBidPrice} on "${productDetails.title}".\n` +
            `You are now the highest bidder!`;
    }

    /**
     * Creates a message for auction win notification
     * 
     * @param {object} productDetails - Product details
     * @param {number} winningBid - The winning bid amount
     * @param {object} seller - Seller details with username and telegramHandle
     * @returns {string} - Formatted message
     */
    createAuctionWinMessage(productDetails, winningBid, seller) {
        let message = `🏆 <b>Congratulations! You Won an Auction!</b>\n\n` +
            `You have won the auction for "${productDetails.title}".\n` +
            `Your winning bid: $${winningBid}\n\n` +
            `<b>Contact Seller:</b>\n` +
            `Username: @${seller.username}`;
        
        // Add telegram handle if available
        if (seller.telegramHandle) {
            message += `\nTelegram: <a href="https://t.me/${seller.telegramHandle}">@${seller.telegramHandle}</a>`;
        } else {
            message += `\nTelegram: Not available`;
        }
        
        return message;
    }

    /**
     * Creates a message for auction end notification
     * 
     * @param {object} productDetails - Product details
     * @param {object} winner - Winner details (optional)
     * @param {number} finalPrice - Final selling price (optional)
     * @returns {string} - Formatted message
     */
    createAuctionEndMessage(productDetails, winner = null, finalPrice = null) {
        let message = `🔔 <b>Auction Ended</b>\n\n`;
        
        if (winner && finalPrice) {
            // Auction had bids - show winner and final price
            message += `The auction for "${productDetails.title}" has ended.\n\n` +
                      `🏆 <b>Winner:</b> @${winner.username}\n` +
                      `💰 <b>Final Price:</b> $${finalPrice}`;
        } else {
            // No bids received
            message += `The auction for "${productDetails.title}" has ended.\n\n` +
                      `❌ <b>No bids received</b> - Your item did not sell.`;
        }
        
        return message;
    }
}

module.exports = new TelegramBot(); 