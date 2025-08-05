#!/usr/bin/env node

const readline = require('readline');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Import models
const User = require('./models/UserModels');
const Product = require('./models/productModels');
const Category = require('./models/categoryModel');

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Helper function to prompt user input
function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.DATABASE_CLOUD, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`${colors.green}✅ Connected to MongoDB${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Database connection failed:${colors.reset}`, error.message);
        process.exit(1);
    }
}

// Display main menu
function showMenu() {
    console.log(`\n${colors.cyan}${colors.bright}🏛️ Bidify Administrative Panel 🏛️${colors.reset}`);
    console.log(`${colors.blue}================================${colors.reset}`);
    console.log(`${colors.yellow}1.${colors.reset} View all users`);
    console.log(`${colors.yellow}2.${colors.reset} Delete user`);
    console.log(`${colors.yellow}3.${colors.reset} View all items`);
    console.log(`${colors.yellow}4.${colors.reset} Create category`);
    console.log(`${colors.yellow}5.${colors.reset} Exit`);
    console.log(`${colors.blue}================================${colors.reset}`);
}

// View all users
async function viewAllUsers() {
    try {
        console.log(`\n${colors.cyan}📋 Fetching all users...${colors.reset}`);
        const users = await User.find({}).select('_id username email');
        
        if (users.length === 0) {
            console.log(`${colors.yellow}No users found.${colors.reset}`);
            return;
        }

        console.log(`\n${colors.green}Found ${users.length} users:${colors.reset}`);
        console.log(`${colors.blue}${'ID'.padEnd(25)} | ${'Username'.padEnd(20)} | ${'Email'.padEnd(30)}${colors.reset}`);
        console.log('-'.repeat(78));
        
        users.forEach(user => {
            const id = user._id.toString().substring(0, 24);
            const name = (user.username || 'N/A').substring(0, 19);
            const email = (user.email || 'N/A').substring(0, 29);
            
            console.log(`${id.padEnd(25)} | ${name.padEnd(20)} | ${email.padEnd(30)}`);
        });
    } catch (error) {
        console.error(`${colors.red}❌ Error fetching users:${colors.reset}`, error.message);
    }
}

// Delete user
async function deleteUser() {
    try {
        const username = await prompt(`${colors.yellow}Enter username to delete: ${colors.reset}`);
        
        if (!username.trim()) {
            console.log(`${colors.red}❌ Username cannot be empty.${colors.reset}`);
            return;
        }

        // Find user
        const user = await User.findOne({ username: username.trim() });
        
        if (!user) {
            console.log(`${colors.red}❌ User '${username}' not found.${colors.reset}`);
            return;
        }

        // Confirm deletion
        const confirm = await prompt(`${colors.red}⚠️  Are you sure you want to delete user '${user.username}' (${user.email})? This action cannot be undone. (yes/no): ${colors.reset}`);
        
        if (confirm.toLowerCase() !== 'yes') {
            console.log(`${colors.yellow}Deletion cancelled.${colors.reset}`);
            return;
        }

        // Delete user
        await User.findByIdAndDelete(user._id);
        console.log(`${colors.green}✅ User '${username}' has been deleted successfully.${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting user:${colors.reset}`, error.message);
    }
}

// View all items
async function viewAllItems() {
    try {
        console.log(`\n${colors.cyan}📦 Fetching all items...${colors.reset}`);
        const products = await Product.find({})
            .select('title user price category condition createdAt auctionEndTime isSoldOut')
            .populate('user', 'username')
            .sort({ createdAt: -1 });
        
        if (products.length === 0) {
            console.log(`${colors.yellow}No items found.${colors.reset}`);
            return;
        }

        console.log(`\n${colors.green}Found ${products.length} items:${colors.reset}`);
        console.log(`${colors.blue}${'Title'.padEnd(25)} | ${'Owner'.padEnd(15)} | ${'Price'.padEnd(10)} | ${'Category'.padEnd(12)} | ${'Status'}${colors.reset}`);
        console.log('-'.repeat(85));
        
        products.forEach(product => {
            const title = (product.title || 'N/A').substring(0, 24);
            const owner = (product.user?.username || 'N/A').substring(0, 14);
            const price = `$${product.price || 0}`.substring(0, 9);
            const category = (product.category || 'N/A').substring(0, 11);
            
            // Determine status based on auction end time and if sold
            const now = new Date();
            const isActive = !product.isSoldOut && new Date(product.auctionEndTime) > now;
            const status = isActive ? `${colors.green}Active${colors.reset}` : `${colors.red}Ended${colors.reset}`;
            
            console.log(`${title.padEnd(25)} | ${owner.padEnd(15)} | ${price.padEnd(10)} | ${category.padEnd(12)} | ${status}`);
        });
    } catch (error) {
        console.error(`${colors.red}❌ Error fetching items:${colors.reset}`, error.message);
    }
}

