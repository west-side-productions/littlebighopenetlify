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

### Order Email System
1. **Email Types**
   - `orderConfirmation`: Sent to customers after successful purchase
   - `orderNotification`: Sent to shipping company for physical products

2. **Trigger Conditions**
   ```javascript
   // Order confirmation email
   if (session.customer_details?.email) {
       await sendOrderConfirmationEmail(session.customer_details.email, session);
   }

   // Shipping notification email
   if (session.metadata?.type === 'physical' || session.metadata?.type === 'bundle') {
       await sendOrderNotificationEmail(session);
   }
   ```

3. **Template Structure**
   - Both HTML and text versions available
   - Language-specific content based on user preferences
   - Dynamic content injection for order details
   - Includes:
     - Order summary
     - Shipping details (if applicable)
     - Payment confirmation
     - Next steps instructions

4. **Email Templates Location**
   - Path: `/netlify/functions/email-templates/[language].js`
   - Supported languages: de, en, fr, it
   - Example structure:
   ```javascript
   module.exports = {
       orderConfirmation: {
           subject: 'Order Confirmation - Little Big Hope',
           html: (data) => `...`,
           text: (data) => `...`
       },
       orderNotification: {
           subject: 'New Order Notification',
           html: (data) => `...`,
           text: (data) => `...`
       }
   };
   ```

### Error Handling
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
    book: {
        type: 'physical',
        weight: 1005,          // 1005g product weight
        packagingWeight: 152,  // 152g packaging
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        dimensions: {
            length: 25,   // cm
            width: 20,   // cm
            height: 2    // cm
        }
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
    data-weight="1157"
>
    <!-- Product content -->
</div>
```

## Weight Handling System

### Weight Components
1. **Product Weight**
   - Base weight of the product (e.g., book weight)
   - Stored in product configuration
   - Measured in grams

2. **Packaging Weight**
   - Additional weight from packaging materials
   - Added to product weight for total calculation
   - Measured in grams

3. **Total Weight Calculation**
   ```javascript
   // All weights in grams
   const totalWeight = productWeight + packagingWeight;
   ```

### Weight Configuration
```javascript
const PRODUCT_CONFIG = {
    book: {
        type: 'physical',
        weight: 1005,         // 1005g product weight
        packagingWeight: 152, // 152g packaging
        dimensions: {
            length: 25,   // cm
            width: 20,   // cm
            height: 2    // cm
        }
    }
};
```

### Weight Validation
1. **Checkout Process**
   - Validates total weight matches sum of components
   - Ensures weight data is present for physical products
   - Passes weight information to shipping calculator

2. **Webhook Processing**
   - Verifies weight consistency
   - Logs weight discrepancies
   - Triggers alerts for weight mismatches

### Weight-based Shipping
1. **Rate Calculation**
   - Uses total weight for shipping cost calculation
   - Considers destination country
   - Applies weight-based shipping tiers

2. **Weight Limits**
   - Maximum weight per package
   - Weight-based restrictions per country
   - Combined order weight handling

## Checkout Process

### Technical Flow
1. **Authentication Flow**
   ```javascript
   // Member status check
   const member = await window.$memberstackDom.getCurrentMember();
   if (!member?.data) {
       // Store checkout state
       localStorage.setItem('checkoutConfig', JSON.stringify({
           productType: productType,
           shippingRateId: shippingRateId
       }));
       localStorage.setItem('checkoutRedirectUrl', currentPath + queryParams);
       window.location.href = '/registrieren';
       return;
   }
   ```

2. **Shipping Rate Selection**
   ```javascript
   // Shipping rate validation
   const shippingSelect = document.querySelector('#shipping-rate-select');
   if (productConfig.type === 'physical' || productConfig.type === 'bundle') {
       if (!shippingSelect?.value) {
           throw new Error('Please select a shipping option');
       }
       shippingRateId = shippingSelect.value;
   }
   ```

3. **Checkout Session Creation**
   ```javascript
   const payload = {
       priceId: priceId,
       customerEmail: member.data.auth.email,
       language: language,
       successUrl: window.location.origin + '/vielen-dank-email',
       cancelUrl: window.location.origin + '/produkte',
       metadata: {
           memberstackUserId: member.data.id,
           productType: productType,
           type: productConfig.type,
           language: language,
           source: window.location.pathname,
           planId: productConfig.memberstackPlanId || CONFIG.memberstackPlanId,
           requiresShipping: productConfig.type === 'physical' || productConfig.type === 'bundle',
           totalWeight: productConfig.weight + (productConfig.packagingWeight || 0),
           productWeight: productConfig.weight,
           packagingWeight: productConfig.packagingWeight || 0,
           dimensions: productConfig.dimensions ? JSON.stringify(productConfig.dimensions) : null,
           shippingClass: productConfig.shippingClass || 'standard'
       }
   };
   ```

4. **Stripe Redirect**
   ```javascript
   const session = await response.json();
   const stripe = await loadStripe(CONFIG.stripePublicKey);
   const { error } = await stripe.redirectToCheckout({
       sessionId: session.sessionId
   });
   ```

### Error Handling
1. **Button State Management**
   ```javascript
   const button = document.querySelector('[data-checkout-button]');
   const originalText = button ? button.textContent : '';
   
   try {
       if (button) {
           button.textContent = 'Processing...';
           button.disabled = true;
       }
       // ... checkout logic
   } catch (error) {
       if (button) {
           button.textContent = originalText;
           button.disabled = false;
       }
       throw error;
   }
   ```

2. **Session Creation Errors**
   ```javascript
   if (!response.ok) {
       const errorText = await response.text();
       console.error('Checkout session creation failed:', {
           status: response.status,
           statusText: response.statusText,
           error: errorText
       });
       throw new Error(`Failed to create checkout session: ${response.status} ${response.statusText}`);
   }
   ```

### Configuration Settings

1. **Product Configuration**
   ```javascript
   const PRODUCT_CONFIG = {
       book: {
           type: 'physical',
           weight: 1005,          // 1005g product weight
           packagingWeight: 152, // 152g packaging
           prices: { de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ' },
           dimensions: { length: 25, width: 20, height: 2 },
           shippingClass: 'standard'
       }
   };
   ```

2. **Shipping Rates**
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
       }
   };
   ```

### Testing Checklist
1. **Logged-in User Flow**
   - [ ] Checkout button triggers session creation
   - [ ] Shipping rate is correctly passed
   - [ ] Product metadata is complete
   - [ ] Stripe redirect works
   - [ ] Success/cancel URLs are correct

2. **Non-logged-in User Flow**
   - [ ] Redirects to registration
   - [ ] Stores checkout configuration
   - [ ] Stores return URL
   - [ ] Registration works
   - [ ] Returns to checkout

3. **Shipping Handling**
   - [ ] Rate selector works
   - [ ] Validation prevents empty selection
   - [ ] Correct rate appears in Stripe
   - [ ] Weight calculation is accurate

4. **Error Cases**
   - [ ] Invalid shipping rate
   - [ ] Missing product configuration
   - [ ] Network failures
   - [ ] Session creation failures
   - [ ] Stripe redirect failures

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
