# Little Big Hope - System Documentation

## System Architecture Overview

### 1. Global Head Code (webflow-memberstack.html)
- **Core Functionality**
  - Language detection and management via `$lbh` object
  - Memberstack authentication integration
  - Global event handlers and utilities
- **Implementation Details**
  ```javascript
  const $lbh = {
      language: () => {
          // Priority-based language detection
          // 1. Memberstack user preferences
          // 2. Webflow locale
          // 3. URL path prefix
          // 4. Browser language
          // 5. Default fallback
      }
  };
  ```
- **Location**: Included in Webflow's global head settings
- **Dependencies**
  - Memberstack SDK
  - Custom language utilities
  - Browser APIs (localStorage, navigator)

### 2. Checkout System (webflow-memberstack-checkout.js)
- **Core Components**
  1. Product Configuration
  2. Shipping Calculator
  3. Stripe Integration
  4. Error Handling
- **Implementation Details**
  ```javascript
  // Product Configuration
  const PRODUCT_CONFIG = {
      course: {
          id: 'prc_online-kochkurs-8b540kc2',
          type: 'digital',
          prices: { /* language-specific prices */ }
      },
      book: {
          id: 'prc_cookbook_physical',
          type: 'physical',
          prices: { /* language-specific prices */ },
          requiresShipping: true
      }
  };

  // Shipping Rates Structure
  const SHIPPING_RATES = {
      'shr_1QScKFJRMXFic4sW9e80ABBp': { 
          price: 7.28, 
          label: 'Österreich', 
          countries: ['AT']
      },
      // ... more rates
  };
  ```
- **Error Handling**
  - Retry mechanism with exponential backoff
  - Comprehensive error logging
  - User-friendly error messages
- **Security Measures**
  - Input validation
  - XSS prevention
  - Secure API calls

## Language Handling

### Technical Implementation
```javascript
// Language Detection Priority System
1. Memberstack.customFields.language
2. Webflow.info.locale
3. window.location.pathname.match(/^\/(de|en|fr|it)\//)
4. navigator.language
5. LANGUAGE_CONFIG.default
```

### URL Structure
- **Pattern**: `/{language?}/page-name`
- **Examples**:
  ```
  /about-us           → German (default)
  /en/about-us        → English
  /fr/about-us        → French
  /it/about-us        → Italian
  ```
- **Implementation**:
  - URL rewriting via Webflow custom code
  - Language prefix extraction
  - Fallback handling

## Email System

### Architecture
1. **Netlify Functions**
   - Location: `/netlify/functions/`
   - Key Components:
     - `stripe-webhook.js`: Handles Stripe events
     - `send-email.js`: Email dispatch service
     - `email-templates/`: Language-specific templates

2. **Email Service Integration**
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   ```

3. **Template System**
   - HTML templates with consistent styling
   - Sanitization utilities
   ```javascript
   const sanitizeInput = (input) => {
       if (!input) return '';
       return String(input)
           .replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           // ... more sanitization
   };
   ```

4. **Error Handling**
   - Retry mechanism for failed sends
   - Error logging and monitoring
   - Fallback templates

### Webhook Processing
1. **Event Validation**
   ```javascript
   const sig = event.headers['stripe-signature'];
   const stripeEvent = Stripe.webhooks.constructEvent(
       event.body, 
       sig, 
       process.env.STRIPE_WEBHOOK_SECRET
   );
   ```

2. **Metadata Validation**
   - Required fields:
     - memberstackUserId
     - planId
     - countryCode
     - totalWeight
     - productWeight
     - packagingWeight

3. **Weight Validation**
   ```javascript
   const totalWeight = Number(session.metadata.totalWeight);
   const productWeight = Number(session.metadata.productWeight);
   const packagingWeight = Number(session.metadata.packagingWeight);
   
   if (totalWeight !== (productWeight + packagingWeight)) {
       throw new Error('Weight mismatch');
   }
   ```

## Product System

### Product Configuration
```javascript
const PRODUCT_CONFIG = {
    course: {
        id: 'prc_online-kochkurs-8b540kc2',
        type: 'digital',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    },
    book: {
        id: 'prc_cookbook_physical',
        type: 'physical',
        prices: { /* ... */ },
        requiresShipping: true
    }
};
```

### Product Types
1. **Digital Products**
   - No shipping required
   - Immediate access
   - Memberstack plan integration

2. **Physical Products**
   - Shipping calculation
   - Weight tracking
   - Inventory management (future)

### HTML Implementation
```html
<div 
    data-product-type="book" 
    data-requires-shipping="true"
    data-weight="500"
>
    <!-- Product content -->
