const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

// Memberstack 2.0 API URL for Webflow integration
const MEMBERSTACK_API_URL = 'https://api.memberstack.com/v2';

exports.handler = async (event) => {
    console.log('Webhook endpoint hit:', {
        method: event.httpMethod,
        path: event.path,
        headers: Object.keys(event.headers) // Log header keys to verify stripe-signature
    });

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            }
        };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
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
            console.error('Webhook signature verification failed:', {
                error: err.message,
                sig: sig ? 'present' : 'missing',
                secret: endpointSecret ? 'present' : 'missing'
            });
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: `Webhook Error: ${err.message}`,
                    details: 'Signature verification failed'
                })
            };
        }

        // Handle the event
        switch (stripeEvent.type) {
            case 'checkout.session.completed':
                console.log('Processing checkout.session.completed event');
                const session = stripeEvent.data.object;
                
                try {
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

                    // Add plan to member using Memberstack API
                    const memberstackUrl = `${MEMBERSTACK_API_URL}/members/${memberstackUserId}/plans/${memberstackPlanId}`;
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
                                status: 'active'
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
            body: JSON.stringify({ 
                error: error.message,
                details: error.stack
            })
        };
    }
};
