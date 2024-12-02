const Stripe = require('stripe');
const axios = require('axios');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const MEMBERSTACK_API_URL = 'https://admin.memberstack.com/api';

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
            const memberstackUserId = session.metadata.memberstackUserId;
            const memberstackPlanId = session.metadata.memberstackPlanId;
            
            if (!memberstackUserId || !memberstackPlanId) {
                throw new Error('Missing required metadata: memberstackUserId or memberstackPlanId');
            }

            console.log('Adding plan to member:', {
                memberstackUserId,
                memberstackPlanId,
                sessionId: session.id
            });

            // Add plan to member using Memberstack REST API
            const response = await axios({
                method: 'POST',
                url: `${MEMBERSTACK_API_URL}/members/${memberstackUserId}/plans`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY
                },
                data: {
                    id: memberstackPlanId,
                    status: 'active'
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
