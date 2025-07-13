import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Copy index.html to 404.html for client-side routing
const distPath = path.join(__dirname, '../dist');
const indexPath = path.join(distPath, 'index.html');
const notFoundPath = path.join(distPath, '404.html');

try {
  // Read the index.html file
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Write it as 404.html
  fs.writeFileSync(notFoundPath, indexContent);
  
  console.log('✓ Successfully created 404.html from index.html');
} catch (error) {
  console.error('✗ Error creating 404.html:', error.message);
  process.exit(1);
} 