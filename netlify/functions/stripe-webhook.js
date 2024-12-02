const Stripe = require('stripe');
const axios = require('axios');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const MEMBERSTACK_API_URL = 'https://api.memberstack.com/v1';

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return { 
            statusCode: 400, 
            body: `Webhook Error: ${err.message}`
        };
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        
        try {
            // Get member ID and plan ID from metadata
            const { memberstackUserId, memberstackPlanId, totalWeight, productWeight, packagingWeight } = session.metadata;
            
            if (!memberstackUserId || !memberstackPlanId) {
                throw new Error('Missing required metadata: memberstackUserId or memberstackPlanId');
            }

            // Log the weight information
            console.log('Order weight details:', {
                totalWeight,
                productWeight,
                packagingWeight,
                memberstackUserId,
                memberstackPlanId
            });

            // Update the payment intent with the metadata if it's not already there
            if (session.payment_intent) {
                const paymentIntent = await stripe.paymentIntents.update(
                    session.payment_intent,
                    {
                        metadata: {
                            ...session.metadata,
                            totalWeight,
                            productWeight,
                            packagingWeight
                        }
                    }
                );
                console.log('Updated payment intent metadata:', paymentIntent.metadata);
            }

            console.log('Adding plan to member:', {
                memberstackUserId,
                memberstackPlanId,
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

            console.log('Successfully added plan to member:', response.data);

            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    received: true,
                    memberstackUserId,
                    memberstackPlanId
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
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ received: true })
    };
};
