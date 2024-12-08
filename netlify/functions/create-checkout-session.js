const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Configure CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Product configuration
const PRODUCT_CONFIG = {
    book: {
        prices: {
            en: process.env.STRIPE_PRICE_ID_BOOK_EN,
            de: process.env.STRIPE_PRICE_ID_BOOK_DE
        },
        requiresShipping: true
    },
    ebook: {
        prices: {
            en: process.env.STRIPE_PRICE_ID_EBOOK_EN,
            de: process.env.STRIPE_PRICE_ID_EBOOK_DE
        },
        requiresShipping: false
    }
};

exports.handler = async (event, context) => {
    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers
        };
    }

    try {
        if (event.httpMethod !== 'POST') {
            throw new Error('Method not allowed');
        }

        // Parse and validate the request body
        const data = JSON.parse(event.body);
        console.log('Received checkout request:', data);

        if (!data.type || !data.language) {
            throw new Error('Missing required fields: type and language are required');
        }

        // Validate product type
        const product = PRODUCT_CONFIG[data.type];
        if (!product) {
            throw new Error(`Invalid product type: ${data.type}`);
        }

        // Validate language
        if (!product.prices[data.language]) {
            throw new Error(`Invalid language: ${data.language} for product type: ${data.type}`);
        }

        // Construct line items
        const lineItems = [{
            price: product.prices[data.language],
            quantity: 1
        }];

        // Prepare session parameters
        const sessionParams = {
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_URL}/cancel`,
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            metadata: {
                productType: data.type,
                language: data.language,
                ...(data.metadata || {})
            }
        };

        // Add shipping options if product requires shipping
        if (product.requiresShipping) {
            sessionParams.shipping_address_collection = {
                allowed_countries: ['DE', 'AT', 'CH', 'US', 'GB']
            };
            
            if (data.shippingRateId) {
                sessionParams.shipping_options = [{
                    shipping_rate: data.shippingRateId
                }];
            }
        }

        console.log('Creating checkout session with params:', sessionParams);

        // Create the checkout session
        const session = await stripe.checkout.sessions.create(sessionParams);

        console.log('Checkout session created:', session.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                id: session.id
            })
        };

    } catch (error) {
        console.error('Error creating checkout session:', error);
        return {
            statusCode: error.statusCode || 500,
            headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};
