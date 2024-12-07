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
        price: 728, 
        label: 'Österreich', 
        countries: ['AT']
    },
    'shr_1QScMXJRMXFic4sWih6q9v36': { 
        price: 2072, 
        label: 'Great Britain', 
        countries: ['GB']
    },
    'shr_1QScNqJRMXFic4sW3NVUUckl': { 
        price: 3500, 
        label: 'Singapore', 
        countries: ['SG']
    },
    'shr_1QScOlJRMXFic4sW8MHW0kq7': { 
        price: 2036, 
        label: 'European Union', 
        countries: ['BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
    }
};

// Product Configuration
const PRODUCT_CONFIG = {
    'course': {
        id: 'prc_course_digital',
        type: 'course',
        requiresShipping: false,
        prices: {
            de: 'price_1QTSN6JRMXFic4sW9sklILhd',
            en: 'price_1QTSN6JRMXFic4sW9sklILhd',
            fr: 'price_1QTSN6JRMXFic4sW9sklILhd',
            it: 'price_1QTSN6JRMXFic4sW9sklILhd'
        }
    },
    'book': {
        id: 'prc_cookbook_physical',
        type: 'book',
        requiresShipping: true,
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    },
    'bundle': {
        id: 'prc_bundle_physical',
        type: 'bundle',
        requiresShipping: true,
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    },
    'free-plan': {
        id: 'prc_free_digital',
        type: 'free-plan',
        requiresShipping: false,
        prices: {}
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

        console.log('Received request data:', {
            rawBody: event.body,
            parsedData: data,
            hasType: 'type' in data,
            hasProductType: 'productType' in data,
            type: data.type,
            productType: data.productType
        });

        // Validate product type (check both type and productType)
        const productType = data.metadata?.productType || data.metadata?.type || data.type;
        if (!productType || !PRODUCT_CONFIG[productType]) {
            console.error('Invalid or missing product type:', { 
                productType,
                metadata: data.metadata,
                availableTypes: Object.keys(PRODUCT_CONFIG)
            });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid or missing product type' })
            };
        }

        // Get product configuration
        const productConfig = PRODUCT_CONFIG[productType];
        
        // Create session configuration with shipping based on selection
        const sessionParams = {
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [{
                price: data.priceId,
                quantity: 1
            }],
            metadata: {
                version: data.version,
                ...data.metadata,
                source: data.metadata?.source || 'checkout',
                language: data.language || 'de'
            },
            success_url: `${process.env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_URL}/cancel`,
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            locale: data.language || 'de'
        };

        // Add shipping options based on selected shipping rate
        if (productConfig.requiresShipping && data.shippingRateId) {
            // Get shipping rate from configuration
            const shippingRate = SHIPPING_RATES[data.shippingRateId];
            if (!shippingRate) {
                throw new Error(`Invalid shipping rate: ${data.shippingRateId}`);
            }

            // Set shipping configuration based on selected rate
            sessionParams.shipping_address_collection = {
                allowed_countries: shippingRate.countries
            };
            sessionParams.shipping_options = [{
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                        amount: shippingRate.price,
                        currency: 'eur',
                    },
                    display_name: `Standard Shipping (${shippingRate.label})`,
                    delivery_estimate: {
                        minimum: {
                            unit: 'business_day',
                            value: shippingRate.label === 'Singapore' ? 7 : shippingRate.label === 'Österreich' ? 3 : 5,
                        },
                        maximum: {
                            unit: 'business_day',
                            value: shippingRate.label === 'Singapore' ? 14 : shippingRate.label === 'Österreich' ? 5 : 7,
                        },
                    }
                }
            }];
        }

        console.log('Creating Stripe session with params:', JSON.stringify(sessionParams, null, 2));
        const session = await stripe.checkout.sessions.create(sessionParams);
        console.log('Created Stripe session:', session.id);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                sessionId: session.id,
                publishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
            })
        };

    } catch (error) {
        console.error('Error creating checkout session:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
