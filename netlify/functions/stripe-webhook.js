const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

// Memberstack API URL for Webflow integration
const MEMBERSTACK_API_URL = 'https://api.memberstack.com/v1';

// CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Shipping rate calculation
function calculateShippingRate(country) {
    if (!country?.trim()) {
        throw new Error('Country code is required and cannot be empty');
    }
    
    const countryCode = country.toUpperCase();
    console.log(`Calculating shipping for country: ${countryCode}`);
    
    // Define shipping rates
    const SHIPPING_RATES = {
        AT: { price: 500, label: "Austria Shipping" },
        DE: { price: 1000, label: "Germany Shipping" },
        EU: { price: 1000, label: "Europe Shipping" }
    };

    // EU country list
    const EU_COUNTRIES = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];

    if (countryCode === 'AT') return SHIPPING_RATES.AT;
    if (countryCode === 'DE') return SHIPPING_RATES.DE;
    if (EU_COUNTRIES.includes(countryCode)) return SHIPPING_RATES.EU;

    throw new Error(`No shipping rate available for country: ${countryCode}`);
}

exports.handler = async (event) => {
    console.log('Webhook endpoint hit:', {
        method: event.httpMethod,
        path: event.path,
        headers: Object.keys(event.headers)
    });

    // Add comprehensive validation
    if (!event.body) {
        console.error('Missing request body');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: 'Invalid request',
                details: 'Request body is required'
            })
        };
    }

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers
        };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        console.log('Raw webhook body:', event.body);
        
        const sig = event.headers['stripe-signature'];
        console.log('Stripe signature:', sig ? sig.substring(0, 20) + '...' : 'missing');
        
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        console.log('Environment check:', {
            stripeKey: !!process.env.STRIPE_SECRET_KEY,
            webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
            memberstackKey: !!process.env.MEMBERSTACK_SECRET_KEY,
            webhookSecretPrefix: endpointSecret ? endpointSecret.substring(0, 8) : 'missing'
        });

        let stripeEvent;
        try {
            stripeEvent = Stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
            console.log('Stripe event constructed:', {
                type: stripeEvent.type,
                id: stripeEvent.id
            });
        } catch (err) {
            console.error('Error constructing webhook event:', err);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
            };
        }

        // Handle the event
        switch (stripeEvent.type) {
            case 'checkout.session.completed':
                console.log('Processing checkout.session.completed event');
                const session = stripeEvent.data.object;
                
                // Validate shipping information
                if (!session.shipping?.address?.country) {
                    console.error('Missing shipping country');
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            error: 'Invalid shipping',
                            details: 'Shipping country is required'
                        })
                    };
                }

                try {
                    // Calculate shipping rate for the country
                    const shippingRate = calculateShippingRate(session.shipping.address.country);
                    console.log('Calculated shipping rate:', shippingRate);

                    const { memberstackUserId, planId: memberstackPlanId, countryCode } = session.metadata;
                    
                    console.log('Extracted metadata:', {
                        memberstackUserId,
                        memberstackPlanId,
                        countryCode,
                        sessionId: session.id,
                        allMetadata: session.metadata
                    });

                    if (!memberstackUserId || !memberstackPlanId) {
                        throw new Error('Missing required metadata: memberstackUserId or planId');
                    }

                    // Add plan to member using Memberstack API for Webflow
                    const memberstackUrl = `${MEMBERSTACK_API_URL}/member/add-plan`;
                    console.log('Calling Memberstack API:', {
                        url: memberstackUrl,
                        planId: memberstackPlanId,
                        memberId: memberstackUserId
                    });

                    try {
                        const response = await axios({
                            method: 'POST',
                            url: memberstackUrl,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
                            },
                            data: {
                                planId: memberstackPlanId,
                                memberId: memberstackUserId,
                                status: 'ACTIVE'
                            }
                        });

                        console.log('Memberstack API response:', {
                            status: response.status,
                            data: response.data
                        });

                        if (!response.data || response.status !== 200) {
                            throw new Error('Unexpected response from Memberstack API');
                        }
                    } catch (memberstackError) {
                        console.error('Memberstack API error:', {
                            message: memberstackError.message,
                            response: memberstackError.response?.data,
                            status: memberstackError.response?.status
                        });
                        throw memberstackError;
                    }

                    // Process shipping information
                    console.log('Processing shipping...');
                    try {
                        const shippingResponse = await axios({
                            method: 'POST',
                            url: '/.netlify/functions/process-shipping',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            data: JSON.stringify({
                                countryCode: countryCode,
                                memberId: memberstackUserId,
                                sessionId: session.id
                            })
                        });

                        console.log('Shipping processed:', shippingResponse.data);
                    } catch (shippingError) {
                        console.error('Shipping process failed:', {
                            error: shippingError.message,
                            response: shippingError.response?.data
                        });
                        // Continue even if shipping fails
                    }

                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({ 
                            received: true,
                            memberstackUserId,
                            memberstackPlanId,
                            countryCode
                        })
                    };
                } catch (error) {
                    console.error('Error processing webhook:', {
                        message: error.message,
                        response: error.response?.data,
                        stack: error.stack
                    });
                    throw error; // Re-throw to be caught by outer try-catch
                }
                break;  
            
            case 'payment_intent.payment_failed':
                const paymentIntent = stripeEvent.data.object;
                console.error('Payment failed:', {
                    customer: paymentIntent.customer,
                    error: paymentIntent.last_payment_error
                });
                break;
            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        received: true, 
                        type: stripeEvent.type 
                    })
                };
        }
    } catch (error) {
        console.error('Webhook handler error:', {
            message: error.message,
            stack: error.stack
        });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                details: error.stack
            })
        };
    }
};
