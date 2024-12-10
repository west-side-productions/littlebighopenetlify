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
          prices: { 
              de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
              en: 'price_1QT214JRMXFic4sWr5OXetuw',
              fr: 'price_1QT214JRMXFic4sWr5OXetuw',
              it: 'price_1QT206JRMXFic4sW78d5dEDO'
          },
          memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
      },
      book: {
          id: 'prc_cookbook_physical',
          type: 'physical',
          prices: { 
              de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
              en: 'price_1QT214JRMXFic4sWr5OXetuw' 
          },
          requiresShipping: true,
          memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
      },
      bundle: {
          id: 'prc_cookbook_bundle',
          type: 'bundle',
          requiresShipping: true,
          components: ['book', 'course'],
          discountAmount: 1400, // €14 discount
          weight: 450,
          packagingWeight: 50,
          memberstackPlanId: 'prc_kurs-buch-s29u04fs'
      }
  };

  // Shipping Rates Structure
  const SHIPPING_RATES = {
      'shr_1QScKFJRMXFic4sW9e80ABBp': { 
          price: 0, 
          label: 'Österreich', 
          countries: ['AT']
      },
      'shr_1QScOlJRMXFic4sW8MHW0kq7': { 
          price: 20.36, 
          label: 'Europe', 
          countries: [
              'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
              'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
              'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
          ]
      },
      'shr_1QScMXJRMXFic4sWih6q9v36': { 
          price: 20.72, 
          label: 'Great Britain', 
          countries: ['GB']
      },
      'shr_1QScNqJRMXFic4sW3NVUUckl': { 
          price: 36.53, 
          label: 'Singapore', 
          countries: ['SG']
      }
  };
  ```

### 3. Product and Plan Configuration
- **Product Types**:
  1. **Course (Digital)**
     - No shipping required
     - Memberstack Plan: `pln_kostenloser-zugang-84l80t3u`
     - Available in multiple languages with different price points
  
  2. **Book (Physical)**
     - Requires shipping
     - Weight: 450g + 50g packaging
     - Memberstack Plan: `pln_kostenloser-zugang-84l80t3u`
     - Available in multiple languages
  
  3. **Bundle (Book + Course)**
     - Requires shipping (includes physical book)
     - Weight: Same as book (450g + 50g packaging)
     - Automatic €14 discount applied
     - Memberstack Plan: `prc_kurs-buch-s29u04fs`
     - Combines both products with special pricing

- **Shipping Configuration**:
  - Rates vary by region:
    - Austria: Free shipping
    - Europe: €20.36
    - Great Britain: €20.72
    - Singapore: €36.53
  - Each rate has specific country restrictions
  - Weight-based calculations for physical products

- **Checkout Process**:
  1. User selects product (book, course, or bundle)
  2. For physical products:
     - Shipping country selection
     - Shipping rate calculation
  3. Stripe checkout session creation with:
     - Product configuration
     - Shipping details (if applicable)
     - Tax calculation enabled
     - Memberstack plan ID in metadata
  4. On successful payment:
     - Memberstack plan is assigned
     - Confirmation emails sent
     - For physical products, shipping notification sent

## Language Handling

The system supports multiple languages (de, en, fr, it) with German (de) as the default. Language preferences are handled in the following ways:

1. **Language Detection Priority**:
   ```javascript
   // Priority order for language detection:
   1. Memberstack custom field (for logged-in users)
   2. Webflow's current locale
   3. URL path language prefix
   4. Browser language
   5. Default to 'de'
   ```

2. **Registration Form**:
   - The registration form includes a language select field with Memberstack integration:
   ```html
   <select data-ms-field="language" data-ms-member="language">
       <option value="en">English</option>
       <option value="it">Italiano</option>
       <option value="fr">Français</option>
       <option value="de">Deutsch</option>
   </select>
   ```
   - The detected language is automatically pre-selected in this dropdown
   - The selected language is saved as a custom field in the member's Memberstack profile upon registration

3. **Language Detection Implementation**:
   ```javascript
   const LANGUAGE_CONFIG = {
       supported: ['de', 'en', 'fr', 'it'],
       default: 'de'
   };

   // Language detection function
   language: () => {
       // 1. Try Memberstack (highest priority for logged-in users)
       if (member?.data?.customFields?.language) {
           return member.data.customFields.language;
       }

       // 2. Try Webflow's current locale
       const currentLocaleLink = document.querySelector('.w-locales-item a.w--current');
       if (currentLocaleLink?.getAttribute('hreflang')) {
           return hrefLang;
       }

       // 3. Try URL path
       const pathParts = window.location.pathname.split('/');
       if (LANGUAGE_CONFIG.supported.includes(pathParts[1])) {
           return pathParts[1];
       }

       // 4. Try browser language
       const browserLang = navigator.language.split('-')[0].toLowerCase();
       if (LANGUAGE_CONFIG.supported.includes(browserLang)) {
           return browserLang;
       }

       // 5. Fallback to default
       return LANGUAGE_CONFIG.default;
   }
   ```

4. **URL Structure**:
   - Default language (de): `domain.com/page`
   - Other languages: `domain.com/[lang]/page`
   - Example: `domain.com/en/products`

5. **Language Persistence**:
   - Language preference is stored in Memberstack custom fields for registered users
   - The system automatically redirects users to their preferred language path
   - Non-logged-in users are directed based on the language detection priority

This multi-layered approach ensures consistent language handling across the site while respecting user preferences and maintaining a good user experience for both logged-in and anonymous users.

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

## Shipping and Weight Handling

#### 1. Product Weight Configuration
- **Weight Specification**
  ```javascript
  const PRODUCT_CONFIG = {
      'book': {
          weight: 1005,         // Product weight in grams
          packagingWeight: 152, // Additional packaging weight in grams
          dimensions: {
              length: 25,
              width: 20,
              height: 2
          }
      }
  };
  ```

#### 2. Shipping Fee Structure
- **Country-Based Rates**
  - Austria (AT): Free shipping
  - Europe: €20.36
  - Great Britain: €20.72
  - Singapore: €36.53
- **Implementation**
  ```javascript
  const SHIPPING_RATES = {
      'shr_1QScKFJRMXFic4sW9e80ABBp': { 
          price: 0, 
          label: 'Österreich', 
          countries: ['AT']
      },
      // ... other shipping rates
  };
  ```

#### 3. Weight Metadata Handling
- **Checkout Session**
  - Product weight, packaging weight, and total weight are stored in session metadata
  - Used for shipping notifications and logistics
  ```javascript
  metadata: {
      productWeight: productConfig.weight?.toString() || '0',
      packagingWeight: productConfig.packagingWeight?.toString() || '0',
      totalWeight: ((productConfig.weight || 0) + (productConfig.packagingWeight || 0)).toString()
  }
  ```

## Memberstack Plan Integration

#### 1. Plan Configuration
- **Product-Based Plans**
  ```javascript
  const PRODUCT_CONFIG = {
      'course': {
          memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
      },
      'book': {
          memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
      },
      'bundle': {
          memberstackPlanId: 'prc_kurs-buch-s29u04fs'
      }
  };
  ```

#### 2. Checkout Process
1. **Session Creation**
   - Memberstack plan ID is included in checkout session metadata
   ```javascript
   metadata: {
       memberstackUserId: data.metadata.memberstackUserId,
       memberstackPlanId: productConfig.memberstackPlanId
   }
   ```

2. **Post-Purchase Plan Addition**
   - Triggered by successful checkout event
   - Plan is added via Memberstack API
   ```javascript
   async function addPlanToMember(memberId, planId) {
       const url = `https://admin.memberstack.com/members/${memberId}/add-plan`;
       const data = { planId };
       const headers = { "X-API-KEY": process.env.MEMBERSTACK_SECRET_KEY };
       await axios.post(url, data, { headers });
   }
   ```

3. **Error Handling**
   - Failed plan additions are logged but don't block the checkout process
   - Retry mechanism for failed API calls
   - Error notifications for monitoring

#### 3. Environment Variables
Required environment variables in Netlify:
- `MEMBERSTACK_SECRET_KEY`: API key for Memberstack operations
- `MEMBERSTACK_LIFETIME_PLAN_ID`: Default plan ID for purchases

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
           prices: {
               de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
               en: 'price_1QT214JRMXFic4sWr5OXetuw',
               fr: 'price_1QT214JRMXFic4sWr5OXetuw',
               it: 'price_1QT206JRMXFic4sW78d5dEDO'
           },
           dimensions: {
               length: 25,
               width: 20,
               height: 2
           },
           shippingClass: 'standard'
       }
   };
   ```