</div>
```

## Checkout Process

### Technical Flow
1. **Product Selection**
   - DOM event listeners
   - Data attribute validation
   - Price calculation

2. **Language Detection**
   ```javascript
   function getPreferredLanguage() {
       const language = $lbh.language();
       const productElement = document.querySelector('[data-product-type]');
       const productType = productElement?.dataset.productType || 'book';
       const productConfig = PRODUCT_CONFIG[productType];
       
       return productConfig?.prices[language] 
           ? language 
           : LANGUAGE_CONFIG.default;
   }
   ```

3. **Shipping Calculation**
   ```javascript
   function calculateShippingRate(country) {
       const countryCode = country.toUpperCase();
       const rate = SHIPPING_RATES[countryCode] || 
                   EU_COUNTRIES.includes(countryCode) && 
                   SHIPPING_RATES.EU;
       
       if (!rate) throw new Error(`No shipping rate for: ${countryCode}`);
       return rate;
   }
   ```

4. **Stripe Integration**
   - Session creation
   - Webhook handling
   - Error management

### Security Measures
1. **Input Validation**
   - Data attribute verification
   - Price validation
   - Country code validation

2. **API Security**
   - Webhook signatures
   - API key management
   - Rate limiting

3. **Error Handling**
   - Retry mechanisms
   - User feedback
   - Logging and monitoring

## Stripe-Memberstack Integration

### Overview
The integration between Stripe and Memberstack handles automatic plan assignment after successful checkout. This is implemented through Stripe webhooks and direct Memberstack API calls.

### Core Components

1. **Stripe Webhook Handler** (`/netlify/functions/stripe-webhook.js`)
   - Processes `checkout.session.completed` events
   - Verifies payment status
   - Adds plans to Memberstack users

2. **Memberstack API Integration**
   ```javascript
   const url = `https://admin.memberstack.com/members/${memberId}/add-plan`;
   const headers = {
       "X-API-KEY": process.env.MEMBERSTACK_SECRET_KEY
   };
   ```

### Environment Variables
- `STRIPE_SECRET_KEY`: Stripe API authentication
- `STRIPE_WEBHOOK_SECRET`: Webhook signature verification
- `MEMBERSTACK_SECRET_KEY`: Memberstack API authentication
- `MEMBERSTACK_LIFETIME_PLAN_ID`: Plan ID to add to users

### Implementation Details

1. **Webhook Processing Flow**
   ```javascript
   if (stripeEvent.type === 'checkout.session.completed') {
       const session = stripeEvent.data.object;
       if (session.payment_status === 'paid' && session.metadata?.memberstackUserId) {
           await addPlanToMember(session.metadata.memberstackUserId);
       }
   }
   ```

2. **Error Handling**
   - Detailed error logging
   - API response validation
   - Error propagation to webhook response

### Important Notes

1. **API Authentication**
   - Must use "X-API-KEY" header (not "Authorization")
   - Memberstack secret key must be provided exactly as is

2. **Deployment Considerations**
   - Environment variables must be set in Netlify
   - Requires redeployment when environment variables are changed

3. **Verification Points**
   - Memberstack dashboard: Check user's plan status
   - Webhook logs: Verify successful API response
   - Stripe dashboard: Confirm completed checkout session

### Testing & Monitoring

1. **Success Indicators**
   ```javascript
   // Successful plan addition log
   console.log(`Successfully added plan to member ${memberId}`, response.data);
   ```

2. **Error Monitoring**
   ```javascript
   // Error handling with detailed information
   const errorMessage = error.response?.data || error.message || 'Unknown error';
   console.error('Error adding plan to member:', errorMessage);
   ```

### Troubleshooting

1. **Common Issues**
   - Incorrect API key format
   - Missing or invalid memberstackUserId in session metadata
   - Webhook signature verification failures

2. **Resolution Steps**
   - Verify environment variables in Netlify
   - Check webhook logs for detailed error messages
   - Confirm Memberstack API key format and permissions

## Components

### Active Components
1. **Core Files**
   - `webflow-memberstack.html`: Global functionality
   - `webflow-memberstack-checkout.js`: Checkout system
   - `shopping.js`: Shopping list page
   - `recipe.js`: Recipe page

2. **Netlify Functions**
   - Webhook handling
   - Email processing
   - Template management

3. **Configuration**
   - Package management
   - Environment settings
   - Build configuration

### Archived Components
The `old/` directory contains deprecated files that were used in previous versions:
- Checkout templates
- Old Memberstack integration files
- Previous verification pages
- Legacy shopping code

These files are kept for reference but are no longer in active use.

## Development Guidelines

### File Organization
```
project/
├── netlify/
│   └── functions/
│       ├── stripe-webhook.js
│       ├── send-email.js
│       └── email-templates/
│           ├── de.js
│           ├── en.js
│           ├── fr.js
│           └── it.js
├── old/                              # Archive of deprecated files
│   ├── checkout-template-*.html
│   ├── memberstack-*.js/html
│   └── other deprecated files
├── webflow-memberstack.html          # Global head code
├── webflow-memberstack-checkout.js   # Main checkout system
├── shopping.html                     # Main shopping page
├── shopping.js                       # Shopping list functionality
├── recipe.js                        # Recipe page functionality
└── configuration files
    ├── package.json
    ├── netlify.toml
    └── .env.example
```

### Best Practices
1. **Language Handling**
   - Use URL structure consistently
   - Implement fallback chain
   - Validate language codes

2. **Configuration Management**
   - Centralize configurations
   - Use constants for repeated values
   - Document all config options

3. **Error Handling**
   - Implement retry mechanisms
   - Log errors comprehensively
   - Provide user feedback

4. **Security**
   - Validate all inputs
   - Secure API endpoints
   - Monitor for suspicious activity

## Maintenance

### Regular Tasks
1. **Configuration Updates**
   - Stripe price IDs
   - Shipping rates
   - Language support

2. **Monitoring**
   - Email delivery rates
   - Webhook success rates
   - Error logs

3. **Security**
   - API key rotation
   - Dependency updates
   - Security patch application

### Troubleshooting Guide
1. **Language Issues**
   - Check URL structure
   - Verify Memberstack fields
   - Validate language codes

2. **Checkout Problems**
   - Verify Stripe configuration
   - Check webhook logs
   - Validate product setup

3. **Email Issues**
   - Check SendGrid logs
   - Verify template syntax
   - Monitor bounce rates

4. **Authentication**
   - Review Memberstack settings
   - Check API key validity
   - Verify webhook signatures
