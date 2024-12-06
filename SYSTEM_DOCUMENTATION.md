# Little Big Hope - System Documentation

## System Architecture Overview

### 1. Global Head Code (webflow-memberstack.html)
- Contains core functionality used across all pages
- Handles language detection and management through `$lbh` object
- Manages Memberstack authentication
- Location: Included in Webflow's global head settings

### 2. Checkout System (webflow-memberstack-checkout.js)
- Only loaded on product/shopping pages
- Handles Stripe integration and payment processing
- Manages shipping calculations and rates
- Location: Included specifically on product pages

## Language Handling

### Configuration
```javascript
const LANGUAGE_CONFIG = {
    supported: ['de', 'en', 'fr', 'it'],
    default: 'de'
}
```

### Detection Priority
1. Memberstack user preferences (customFields.language)
2. Webflow's current locale
3. URL path language prefix
4. Browser language
5. Falls back to default ('de')

### URL Structure
- German (default): `/page-name`
- Other languages: `/{language}/page-name`
- Example: `/en/about-us`

## Email System

### Components
1. Netlify Functions
   - Location: `/netlify/functions/`
   - Handles email sending logic
   - Processes Stripe webhooks

### Email Templates
- Located in `/netlify/functions/email-templates/`
- Language-specific templates (de.js, en.js, fr.js, it.js)
- Supports HTML formatting
- Template Types:
  - Welcome email
  - Email verification
  - Password reset
  - Purchase confirmation
  - Password changed notification

### Email Triggers
1. User Registration
2. Email Verification
3. Password Reset/Change
4. Purchase Confirmation

## Product System

### Price Configuration
```javascript
CONFIG.stripePrices = {
    de: 'price_1QSjdDJRMXFic4sWWs0pOYf8',
    en: 'price_1QSjdDJRMXFic4sWWs0pOYf8',
    it: 'price_1QSjdDJRMXFic4sWWs0pOYf8',
    fr: 'price_1QSjdDJRMXFic4sWWs0pOYf8'
}
```

### Shipping Rates
```javascript
const SHIPPING_RATES = {
    'shr_1QScKFJRMXFic4sW9e80ABBp': { 
        price: 7.28, 
        label: 'Österreich', 
        countries: ['AT']
    },
    'shr_1QScMXJRMXFic4sWih6q9v36': { 
        price: 20.72, 
        label: 'Great Britain', 
        countries: ['GB']
    },
    // ... more rates
}
```

## Checkout Process

### Flow
1. User selects product
2. Language detection determines price ID
3. Shipping country selection
4. Stripe checkout session creation
5. Redirect to Stripe checkout
6. Webhook handling for completion

### Security
- Memberstack authentication required
- Secure API endpoints
- Environment variables for sensitive data

## Integration Points

### Webflow
- Custom code in page settings
- Global head code
- Page-specific scripts

### Memberstack
- User authentication
- Custom fields for language preference
- Plan management

### Stripe
- Payment processing
- Product/price configuration
- Webhook handling

## Development Guidelines

### File Organization
1. Global code in webflow-memberstack.html
2. Checkout code only on product pages
3. Netlify functions for backend logic
4. Email templates in dedicated directory

### Best Practices
1. Language handling through URL structure
2. Centralized configuration objects
3. Error handling and logging
4. Secure API endpoints

## Maintenance

### Regular Tasks
1. Update Stripe price IDs when needed
2. Maintain email templates
3. Check webhook functionality
4. Monitor error logs

### Troubleshooting
1. Language issues: Check URL structure and Memberstack fields
2. Checkout problems: Verify Stripe configuration
3. Email issues: Check Netlify function logs
4. Authentication: Review Memberstack settings