2. **Shipping Rates**
   ```javascript
   const SHIPPING_RATES = {
       'shr_1QScKFJRMXFic4sW9e80ABBp': { 
           price: 0, 
           label: 'Österreich', 
           countries: ['AT']
       },
       'shr_1QScOlJRMXFic4sW8MHW0kq7': { 
           price: 20.36, 
           label: 'Europe', 
           countries: [
               'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
               'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
               'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
           ]
       },
       'shr_1QScMXJRMXFic4sWih6q9v36': { 
           price: 20.72, 
           label: 'Great Britain', 
           countries: ['GB']
       },
       'shr_1QScNqJRMXFic4sW3NVUUckl': { 
           price: 36.53, 
           label: 'Singapore', 
           countries: ['SG']
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

## Checkout System Documentation

### Overview
This document details the implementation of the Webflow + Memberstack + Stripe checkout system for Lille Big Hope. The system handles physical and digital products with country-specific shipping rates, tax calculations, and multi-language support.

### Core Components

#### 1. Frontend Implementation (`webflow-memberstack-checkout.js`)
- Handles user interactions and checkout flow
- Manages shipping rate selection
- Integrates with Memberstack for user authentication
- Communicates with Stripe for payment processing

#### 2. Backend Implementation (`create-checkout-session.js`)
- Serverless function hosted on Netlify
- Creates Stripe checkout sessions
- Handles shipping calculations
- Manages tax rates and calculations

### Key Features

#### Shipping Rates Configuration
```javascript
const SHIPPING_RATES = {
    'shr_1QScKFJRMXFic4sW9e80ABBp': { 
        price: 0, 
        label: 'Österreich', 
        countries: ['AT']
    },
    'shr_1QScOlJRMXFic4sW8MHW0kq7': { 
        price: 20.36, 
        label: 'Europe', 
        countries: [
            'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
        ]
    },
    'shr_1QScMXJRMXFic4sWih6q9v36': { 
        price: 20.72, 
        label: 'Great Britain', 
        countries: ['GB']
    },
    'shr_1QScNqJRMXFic4sW3NVUUckl': { 
        price: 36.53, 
        label: 'Singapore', 
        countries: ['SG']
    }
}
```

#### Multi-language Support
- Detects user's preferred language from Memberstack
- Supports DE, EN, FR, and IT
- Falls back to default language (DE) if preferred language not available

#### Product Configuration
- Supports both digital (course) and physical (book) products
- Each product type has specific configurations:
  - Language-specific prices
  - Shipping requirements
  - Weight information for physical products

### Recent Solutions

#### 1. Email Retrieval Fix
**Problem**: Checkout was failing due to incorrect email retrieval from Memberstack.
**Solution**: Updated the email retrieval path to correctly access the auth email:
```javascript
const member = await window.$memberstackDom?.getCurrentMember();
if (!member?.data) {
    throw new Error('Please log in to continue');
}
const email = member.data.auth?.email;
if (!email) {
    throw new Error('No email found in member data');
}
```

#### 2. European Shipping Countries Fix
**Problem**: When selecting "Europe" as shipping option, only Belgium was available in the shipping address form.
**Solution**:
1. Frontend Changes:
```javascript
// Updated shipping data handling
if (config.requiresShipping) {
    const countries = selectedRate.countries;
    if (!Array.isArray(countries) || countries.length === 0) {
        throw new Error('Invalid shipping countries configuration');
    }
    
    checkoutData.shippingCountries = countries;
    checkoutData.shippingRate = selectedRate.price;
    checkoutData.shippingLabel = selectedRate.label;
}
```

2. Backend Changes:
```javascript
shipping_address_collection: data.requiresShipping ? {
    allowed_countries: data.shippingCountries
} : undefined,
```

#### 3. Stripe Session ID Redirect Fix
**Problem**: The success URL redirect was not working correctly because the session ID was not being properly passed in the URL parameters.
**Solution**:
```javascript
// Before: Incorrect URL construction
success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,

