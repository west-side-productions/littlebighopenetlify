const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
    // Log request details for debugging
    console.log('Request details:', {
        method: event.httpMethod,
        headers: event.headers,
        path: event.path
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
        const data = JSON.parse(event.body);
        console.log('Received checkout request:', data);

        // Validate required fields
        if (!data.priceId) {
            throw new Error('Missing required field: priceId');
        }

        // Function to get shipping cost based on country
        const getShippingCost = (country) => {
            switch(country) {
                case 'AT':
                    return {
                        amount: 728,
                        delivery_min: 3,
                        delivery_max: 5
                    };
                case 'GB':
                    return {
                        amount: 2072,
                        delivery_min: 5,
                        delivery_max: 7
                    };
                case 'SG':
                    return {
                        amount: 3653,
                        delivery_min: 7,
                        delivery_max: 10
                    };
                default:
                    return {
                        amount: 2036,  // EU rate
                        delivery_min: 5,
                        delivery_max: 7
                    };
            }
        };

        // Get shipping details based on the shipping country
        const shippingDetails = getShippingCost(data.shippingAddress?.country || 'DE');

        // Create Stripe checkout session with enhanced configuration
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            locale: 'de',
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            shipping_address_collection: {
                allowed_countries: ['AT', 'GB', 'SG', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
                    'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
            },
            automatic_tax: { enabled: false },
            shipping_cost: {
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                        amount: shippingDetails.amount,
                        currency: 'eur',
                    },
                    display_name: 'Shipping',
                    delivery_estimate: {
                        minimum: { unit: 'business_day', value: shippingDetails.delivery_min },
                        maximum: { unit: 'business_day', value: shippingDetails.delivery_max }
                    },
                    tax_behavior: 'exclusive'
                }
            },
            line_items: [{
                price: data.priceId,
                quantity: data.quantity || 1,
                adjustable_quantity: {
                    enabled: true,
                    minimum: 1,
                    maximum: 10,
                },
            }],
            success_url: data.successUrl || process.env.SUCCESS_URL || `${process.env.URL}/success`,
            cancel_url: data.cancelUrl || process.env.CANCEL_URL || `${process.env.URL}/cancel`,
            customer_email: data.customerEmail,
            metadata: {
                ...data.metadata,
                source: 'webflow_checkout'
            },
            custom_text: {
                shipping_address: {
                    message: 'Please note: We currently only ship to Austria and Germany.',
                },
                submit: {
                    message: 'We will process your order within 24 hours.',
                },
            },
        });

        console.log('Created checkout session:', session.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ sessionId: session.id })
        };

    } catch (error) {
        console.error('Checkout error:', error);
        
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
