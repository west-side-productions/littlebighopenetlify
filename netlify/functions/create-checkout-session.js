const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Shipping rate configuration
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
    'shr_1QScNqJRMXFic4sW3NVUUckl': { 
        price: 36.53, 
        label: 'Singapore', 
        countries: ['SG']
    },
    'shr_1QScOlJRMXFic4sW8MHW0kq7': { 
        price: 20.36, 
        label: 'European Union', 
        countries: [
            'BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'GR', 'ES', 'FR', 'HR', 
            'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'PL', 'PT', 'RO', 
            'SI', 'SK', 'FI', 'SE'
        ]
    }
};

// Product Configuration
const PRODUCT_CONFIG = {
    'physical-book': {
        id: 'prc_cookbook_physical',
        type: 'physical',
        requiresShipping: true,
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    },
    'digital': {
        id: 'prc_online-kochkurs-8b540kc2',
        type: 'digital',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        },
        requiresShipping: false
    }
};

// Helper function to validate shipping rate against country
const validateShippingRate = (shippingRateId) => {
    const rate = SHIPPING_RATES[shippingRateId];
    if (!rate) {
        throw new Error(`Invalid shipping rate: ${shippingRateId}`);
    }
    return rate;
};

exports.handler = async function(event, context) {
    // Log request details for debugging
    console.log('Incoming request details:', {
        method: event.httpMethod,
        path: event.path,
        headers: event.headers,
        bodyExists: !!event.body,
        bodyLength: event.body?.length
    });

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ 
                error: 'Method not allowed',
                allowedMethods: ['POST', 'OPTIONS']
            })
        };
    }

    try {
        console.log('Raw event body:', event.body);
        
        if (!event.body) {
            console.error('Request body is empty');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Request body is required' })
            };
        }

        let data;
        try {
            data = JSON.parse(event.body);
        } catch (e) {
            console.error('Failed to parse request body:', e);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        console.log('Parsed request data:', {
            rawData: data,
            dataType: typeof data,
            isNull: data === null,
            isObject: typeof data === 'object',
            hasVersion: 'version' in data,
            version: data.version,
            versionType: typeof data.version,
            allKeys: Object.keys(data),
            allValues: Object.entries(data).map(([k, v]) => `${k}: ${typeof v}`)
        });

        // Validate version field first
        if (!data.version) {
            console.error('Missing version field:', {
                data,
                hasVersion: 'version' in data,
                versionValue: data.version
            });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required field: version' })
            };
        }

        // Get product configuration based on version
        const productConfig = PRODUCT_CONFIG[data.version];
        if (!productConfig) {
            console.error(`Invalid version: ${data.version}`, {
                availableVersions: Object.keys(PRODUCT_CONFIG),
                receivedVersion: data.version
            });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `Invalid version: ${data.version}` })
            };
        }

        // Validate other required fields
        const requiredFields = ['customerEmail', 'language'];
        for (const field of requiredFields) {
            if (!data[field]) {
                console.error(`Missing required field: ${field}`, {
                    fieldValue: data[field],
                    fieldExists: field in data,
                    fieldType: typeof data[field]
                });
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Missing required field: ${field}` })
                };
            }
        }

        // Get price ID based on product type and language
        const language = data.language || 'de';
        const priceId = productConfig.prices[language];
        if (!priceId) {
            throw new Error(`No price found for product ${data.version} in language ${language}`);
        }

        // Determine product type from metadata
        const isDigitalProduct = productConfig.type === 'digital';
        const requiresShipping = productConfig.requiresShipping === true;
        
        // Only require shipping rate for physical products that require shipping
        let shippingRate = null;
        let countryCode = 'DE'; // Default for digital products

        if (requiresShipping) {
            if (!data.shippingRateId) {
                throw new Error('Please select a shipping option');
            }
            // Validate shipping rate for physical products
            shippingRate = validateShippingRate(data.shippingRateId);
            countryCode = shippingRate.countries[0];
        }

        // Create metadata object
        const metadata = {
            ...data.metadata,
            source: data.metadata.source || 'checkout',
            countryCode: countryCode,
            language: data.language || 'de'
        };

        console.log('Creating checkout session with metadata:', metadata);

        // Create session configuration
        const sessionConfig = {
            payment_method_types: ['card'],
            customer_email: data.customerEmail,
            line_items: [{
                price: priceId,
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${data.successUrl || 'https://www.littlebighope.com/vielen-dank-email'}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: data.cancelUrl || 'https://www.littlebighope.com/produkte',
            metadata: metadata,
            payment_intent_data: {
                metadata: metadata
            },
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            locale: data.language || 'de'
        };

        // Add shipping options only for products that require shipping
        if (requiresShipping && data.shippingRateId) {
            const shippingRate = validateShippingRate(data.shippingRateId);
            sessionConfig.shipping_address_collection = {
                allowed_countries: shippingRate.countries
            };
            sessionConfig.shipping_options = [{
                shipping_rate: data.shippingRateId
            }];
        }

        console.log('Creating Stripe session with config:', sessionConfig);
        const session = await stripe.checkout.sessions.create(sessionConfig);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                sessionId: session.id,
                publishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
            })
        };

    } catch (error) {
        console.error('Stripe session creation failed:', error);
        return {
            statusCode: error.statusCode || 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                type: error.type,
                code: error.code
            })
        };
    }
};