// After: Fixed URL with proper template literal
success_url: `${window.location.origin}/success?session_id=${session.id}`,
```

### Error Handling
- Comprehensive error handling throughout the checkout process
- Clear error messages for common issues:
  - User not logged in
  - Missing email
  - Invalid shipping configuration
  - Invalid product type

### Testing Guidelines
1. Test checkout with different shipping countries:
   - Austria (free shipping)
   - European countries (€20.36)
   - Great Britain (€20.72)
   - Singapore (€36.53)
2. Verify language detection and pricing
3. Test both digital and physical products
4. Verify tax calculations for different countries

### Security Considerations
1. Email validation before checkout
2. User authentication check
3. Shipping country validation
4. Secure API endpoint handling
5. Protection against multiple form submissions

### Future Improvements
1. Add more detailed error logging
2. Implement retry mechanism for failed checkouts
3. Add support for more payment methods
4. Enhance shipping rate management interface
5. Implement order tracking system

### Tax Calculation System

#### Overview
The system uses Stripe's automatic tax calculation feature to handle VAT for different countries. Tax rates are automatically determined based on the customer's shipping address.

#### Implementation
```javascript
// Stripe checkout session configuration
const session = await stripe.checkout.sessions.create({
    // ... other configuration
    automatic_tax: {
        enabled: true
    },
    tax_id_collection: {
        enabled: true  // Allows customers to provide VAT IDs
    }
});
```

#### Tax Rates by Region
1. **Austria**
   - Standard VAT rate: 20%
   - Applied automatically for Austrian addresses

2. **European Union**
   - Country-specific VAT rates
   - Examples:
     - Germany: 19%
     - France: 20%
     - Italy: 22%

3. **Non-EU Countries**
   - No VAT applied
   - Handled automatically by Stripe

#### VAT ID Collection
- Business customers can provide VAT IDs
- VAT exemption applied when valid VAT ID provided
- Automatic validation through Stripe

#### Tax Calculation Process
1. Customer enters shipping address
2. Stripe automatically determines applicable tax rate
3. Tax is calculated on:
   - Product price
   - Shipping cost (tax_behavior: 'exclusive')
4. Total is displayed including tax

## Memberstack Integration

### API Version
The application uses Memberstack V1 API since it's integrated with Webflow. This is important to note for any data operations.

### Data Operations
When working with Memberstack data in Webflow, always use the V1 API methods:

```javascript
// Loading member data
const data = await window.$memberstackDom.getMemberJSON();
const memberData = data?.data || {};

