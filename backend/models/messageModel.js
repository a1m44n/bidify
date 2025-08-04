const mongoose = require("mongoose");

const messageSchema = mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Product"
    },
    productTitle: {
        type: String,
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User"  // This will typically be the system/admin
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User"
    },
    messageType: {
        type: String,
        required: true,
        enum: [
            'AUCTION_END', 
            'AUCTION_WIN', 
            'AUCTION_OUTBID', 
            'AUCTION_AUTO_OUTBID',  // When auto-bid system outbids someone
            'AUTO_BID_MAX_EXCEEDED', // When someone exceeds auto-bid maximum
            'AUTO_BID_RESPONSE',     // When auto-bid owner is notified their system responded
            'SYSTEM'
        ]
    },
    message: {
        type: String,
        required: true
    },
    winningBid: {
        type: Number,
        required: function() { return this.messageType === 'AUCTION_WIN' }
    },
    read: {
        type: Boolean,
        default: false
    }
}, 
{ timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
module.exports = Message; 