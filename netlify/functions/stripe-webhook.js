const axios = require('axios');
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');
const { MemberstackClient } = require('@memberstack/admin');

// Initialize clients
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const memberstack = new MemberstackClient(process.env.MEMBERSTACK_SECRET_KEY);

// Load email templates
const emailTemplates = {
    de: require('./email-templates/de')
};

// Function to add plan to member
async function addPlanToMember(email) {
    try {
        // Search for member
        const members = await memberstack.members.search({ email });
        let memberId;

        if (members.length > 0) {
            memberId = members[0].id;
        } else {
            // Create new member if not found
            const newMember = await memberstack.members.create({
                email,
                status: 'ACTIVE'
            });
            memberId = newMember.id;
        }

        // Add the plan
        await memberstack.members.addPlan({
            memberId,
            planId: process.env.MEMBERSTACK_LIFETIME_PLAN_ID,
            status: 'ACTIVE'
        });

        return memberId;
    } catch (error) {
        console.error('Error adding plan to member:', error);
        throw error;
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
            const email = session.customer_details.email;

            if (session.payment_status === 'paid') {
                // Add plan to member
                await addPlanToMember(email);
                
                // Send confirmation email
                await sendOrderConfirmationEmail(email, session);
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
