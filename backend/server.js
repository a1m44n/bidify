const dotenv = require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const userRoute = require('./routes/userRoute');
const productRoute = require('./routes/productRoute');
const biddingRoute = require('./routes/biddingRoute');
const autoBidRoute = require('./routes/autoBidRoute');
const categoryRoute = require('./routes/categoryRoute');
const errorHandler = require('./middleware/errorMiddleWare');
const messageRoutes = require("./routes/messageRoutes");
const suggestionRoute = require('./routes/suggestionRoute');
const telegramWebhookRoute = require('./routes/telegramWebhookRoute');
const watchlistRoute = require('./routes/watchlistRoute');
const auctionMonitorService = require('./services/auctionMonitorService');

const app = express();

app.use(express.json());
app.use(cookieParser()); 

app.use(
    express.urlencoded({
        extended: false,
    })
);

app.use(bodyParser.json()); 

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? [process.env.CLIENT_URL, process.env.FRONTEND_URL] // Production domains
        : true, // Allow all origins in development
    credentials: true, 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

const PORT = process.env.PORT || 8080;

// API routes
app.use("/api/users", userRoute);
app.use("/api/product", productRoute);
app.use("/api/bidding", biddingRoute);
app.use("/api/auto-bid", autoBidRoute);
app.use("/api/category", categoryRoute);
app.use("/api/messages", messageRoutes);
app.use("/api/suggestion", suggestionRoute);
app.use("/api/telegram/webhook", telegramWebhookRoute);
app.use("/api/watchlist", watchlistRoute);

// Static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check endpoint for App Platform
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Root endpoint
app.get("/", (req, res) => {
    res.json({
        message: "Bidify API Server",
        status: "running",
        timestamp: new Date().toISOString()
    });
});

// Error handler middleware (must be last)
app.use(errorHandler);

mongoose.connect(process.env.DATABASE_CLOUD,{
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    app.listen(PORT, async () => {
        console.log(`Server Running on port  ${PORT}`);
        
        // Start the auction monitor service
        auctionMonitorService.start();
        console.log('Auction monitor service started');
        
        // Set up Telegram webhook for production
        if (process.env.NODE_ENV === 'production' && process.env.TELEGRAM_BOT_TOKEN && process.env.SERVER_URL) {
            const setupWebhook = async (retries = 3) => {
                for (let attempt = 1; attempt <= retries; attempt++) {
                    try {
                        const telegramBot = require('./utils/telegramBot');
                        const webhookUrl = `${process.env.SERVER_URL}/api/telegram/webhook`;
                        console.log(`📡 Setting up Telegram webhook (attempt ${attempt}/${retries})...`);
                        console.log(`🎯 Webhook URL: ${webhookUrl}`);
                        
                        const result = await telegramBot.setWebhook(webhookUrl);
                        if (result.success) {
                            console.log('✅ Telegram webhook set up successfully for production!');
                            console.log('🔍 Webhook details:', result.data);
                            return;
                        } else {
                            console.error(`❌ Attempt ${attempt} failed:`, result.error);
                            if (attempt === retries) {
                                console.error('💥 All webhook setup attempts failed!');
                            } else {
                                console.log(`⏳ Retrying in 5 seconds...`);
                                await new Promise(resolve => setTimeout(resolve, 5000));
                            }
                        }
                    } catch (error) {
                        console.error(`💥 Error on attempt ${attempt}:`, error.message);
                        if (attempt === retries) {
                            console.error('💀 Fatal: All webhook setup attempts failed!');
                        } else {
                            console.log(`⏳ Retrying in 5 seconds...`);
                            await new Promise(resolve => setTimeout(resolve, 5000));
                        }
                    }
                }
            };
            
            // Set up webhook with retry logic
            setupWebhook();
        } else if (process.env.NODE_ENV === 'production') {
            console.warn('⚠️  Production mode detected but Telegram webhook not configured. Check TELEGRAM_BOT_TOKEN and SERVER_URL environment variables.');
        }
    });
})
.catch ((err) => {
    console.log(err);
}); 