// Updating member data
await window.$memberstackDom.updateMemberJSON({
    json: newData
});
```

Do NOT use V2 methods like:
- `member.getMetaData()`
- `member.updateMetaData()`

### Fallback Mechanism
The system includes a localStorage fallback when Memberstack is not available:
1. First attempts to use Memberstack for data storage
2. If Memberstack is unavailable, automatically falls back to localStorage
3. All operations are logged to console for debugging purposes

## Recipe and Shopping List System

### Overview
The recipe and shopping list functionality allows users to:
- Save recipes to their shopping list
- View and manage their shopping list
- Persist shopping list data across sessions

### Data Structure
```javascript
{
    shoppingList: [
        {
            title: "Recipe Title",
            ingredients: ["ingredient1", "ingredient2"],
            url: "recipe-page-url",
            timestamp: "ISO date string"
        }
    ]
}
```

### Key Components

#### recipe.js
- Handles saving recipes to the shopping list
- Manages recipe data formatting
- Implements cache-busting for page reloads
- Contains error handling and user feedback

```javascript
async function saveShoppingList(recipe) {
    // Load existing data
    const json = await $lbh.loadJson();
    // Add new recipe
    json.shoppingList.push(recipe);
    // Save and redirect
    await $lbh.updateJson(json);
}
```

#### shopping.js
- Manages the shopping list display
- Handles recipe removal
- Implements sorting and filtering
- Provides list management functions

### Error Handling
The system implements multiple layers of error handling:
1. Data validation before save operations
2. Fallback to localStorage if Memberstack fails
3. User-friendly error messages
4. Detailed console logging for debugging

### Best Practices
1. Always validate recipe data before saving
2. Use cache-busting when reloading pages
3. Implement proper error handling
4. Log operations for debugging
5. Handle offline scenarios gracefully
