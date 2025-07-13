// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' ? 'https://bidify-app-gyqzi.ondigitalocean.app/api' : 'http://localhost:5001');
 
export default API_URL; 