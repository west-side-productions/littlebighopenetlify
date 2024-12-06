const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const sgMail = require('@sendgrid/mail');

/*
Memberstack Integration with Stripe Webhooks

When a Stripe webhook 'customer.subscription.created' is received:
1. Extract customer email from the Stripe event
2. Search for member in Memberstack by email
3. If member doesn't exist, create them
4. Add lifetime plan to the member (new or existing)

Example webhook handling:
{
    type: 'customer.subscription.created',
    data: {
        object: {
            customer_email: 'user@example.com'
        }
    }
}
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

// Main webhook handler
exports.handler = async (event) => {
    try {
        // Verify Stripe webhook signature
        const stripeEvent = await Stripe.webhooks.constructEvent(
            event.body,
            event.headers['stripe-signature'],
            process.env.STRIPE_WEBHOOK_SECRET
        );
        
        // Only process subscription creation events
        if (stripeEvent.type !== 'customer.subscription.created') {
            return { 
                statusCode: 200, 
                body: JSON.stringify({ received: true, processed: false }) 
            };
        }
        
        // Extract customer email from Stripe event
        const email = stripeEvent.data.object.customer_email;
        if (!email) {
            throw new Error('No customer email found in Stripe event');
        }
        
        // Find or create member in Memberstack
        const member = await findOrCreateMember(email);
        if (!member?.id) {
            throw new Error('Failed to find or create member');
        }
        
        // Add lifetime plan to member
        await addLifetimePlan(member.id);
        
        console.log('Successfully processed subscription for member:', member.id);
        return { 
            statusCode: 200, 
            body: JSON.stringify({ 
                success: true, 
                memberId: member.id 
            }) 
        };
        
    } catch (error) {
        console.error('Error processing webhook:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        
        return { 
            statusCode: error.statusCode || 500,
            body: JSON.stringify({ 
                error: error.message || 'Internal Server Error' 
            })
        };
    }
};
