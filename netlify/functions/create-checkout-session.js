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
    'course': {
        id: 'prc_course_digital',
        versions: {
            'digital': {
                requiresShipping: false,
                prices: {
                    de: 'price_1QTSN6JRMXFic4sW9sklILhd',
                    en: 'price_1QTSN6JRMXFic4sW9sklILhd',
                    fr: 'price_1QTSN6JRMXFic4sW9sklILhd',
                    it: 'price_1QTSN6JRMXFic4sW9sklILhd'
                }
            }
        }
    },
    'book': {
        id: 'prc_cookbook_physical',
        versions: {
            'physical-book': {
                requiresShipping: true,
                prices: {
                    de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
                    en: 'price_1QT214JRMXFic4sWr5OXetuw',
                    fr: 'price_1QT214JRMXFic4sWr5OXetuw',
                    it: 'price_1QT206JRMXFic4sW78d5dEDO'
                }
            }
        }
    },
    'bundle': {
        id: 'prc_bundle_physical',
        versions: {
            'physical-book': {
                requiresShipping: true,
                prices: {
                    de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
                    en: 'price_1QT214JRMXFic4sWr5OXetuw',
                    fr: 'price_1QT214JRMXFic4sWr5OXetuw',
                    it: 'price_1QT206JRMXFic4sW78d5dEDO'
                }
            }
        }
    },
    'free-plan': {
        id: 'prc_free_digital',
        versions: {
            'digital': {
                requiresShipping: false,
                prices: {}
            }
        }
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
            hasVersion: 'productVersion' in data,
            version: data.productVersion,
            versionType: typeof data.productVersion,
            allKeys: Object.keys(data),
            allValues: Object.entries(data).map(([k, v]) => `${k}: ${typeof v}`)
        });

        // Validate version field first
        if (!data.productVersion) {
            console.error('Missing version field:', {
                data,
                hasVersion: 'productVersion' in data,
                versionValue: data.productVersion
            });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required field: productVersion' })
            };
        }

        // Validate product type
        if (!data.type || !PRODUCT_CONFIG[data.type]) {
            console.error('Invalid or missing product type:', data.type);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid or missing product type' })
            };
        }

        // Get product configuration based on type and version
        const productConfig = PRODUCT_CONFIG[data.type].versions[data.productVersion];
        if (!productConfig) {
            console.error(`Invalid version: ${data.productVersion} for type: ${data.type}`, {
                availableVersions: Object.keys(PRODUCT_CONFIG[data.type].versions),
                receivedVersion: data.productVersion
            });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `Invalid version: ${data.productVersion} for type: ${data.type}` })
            };
        }

        // Validate other required fields
        const requiredFields = ['customerEmail', 'language'];
        for (const field of requiredFields) {
            if (!data[field]) {
                console.error(`Missing required field: ${field}`, {
                    fieldValue: data[field],
                    data
                });
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Missing required field: ${field}` })
                };
            }
        }

        // Prepare Stripe session creation
        const sessionParams = {
            payment_method_types: ['card'],
            line_items: [{
                price: productConfig.prices[data.language],
                quantity: 1
            }],
            mode: 'payment',
            success_url: data.successUrl,
            cancel_url: data.cancelUrl,
            metadata: data.metadata
        };

        if (productConfig.requiresShipping) {
            sessionParams.shipping_address_collection = {
                allowed_countries: SHIPPING_RATES[data.shippingRateId]?.countries || []
            };
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ id: session.id })
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
