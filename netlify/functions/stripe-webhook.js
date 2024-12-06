const axios = require('axios');
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid client
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load email templates
const emailTemplates = {
    de: require('./email-templates/de')
};

// Function to find or create member in Memberstack
async function findOrCreateMember(email) {
    try {
        const headers = {
            Authorization: process.env.MEMBERSTACK_SECRET_KEY
        };

        // First, try to find the member
        const searchUrl = `https://admin.memberstack.com/members/search?email=${encodeURIComponent(email)}`;
        const searchResponse = await axios.get(searchUrl, { headers });

        if (searchResponse.data?.members?.length > 0) {
            return searchResponse.data.members[0];
        }

        // If member not found, create new one
        const createUrl = 'https://admin.memberstack.com/members';
        const createResponse = await axios.post(createUrl, {
            email: email,
            status: 'ACTIVE'
        }, { headers });

        return createResponse.data;
    } catch (error) {
        console.error('Error in findOrCreateMember:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        throw error;
    }
}

// Function to add plan to member
async function addPlanToMember(memberId) {
    try {
        const url = `https://admin.memberstack.com/members/${memberId}/add-plan`;
        const data = {
            planId: process.env.MEMBERSTACK_LIFETIME_PLAN_ID
        };
        const headers = {
            Authorization: process.env.MEMBERSTACK_SECRET_KEY // Use your Memberstack secret key
        };

        // Make the API call to add the plan
        const response = await axios.post(url, data, { headers });
        console.log(`Successfully added plan to member ${memberId}`, response.data);
    } catch (error) {
        const errorMessage = error.response?.data || error.message || 'Unknown error';
        console.error('Error adding plan to member:', errorMessage);
        throw new Error(`Failed to add plan to member: ${errorMessage}`);
    }
}

// Function to send order confirmation email
async function sendOrderConfirmationEmail(email, data) {
    try {
        console.log('Sending order confirmation email to:', email);
        
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
        // Don't throw the error - we don't want to fail the whole process if email fails
    }
}

// Main webhook handler
exports.handler = async (event) => {
    console.log('Processing webhook event');
    
    try {
        // Verify Stripe webhook signature
        const stripeEvent = Stripe.webhooks.constructEvent(
            event.body,
            event.headers['stripe-signature'],
            process.env.STRIPE_WEBHOOK_SECRET
        );

        // Only handle successful checkouts
        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            
            // Only proceed if payment is successful
            if (session.payment_status === 'paid') {
                const email = session.customer_email || session.customer_details?.email;
                console.log('Processing successful payment for email:', email);

                // If we have a Memberstack ID in metadata, use it
                if (session.metadata?.memberstackUserId) {
                    console.log('Using existing Memberstack ID:', session.metadata.memberstackUserId);
                    await addPlanToMember(session.metadata.memberstackUserId);
                } else {
                    // Otherwise, find or create member by email
                    console.log('Finding/creating member for email:', email);
                    const member = await findOrCreateMember(email);
                    if (member?.id) {
                        await addPlanToMember(member.id);
                    }
                }

                // Send confirmation email
                await sendOrderConfirmationEmail(email, {
                    amount: session.amount_total,
                    currency: session.currency,
                    shipping: session.shipping_details
                });
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('Error processing webhook:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            stack: error.stack
        });
        
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message })
        };
    }
};
