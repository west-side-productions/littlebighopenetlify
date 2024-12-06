const axios = require('axios');
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');
const memberstack = require('@memberstack/admin').default({
    secret_key: process.env.MEMBERSTACK_SECRET_KEY
});

// Initialize clients
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load email templates
const emailTemplates = {
    de: require('./email-templates/de')
};

async function addPlanToMember(memberId) {
    try {
        // Add plan using Memberstack client
        await memberstack.addPlanToMember({
            memberId,
            planId: process.env.MEMBERSTACK_LIFETIME_PLAN_ID,
            status: 'ACTIVE'
        });
        
        console.log(`Successfully added plan to member ${memberId}`);
    } catch (error) {
        // Improved error handling
        const errorMessage = error.response?.data || error.message || 'Unknown error';
        console.error('Error adding plan to member:', errorMessage);
        throw new Error(`Failed to add plan to member: ${errorMessage}`);
    }
}

// Function to send order confirmation email
async function sendOrderConfirmationEmail(email, data) {
    try {
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: 'Order Confirmation',
            text: emailTemplates.de.orderConfirmation(data),
            html: emailTemplates.de.orderConfirmationHtml(data),
        };

        await sgMail.send(msg);
        console.log('Order confirmation email sent successfully');
    } catch (error) {
        console.error('Failed to send order confirmation email:', error);
    }
}

// Main webhook handler
exports.handler = async (event) => {
    try {
        // Verify Stripe webhook signature
        const stripeEvent = await Stripe.webhooks.constructEvent(
            event.body,
            event.headers['stripe-signature'],
            process.env.STRIPE_WEBHOOK_SECRET
        );

        // Only handle successful checkouts
        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            
            // Only proceed if payment is successful and we have a memberstack ID
            if (session.payment_status === 'paid' && session.metadata?.memberstackUserId) {
                console.log('Processing successful payment for member:', session.metadata.memberstackUserId);
                
                // Add plan to existing member
                await addPlanToMember(session.metadata.memberstackUserId);
                
                // Send confirmation email
                if (session.customer_details?.email) {
                    await sendOrderConfirmationEmail(session.customer_details.email, session);
                }
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
