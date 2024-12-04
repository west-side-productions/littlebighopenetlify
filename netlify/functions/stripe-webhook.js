const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

const MEMBERSTACK_API_URL = 'https://api.memberstack.com/v1';

exports.handler = async (event) => {
    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }

        console.log('Webhook received:', {
            headers: event.headers,
            body: event.body ? event.body.substring(0, 500) : null // Log first 500 chars to avoid huge logs
        });

        const sig = event.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let stripeEvent;
        
        try {
            stripeEvent = Stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
            console.log('Stripe event constructed:', {
                type: stripeEvent.type,
                id: stripeEvent.id
            });
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
            };
        }

        // Handle the event
        switch (stripeEvent.type) {
            case 'checkout.session.completed':
                const session = stripeEvent.data.object;
                console.log('Processing checkout.session.completed:', {
                    sessionId: session.id,
                    metadata: session.metadata
                });
                
                try {
                    const { memberstackUserId, planId: memberstackPlanId, countryCode } = session.metadata;
                    
                    console.log('Session metadata:', session.metadata);
                    console.log('Extracted data:', { memberstackUserId, memberstackPlanId, countryCode });
                    
                    if (!memberstackUserId || !memberstackPlanId) {
                        throw new Error('Missing required metadata: memberstackUserId or planId');
                    }

                    // Add plan to member using Memberstack REST API
                    console.log('Adding plan to Memberstack:', {
                        memberId: memberstackUserId,
                        planId: memberstackPlanId
                    });

                    const response = await axios({
                        method: 'POST',
                        url: `${MEMBERSTACK_API_URL}/members/${memberstackUserId}/add-plan`,
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
                        },
                        data: {
                            planId: memberstackPlanId,
                            status: 'ACTIVE',
                            type: 'ONETIME'
                        }
                    });

                    console.log('Memberstack plan addition response:', response.data);

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
                    return {
                        statusCode: 500,
                        body: JSON.stringify({ 
                            error: error.message,
                            details: error.response?.data || error.stack
                        })
                    };
                }
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
                    body: JSON.stringify({ received: true, type: stripeEvent.type })
                };
        }
    } catch (error) {
        console.error('Webhook handler error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