// Get available icons
function getAvailableIcons() {
    const iconPaths = [
        '../client/public/images/category',
        './public/images/category'
    ];
    
    let icons = [];
    
    for (const iconPath of iconPaths) {
        if (fs.existsSync(iconPath)) {
            const files = fs.readdirSync(iconPath);
            const imageFiles = files.filter(file => 
                file.toLowerCase().match(/\.(png|jpg|jpeg|gif|svg|webp)$/)
            );
            icons = icons.concat(imageFiles.map(file => ({ file, path: iconPath })));
            break; // Use the first path that exists
        }
    }
    
    return icons;
}

// Create category
async function createCategory() {
    try {
        const categoryName = await prompt(`${colors.yellow}Enter category name: ${colors.reset}`);
        
        if (!categoryName.trim()) {
            console.log(`${colors.red}❌ Category name cannot be empty.${colors.reset}`);
            return;
        }

        // Check if category already exists
        const existingCategory = await Category.findOne({ title: categoryName.trim() });
        if (existingCategory) {
            console.log(`${colors.red}❌ Category '${categoryName}' already exists.${colors.reset}`);
            return;
        }

        // Get available icons
        const icons = getAvailableIcons();
        
        if (icons.length === 0) {
            console.log(`${colors.red}❌ No icon files found in category directories.${colors.reset}`);
            return;
        }

        console.log(`\n${colors.cyan}Available icons:${colors.reset}`);
        icons.forEach((icon, index) => {
            console.log(`${colors.yellow}${index + 1}.${colors.reset} ${icon.file}`);
        });

        const iconChoice = await prompt(`${colors.yellow}Choose an icon (1-${icons.length}): ${colors.reset}`);
        const iconIndex = parseInt(iconChoice) - 1;
        
        if (isNaN(iconIndex) || iconIndex < 0 || iconIndex >= icons.length) {
            console.log(`${colors.red}❌ Invalid icon choice.${colors.reset}`);
            return;
        }

        const selectedIcon = icons[iconIndex];
        
        // Create category
        const newCategory = new Category({
            title: categoryName.trim(),
            image: `/images/category/${selectedIcon.file}`
        });

        await newCategory.save();
        console.log(`${colors.green}✅ Category '${categoryName}' created successfully with icon '${selectedIcon.file}'.${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error creating category:${colors.reset}`, error.message);
    }
}

// Main application loop
async function main() {
    await connectDB();
    
    console.log(`${colors.green}🚀 Bidify Administrative Panel Started${colors.reset}`);
    
    while (true) {
        showMenu();
        const choice = await prompt(`${colors.yellow}Enter your choice (1-5): ${colors.reset}`);
        
        switch (choice.trim()) {
            case '1':
                await viewAllUsers();
                break;
            case '2':
                await deleteUser();
                break;
            case '3':
                await viewAllItems();
                break;
            case '4':
                await createCategory();
                break;
            case '5':
                console.log(`${colors.cyan}👋 Goodbye!${colors.reset}`);
                rl.close();
                process.exit(0);
                break;
            default:
                console.log(`${colors.red}❌ Invalid choice. Please enter 1-5.${colors.reset}`);
        }
        
        // Wait for user to press enter before showing menu again
        await prompt(`\n${colors.blue}Press Enter to continue...${colors.reset}`);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log(`\n${colors.cyan}👋 Goodbye!${colors.reset}`);
    rl.close();
    process.exit(0);
});

// Start the application
main().catch(error => {
    console.error(`${colors.red}❌ Application error:${colors.reset}`, error);
    process.exit(1);
}); 