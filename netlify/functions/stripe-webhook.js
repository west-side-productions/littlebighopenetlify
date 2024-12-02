const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

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
            const response = await fetch(`https://api.memberstack.io/v1/members/${memberstackUserId}/add-plan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
                },
                body: JSON.stringify({
                    planId: memberstackPlanId,
                    status: 'ACTIVE',
                    type: 'ONETIME'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Memberstack API error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
                throw new Error(`Memberstack API error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Successfully added plan to member:', result);

            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    received: true,
                    memberstackUserId,
                    memberstackPlanId
                })
            };
        } catch (error) {
            console.error('Error processing webhook:', error);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: error.message })
            };
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ received: true })
    };
};
