const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

// Function to add plan to member
async function addPlanToMember(memberId) {
    try {
        const url = `https://admin.memberstack.com/members/${memberId}/add-plan`;
        const data = {
            planId: process.env.MEMBERSTACK_LIFETIME_PLAN_ID
        };
        const headers = {
            Authorization: process.env.MEMBERSTACK_SECRET_KEY
        };

        const response = await axios.post(url, data, { headers });
        console.log(`Successfully added plan to member ${memberId}`, response.data);
    } catch (error) {
        console.error('Error adding plan to member:', error);
        throw error;
    }
}

// Main webhook handler
exports.handler = async (event) => {
    try {
        const stripeEvent = Stripe.webhooks.constructEvent(
            event.body,
            event.headers['stripe-signature'],
            process.env.STRIPE_WEBHOOK_SECRET
        );

        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            
            if (session.payment_status === 'paid' && session.metadata?.memberstackUserId) {
                await addPlanToMember(session.metadata.memberstackUserId);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('Error processing webhook:', error);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message })
        };
    }
};
