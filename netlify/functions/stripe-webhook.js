const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const memberstack = require('@memberstack/sdk');

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

    // Initialize Memberstack
    const ms = memberstack.init(process.env.MEMBERSTACK_SECRET_KEY);

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        
        try {
            // Get member ID from metadata
            const memberstackMemberId = session.metadata.memberstack_member_id;
            const memberstackEmail = session.metadata.memberstack_email;
            
            // Add plan to member
            await ms.members.update({
                id: memberstackMemberId,
                planConnections: [{
                    planId: process.env.MEMBERSTACK_COOKBOOK_PLAN_ID,
                    status: "ACTIVE"
                }]
            });

            // Send confirmation email (you can implement this part)
            // await sendConfirmationEmail(memberstackEmail, session.metadata.order_id);

            return {
                statusCode: 200,
                body: JSON.stringify({ received: true })
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
