# Bidify

## 🚀 Deployment

This project is **designed to run exclusively on [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform/)** and may not function correctly in a local or alternative hosting environment without additional configuration.

## 🌐 Live Demo

link to a deployed version:
[Live Site](https://bidify-app-gyqzi.ondigitalocean.app/)
**App may no longer be hosted the moment you try open it

## 🛠️ Setup & Deployment (DigitalOcean)

To deploy this app on DigitalOcean:

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps).
3. Click "Create App" and connect your repository.
4. Configure the build and run environment as needed:
   - **Environment**: (Node.js)
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
5. Set any required **environment variables**:
   - `API_KEY=your_api_key`
   - `NODE_ENV=production`
6. Click "Deploy".

> ⚠️ **Note:** This app may not run properly in a local environment due to DigitalOcean-specific configuration.

## 📁 Project Structure
.
├── backend/
│   ├── controllers/         # API controllers for auctions, users, products, etc.
│   ├── middleware/          # Auth and error handling middleware
│   ├── models/              # Mongoose models for data entities
│   ├── public/              # Static assets
│   ├── routes/              # Express route definitions
│   ├── scripts/             # Utility scripts for development/testing
│   ├── services/            # Business logic and integrations (AI, cache, scraping)
│   ├── uploads/             # Uploaded product images
│   ├── server.js            # Main Express server entry point
│   └── package.json         # Backend dependencies
├── client/
│   ├── src/                 # Frontend source code
│   ├── public/              # Frontend static assets
│   ├── package.json         # Frontend dependencies
│   └── vite.config.js       # Vite configuration
├── clear*.js                # Utility scripts for clearing data
├── createCategories.js      # Script for initializing categories
├── DEPLOYMENT.md            # Deployment instructions
├── ENV_TEMPLATE.md          # Example environment variables
├── Procfile                 # Process type definitions for deployment
├── package.json             # Root dependencies
└── README.md                # Project documentation

 Requirements
DigitalOcean account
Connected Git repo (GitHub, GitLab, or Bitbucket)
Required secrets / environment variables configured in App Platform (see ENV_TEMPLATE.md)
