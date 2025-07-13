const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting production build process...');

try {
    // Step 1: Build the client
    console.log('📦 Building React client...');
    execSync('cd client && npm run build', { stdio: 'inherit' });
    
    // Step 2: Clean existing public directory in backend
    const publicDir = path.join(__dirname, 'backend', 'public');
    if (fs.existsSync(publicDir)) {
        console.log('🧹 Cleaning existing public directory...');
        fs.rmSync(publicDir, { recursive: true, force: true });
    }
    
    // Step 3: Create public directory
    console.log('📁 Creating public directory...');
    fs.mkdirSync(publicDir, { recursive: true });
    
    // Step 4: Copy client build files to backend/public
    console.log('📋 Copying client build files to backend...');
    const clientDistDir = path.join(__dirname, 'client', 'dist');
    
    // Function to copy directory recursively
    function copyDir(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const items = fs.readdirSync(src);
        
        for (const item of items) {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            
            if (fs.statSync(srcPath).isDirectory()) {
                copyDir(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
    
    copyDir(clientDistDir, publicDir);
    
    console.log('✅ Production build completed successfully!');
    console.log('📦 Client build files copied to backend/public');
    console.log('🚀 Ready for deployment!');
    
} catch (error) {
    console.error('❌ Build process failed:', error.message);
    process.exit(1);
} 