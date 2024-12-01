# Little Big Hope Shopping System

A Webflow-based shopping system with Memberstack 2.0 integration and custom shipping handling.

## Features

- Product management (Course, Book, Bundle)
- Dynamic shipping calculations
- Country-based shipping rates
- Memberstack 2.0 integration
- Netlify Functions for secure shipping charges

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env` file with:
```
STRIPE_SECRET_KEY=your_stripe_secret_key
```

3. Deploy to Netlify:
- Connect your GitHub repository
- Set environment variables in Netlify dashboard
- Deploy

## Development

Run locally:
```bash
netlify dev
```

## Structure

- `memberstack-checkout.js`: Main checkout handling
- `netlify/functions/`: Serverless functions
- `shopping.js`: Shopping list functionality
- `webflow-shopping.js`: Webflow integration
- `recipe.js`: Recipe management
