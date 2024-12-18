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
  - stack SDK
  - Custom language utilities
  - Browser APIs (localStorage, navigator)

### 2. Checkout System (webflow-memberstack-checkout.js)
- **Core Components**
  1. Product Configuration
  2. Shipping Calculator
  3. Stripe Integration
  4. Error Handling

#### Recent Updates (December 2024)
- **Shipping Selector Improvements**
  1. Fixed duplicate ID issues in shipping selects
  2. Implemented language-based default shipping rates:
     - English: European Union rate (`shr_1QScOlJRMXFic4sW8MHW0kq7`)
     - Other languages: Austrian rate (`shr_1QScKFJRMXFic4sW9e80ABBp`)
  3. Added synchronization between shipping selects for consistent user experience
  4. Enhanced error logging and debugging capabilities
  5. Improved shipping rate initialization based on detected language

- **Non-Logged In User Flow**
  1. User clicks checkout button on product page
  2. System stores checkout configuration in localStorage:
     ```javascript
     localStorage.setItem('checkoutConfig', JSON.stringify({
         productType: productType,
         shippingRateId: shippingRateId
     }));
     localStorage.setItem('checkoutRedirectUrl', currentPath + queryParams);
     ```
  3. User is redirected to registration page (`/registrieren`)
  4. After successful registration and verification:
     - User is redirected to `/membershome`
     - System checks for stored checkout configuration
     - If found, automatically initiates checkout process
     - Clears stored configuration after successful checkout

- **Checkout Flow**
  1. User selects product (book, course, or bundle)
  2. For physical products:
     - Shipping country selection
     - Shipping rate selection (defaults based on language)
  3. If user is not logged in:
     - Store checkout configuration
     - Redirect to registration
     - Auto-resume checkout after verification
  4. Create Stripe checkout session with:
     - Product configuration
     - Shipping details (if applicable)
     - Language preference
     - Memberstack user ID
  5. Redirect to Stripe checkout
  6. On successful payment:
     - Assign Memberstack plan
     - Send confirmation emails
     - Send shipping notification (if physical product)

- **Language-Based Shipping Logic**
  ```javascript
  // Default shipping rate selection based on language
  const defaultShippingRate = currentLang === 'en' ? 
      'shr_1QScOlJRMXFic4sW8MHW0kq7' : // EU rate for English
      'shr_1QScKFJRMXFic4sW9e80ABBp'; // Austrian rate for others
  ```

- **Shipping Select Implementation**
  1. Unique IDs for each shipping select based on product type
  2. Automatic synchronization between bundle and book shipping selects
  3. Proper initialization of shipping rates on page load
  4. Enhanced error handling and logging for shipping rate changes

### 3. Product and Plan Configuration
- **Product Types**:
  1. **Course (Digital)**
     - No shipping required
     - Memberstack Plan: `prc_online-kochkurs-8b540kc2`
     - Available in multiple languages with different price points
  
  2. **Book (Physical)**
     - Requires shipping
     - Weight: 1005g + 156g packaging
     - Memberstack Plan: `prc_kurs-buch-s29u04fs`
     - Available in multiple languages
     - Default shipping rates vary by language:
       - English: EU shipping rate
       - Others: Austrian shipping rate
  
  3. **Bundle (Book + Course)**
     - Combines both physical book and digital course
     - Weight: Same as book (1005g + 156g packaging)
     - Automatic €14 discount applied
     - Memberstack Plan: `prc_lbh-kurs-buch-tjcb0624`
     - Combines both products with special pricing
     - Inherits language-based shipping rate defaults

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

2. **Language Impact on Shipping**:
   - English site visitors default to EU shipping rates
   - Other language visitors default to Austrian shipping rates
   - Shipping rates can still be manually changed by users
   - Changes are synchronized across all shipping selects

## Email System

### Architecture
1. **Netlify Functions**
   - Location: `/netlify/functions/`
   - Key Components:
     - `stripe-webhook.js`: Handles Stripe events and Memberstack plan assignment
     - `email-templates/`: Language-specific templates

2. **Email Service Integration**
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   ```

3. **Template System**
   - HTML templates with consistent styling
   - Language-specific templates in `/email-templates/[language].js`
   - Fallback to German (de) if language not found
   - Clean, white background design
   - Logo embedded as inline attachment
   - Responsive design for mobile devices

### Order Email System
1. **Email Types**
   - `orderConfirmation`: Sent to customer after successful purchase
   - `orderNotification`: Sent to shipping company for physical products

2. **Email Template Features**
   - Consistent branding with logo in header
   - Clean white background
   - Responsive design
   - Clear section separation
   - Order details in tabular format
   - Shipping information for physical products

3. **Logo Implementation**
   ```javascript
   // Logo is fetched from Webflow CDN and attached to emails
   const LOGO_URL = 'https://cdn.prod.website-files.com/66fe7e7fc06ec10a17ffa57f/67609d5ffc9ced97f9c15adc_lbh_logo_rgb.png';
   
   // Fetch and encode for email attachment
   const encodedLogo = await getEncodedLogo();
   const attachments = [{
       content: encodedLogo,
       filename: 'logo.png',
       type: 'image/png',
       disposition: 'inline',
       content_id: 'logo'
   }];
   ```

### Plan Management
1. **Product Types and Plans**
   - Course (Digital)
     - Plan ID: `pln_bundle-rd004n7`
     - No shipping required
   - Book (Physical)
     - Plan ID: `pln_kostenloser-zugang-84l80t3u`
     - Requires shipping
   - Bundle (Book + Course)
     - Plan ID: `pln_bundle-rd004n7`
     - Requires shipping
     - Includes both physical and digital components

2. **Plan Assignment Process**
   ```javascript
   // Plans are assigned based on product type
   if (session.metadata.type === 'bundle') {
       await addPlanToMember(session.metadata.memberstackUserId, session.metadata.memberstackPlanId);
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
          memberstackPlanId: 'prc_online-kochkurs-8b540kc2'
      },
      'book': {
          memberstackPlanId: 'prc_kurs-buch-s29u04fs'
      },
      'bundle': {
          memberstackPlanId: 'prc_lbh-kurs-buch-tjcb0624'
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

```
