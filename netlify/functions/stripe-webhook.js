const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

const MEMBERSTACK_API_URL = 'https://api.memberstack.com/v1';

exports.handler = async (event) => {
    try {
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }

        const sig = event.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let stripeEvent;
        
        try {
            stripeEvent = Stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
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
                
                try {
                    // Get member ID and plan ID from metadata
                    const { memberstackUserId, planId: memberstackPlanId, countryCode } = session.metadata;
                    
                    if (!memberstackUserId || !memberstackPlanId) {
                        throw new Error('Missing required metadata: memberstackUserId or planId');
                    }

                    if (!countryCode) {
                        throw new Error('Country code is required');
                    }

                    // Log the transaction details
                    console.log('Processing order:', {
                        memberstackUserId,
                        memberstackPlanId,
                        countryCode,
                        sessionId: session.id
                    });

                    // Add plan to member using Memberstack REST API
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

                    // Verify the plan was added successfully
                    if (!response.data || response.status !== 200) {
                        throw new Error('Failed to add plan to member');
                    }

                    console.log('Successfully added plan to member:', response.data);

                    // Process shipping information
                    const shippingResponse = await axios({
                        method: 'POST',
                        url: '/.netlify/functions/process-shipping',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        data: {
                            countryCode: countryCode,
                            memberId: memberstackUserId,
                            sessionId: session.id
                        }
                    });

                    console.log('Shipping processed:', shippingResponse.data);

                    return {
                        statusCode: 200,
                        body: JSON.stringify({ 
                            received: true,
                            memberstackUserId,
                            memberstackPlanId,
                            countryCode,
                            shipping: shippingResponse.data
                        })
                    };
                } catch (error) {
                    console.error('Error processing webhook:', error.response ? error.response.data : error.message);
                    return {
                        statusCode: 500,
                        body: JSON.stringify({ 
                            error: error.response ? error.response.data : error.message 
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
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('Webhook error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Webhook handler failed' })
        };
    }
};
