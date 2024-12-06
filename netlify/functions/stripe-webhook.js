const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load email templates
const emailTemplates = {
    de: require('./email-templates/de')
};

/*
Memberstack Integration with Stripe Webhooks

When a Stripe webhook 'customer.subscription.created' is received:
1. Extract customer email from the Stripe event
2. Search for member in Memberstack by email
3. If member doesn't exist, create them
4. Add lifetime plan to the member (new or existing)
5. Send order confirmation email
*/

// Helper function to create Memberstack API headers
function createMemberstackHeaders() {
    const apiKey = process.env.MEMBERSTACK_SECRET_KEY?.trim();
    if (!apiKey) {
        throw new Error('MEMBERSTACK_SECRET_KEY is not set');
    }
    return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
}

// Function to find or create member in Memberstack
async function findOrCreateMember(email) {
    const headers = createMemberstackHeaders();
    
    // 1. Search for existing member
    const searchResponse = await axios.get(
        `https://api.memberstack.com/v2/members/search?email=${encodeURIComponent(email)}`,
        { headers }
    );
    
    // 2. Return existing member if found
    if (searchResponse.data.data.length > 0) {
        return searchResponse.data.data[0];
    }
    
    // 3. Create new member if not found
    const createResponse = await axios.post(
        'https://api.memberstack.com/v2/members',
        { 
            email: email,
            status: 'ACTIVE'
        },
        { headers }
    );
    
    return createResponse.data;
}

// Function to add lifetime plan to member
async function addLifetimePlan(memberId) {
    const headers = createMemberstackHeaders();
    
    await axios.post(
        `https://api.memberstack.com/v2/members/${memberId}/plans`,
        {
            planId: process.env.MEMBERSTACK_LIFETIME_PLAN_ID,
            status: 'ACTIVE'
        },
        { headers }
    );
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
    console.log('Webhook received:', {
        headers: event.headers,
        body: event.body ? JSON.parse(event.body) : null
    });

    try {
        // Verify Stripe webhook signature
        const stripeEvent = await Stripe.webhooks.constructEvent(
            event.body,
            event.headers['stripe-signature'],
            process.env.STRIPE_WEBHOOK_SECRET
        );
        
        console.log('Stripe event:', {
            type: stripeEvent.type,
            object: stripeEvent.data.object
        });
        
        // Handle both subscription creation and checkout completion
        if (stripeEvent.type === 'customer.subscription.created' || 
            stripeEvent.type === 'checkout.session.completed') {
            
            const session = stripeEvent.type === 'checkout.session.completed' 
                ? stripeEvent.data.object 
                : null;
            
            // Get email based on event type
            const email = stripeEvent.type === 'checkout.session.completed'
                ? session.customer_details?.email
                : stripeEvent.data.object.customer_email;
            
            console.log('Customer email:', email);
            
            if (!email) {
                console.error('No customer email in event:', stripeEvent.data.object);
                throw new Error('No customer email found in Stripe event');
            }
            
            // Find or create member in Memberstack
            console.log('Finding or creating member for email:', email);
            const member = await findOrCreateMember(email);
            console.log('Member result:', {
                id: member?.id,
                email: member?.email,
                status: member?.status
            });
            
            if (!member?.id) {
                throw new Error('Failed to find or create member');
            }
            
            // Add lifetime plan to member
            console.log('Adding lifetime plan to member:', member.id);
            console.log('Using plan ID:', process.env.MEMBERSTACK_LIFETIME_PLAN_ID);
            
            await addLifetimePlan(member.id);
            console.log('Successfully added lifetime plan');
            
            // Send confirmation email for checkout completion
            if (session && session.payment_status === 'paid') {
                await sendOrderConfirmationEmail(email, {
                    amount: session.amount_total,
                    currency: session.currency,
                    shipping: session.shipping_details
                });
            }
            
            console.log('Successfully processed event for member:', member.id);
            return { 
                statusCode: 200, 
                body: JSON.stringify({ 
                    success: true, 
                    memberId: member.id 
                }) 
            };
        }
        
        // For other events, just acknowledge receipt
        console.log('Skipping event - not a handled type:', stripeEvent.type);
        return { 
            statusCode: 200, 
            body: JSON.stringify({ received: true, processed: false }) 
        };
        
    } catch (error) {
        console.error('Error processing webhook:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            stack: error.stack
        });
        
        return { 
            statusCode: error.statusCode || 500,
            body: JSON.stringify({ 
                error: error.message || 'Internal Server Error' 
            })
        };
    }
};
