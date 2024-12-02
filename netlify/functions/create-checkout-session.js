const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
    maxNetworkRetries: 2,
    timeout: 20000,
    host: 'api.stripe.com',
    protocol: 'https',
    telemetry: false
});

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '2592000',
    'Content-Type': 'application/json'
};

// Error response helper
const errorResponse = (statusCode, message, details = null) => ({
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({
        error: message,
        details: details || message
    })
});

// Success response helper
const successResponse = (data) => ({
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(data)
});

exports.handler = async (event, context) => {
    console.log('Request received:', {
        method: event.httpMethod,
        path: event.path,
        headers: event.headers,
        body: event.body ? JSON.parse(event.body) : null
    });

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
        return errorResponse(405, 'Method not allowed');
    }

    try {
        // Parse and validate request body
        let data;
        try {
            data = JSON.parse(event.body);
        } catch (e) {
            return errorResponse(400, 'Invalid JSON payload');
        }

        const { priceId, quantity, successUrl, cancelUrl, customerEmail, shipping, metadata } = data;

        // Validate required fields
        if (!priceId || !successUrl || !cancelUrl || !customerEmail || !shipping) {
            return errorResponse(400, 'Missing required parameters', {
                received: { priceId, successUrl, cancelUrl, customerEmail, shipping }
            });
        }

        // Find or create customer
        let customer;
        try {
            const customers = await stripe.customers.list({
                email: customerEmail,
                limit: 1
            });
            
            customer = customers.data.length > 0 
                ? customers.data[0] 
                : await stripe.customers.create({
                    email: customerEmail,
                    metadata: {
                        memberstackUserId: metadata?.memberstackUserId
                    }
                });
        } catch (error) {
            console.error('Error managing customer:', error);
            return errorResponse(500, 'Failed to manage customer', error.message);
        }

        console.log('Creating checkout session:', { 
            priceId,
            quantity,
            customerId: customer.id,
            shipping,
            metadata 
        });

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customer.id,
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price: priceId,
                    quantity: parseInt(quantity) || 1
                }
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            shipping_address_collection: {
                allowed_countries: ['AT', 'DE', 'CH']
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: shipping.weight <= 1000 ? 500 : 1000,
                            currency: 'eur',
                        },
                        display_name: shipping.weight <= 1000 ? 'Standard Shipping' : 'Heavy Item Shipping',
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
            ],
            metadata: {
                memberstackUserId: metadata?.memberstackUserId,
                memberstackPlanId: metadata?.memberstackPlanId,
                totalWeight: `${shipping.weight + shipping.packagingWeight}g`,
                productWeight: `${shipping.weight}g`,
                packagingWeight: `${shipping.packagingWeight}g`
            },
            payment_intent_data: {
                metadata: {
                    memberstackUserId: metadata?.memberstackUserId,
                    memberstackPlanId: metadata?.memberstackPlanId,
                    totalWeight: `${shipping.weight + shipping.packagingWeight}g`,
                    productWeight: `${shipping.weight}g`,
                    packagingWeight: `${shipping.packagingWeight}g`
                }
            },
            allow_promotion_codes: true,
            customer_update: {
                address: 'auto',
                shipping: 'auto'
            },
            locale: 'de'
        });

        console.log('Checkout session created:', session.id);
        return successResponse({
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        return errorResponse(500, 'Failed to create checkout session', error.message);
    }
};
