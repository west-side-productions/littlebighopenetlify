const axios = require('axios');
const crypto = require('crypto');
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

    // Simple authentication with just the API key
    return {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
    };
}

// Function to find or create member in Memberstack
async function findOrCreateMember(email) {
    try {
        console.log('Finding or creating member for email:', email);
        
        const headers = createMemberstackHeaders();
        
        // Log headers safely
        console.log('Request headers:', {
            'Content-Type': headers['Content-Type'],
            'Authorization': 'REDACTED'
        });
        
        // Search for existing member
        const searchUrl = `https://api.memberstack.com/v2/members/search?email=${encodeURIComponent(email)}`;
        console.log('Making request to:', searchUrl);
        
        const searchResponse = await axios.get(searchUrl, { headers });
        
        // If member exists, return them
        if (searchResponse.data.data.length > 0) {
            return searchResponse.data.data[0];
        }
        
        // If no member found, create new one
        console.log('No existing member found, creating new one');
        const createResponse = await axios.post(
            'https://api.memberstack.com/v2/members',
            { 
                email: email,
                status: 'ACTIVE'
            },
            { headers }
        );
        
        return createResponse.data;
    } catch (error) {
        console.error('Error in findOrCreateMember:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            headers: error.config?.headers ? {
                ...error.config.headers,
                Authorization: 'REDACTED'
            } : null
        });
        throw error;
    }
}

// Function to add lifetime plan to member
async function addLifetimePlan(memberId) {
    try {
        const headers = createMemberstackHeaders();
        console.log('Adding plan with headers:', {
            'Content-Type': headers['Content-Type'],
            'Authorization': 'REDACTED'
        });
        
        await axios.post(
            `https://api.memberstack.com/v2/members/${memberId}/plans`,
            {
                planId: process.env.MEMBERSTACK_LIFETIME_PLAN_ID,
                status: 'ACTIVE'
            },
            { headers }
        );
    } catch (error) {
        console.error('Error adding lifetime plan:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        throw error;
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
        
        // Process the webhook
        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            const email = session.customer_details.email;
            
            console.log('Customer email:', email);
            
            try {
                // Find or create member
                const member = await findOrCreateMember(email);
                
                // Add lifetime plan
                if (member && member.id) {
                    await addLifetimePlan(member.id);
                }
                
                // Send confirmation email for successful payment
                if (session && session.payment_status === 'paid') {
                    await sendOrderConfirmationEmail(email, session);
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
        } else if (stripeEvent.type === 'customer.subscription.created') {
            const session = stripeEvent.data.object;
            const email = session.customer_email;
            
            console.log('Customer email:', email);
            
            try {
                // Find or create member
                const member = await findOrCreateMember(email);
                
                // Add lifetime plan
                if (member && member.id) {
                    await addLifetimePlan(member.id);
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
        } else {
            // For other events, just acknowledge receipt
            console.log('Skipping event - not a handled type:', stripeEvent.type);
            return { 
                statusCode: 200, 
                body: JSON.stringify({ received: true, processed: false }) 
            };
        }
        
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
