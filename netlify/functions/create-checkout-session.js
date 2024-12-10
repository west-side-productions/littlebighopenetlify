const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Configure CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Product Configuration
const PRODUCT_CONFIG = {
    'course': {
        id: 'prc_online-kochkurs-8b540kc2',
        type: 'digital',
        weight: 0,
        packagingWeight: 0,
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
        type: 'physical',
        weight: 1005,
        packagingWeight: 152,
        requiresShipping: true,
        dimensions: {
            length: 25,
            width: 20,
            height: 2
        },
        shippingClass: 'standard',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    },
    'bundle': {
        id: 'prc_cookbook_bundle',
        type: 'bundle',
        weight: 1157,
        packagingWeight: 200,
        requiresShipping: true,
        dimensions: {
            length: 25,
            width: 20,
            height: 2
        },
        shippingClass: 'standard',
        prices: {
            de: 'price_1QT1vTJRMXFic4sWBPxcmlEZ',
            en: 'price_1QT214JRMXFic4sWr5OXetuw',
            fr: 'price_1QT214JRMXFic4sWr5OXetuw',
            it: 'price_1QT206JRMXFic4sW78d5dEDO'
        }
    }
};

// Validation functions
function validateEmail(email) {
    return email && email.includes('@') && email.includes('.');
}

function validateLocale(locale) {
    return ['de', 'en', 'fr', 'it'].includes(locale);
}

function validateUrls(successUrl, cancelUrl) {
    try {
        new URL(successUrl);
        new URL(cancelUrl);
        return true;
    } catch (error) {
        return false;
    }
}

exports.handler = async (event, context) => {
    // Log request details (excluding sensitive data)
    console.log('Request:', {
        method: event.httpMethod,
        path: event.path,
        headers: event.headers
    });

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers
        };
    }

    // Ensure POST method
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse request body
        const data = JSON.parse(event.body);
        console.log('Request data:', {
            priceId: data.priceId,
            language: data.language,
            requiresShipping: data.requiresShipping,
            metadata: { ...data.metadata, customerEmail: '***' }
        });

        // Validate required fields
        if (!data.priceId) throw new Error('Missing price ID');
        if (!data.customerEmail) throw new Error('Missing customer email');
        if (!validateEmail(data.customerEmail)) throw new Error('Invalid email format');
        if (!data.successUrl || !data.cancelUrl) throw new Error('Missing success or cancel URLs');
        if (!validateUrls(data.successUrl, data.cancelUrl)) throw new Error('Invalid URLs provided');
        if (!validateLocale(data.language)) throw new Error('Invalid language');

        const lineItems = [{
            price: data.priceId,
            quantity: 1
        }];

        // Create checkout session with proper shipping and tax handling
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'sofort', 'giropay', 'eps'],
            line_items: lineItems,
            mode: 'payment',
            success_url: data.successUrl,
            cancel_url: data.cancelUrl,
            customer_email: data.customerEmail,
            locale: data.language || 'de',
            metadata: {
                ...data.metadata,
                language: data.language
            },
            shipping_address_collection: data.requiresShipping ? {
                allowed_countries: [data.shippingCountry] // Only allow the pre-selected country
            } : undefined,
            shipping_options: data.requiresShipping ? [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: data.shippingRate * 100, // Convert to cents
                            currency: 'eur',
                        },
                        display_name: data.shippingLabel || 'Standard shipping',
                        tax_behavior: 'exclusive', // Tax will be calculated separately
                        delivery_estimate: {
                            minimum: {
                                unit: 'business_day',
                                value: 3,
                            },
                            maximum: {
                                unit: 'business_day',
                                value: 5,
                            },
                        },
                    },
                }
            ] : undefined,
            automatic_tax: {
                enabled: true
            },
            tax_id_collection: {
                enabled: true
            }
        });

        console.log('Session created:', { id: session.id });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(session)
        };
    } catch (error) {
        console.error('Error:', error);

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};