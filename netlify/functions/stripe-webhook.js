const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load email templates
const emailTemplates = {
    de: require('./email-templates/de')
};

// Memberstack API URL
const MEMBERSTACK_API = 'https://api.memberstack.io/graphql';

// Constants for API interaction
const MAX_RETRIES = 4;
const INITIAL_DELAY = 1000;
const MAX_DELAY = 3000;
const NETLIFY_TIMEOUT = 10000; // Leave 5s buffer from 10s limit

// CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Shipping rate calculation
function calculateShippingRate(country) {
    if (!country?.trim()) {
        throw new Error('Country code is required and cannot be empty');
    }
    
    const countryCode = country.toUpperCase();
    console.log(`Calculating shipping for country: ${countryCode}`);
    
    // Define shipping rates
    const SHIPPING_RATES = {
        AT: { price: 728, label: "Austria Shipping" },
        GB: { price: 2072, label: "Great Britain Shipping" },
        SG: { price: 3653, label: "Singapore Shipping" },
        EU: { price: 2036, label: "Europe Shipping" }
    };

    // EU country list
    const EU_COUNTRIES = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];

    if (countryCode === 'AT') return SHIPPING_RATES.AT;
    if (countryCode === 'GB') return SHIPPING_RATES.GB;
    if (countryCode === 'SG') return SHIPPING_RATES.SG;
    if (EU_COUNTRIES.includes(countryCode)) return SHIPPING_RATES.EU;

    throw new Error(`No shipping rate available for country: ${countryCode}`);
}

// Add retry helper function at the top level
async function retryWithBackoff(operation, maxRetries = 3, initialDelay = 2000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            // Special handling for 502 errors
            if (error.response && error.response.status === 502) {
                const delay = initialDelay * Math.pow(1.5, attempt - 1); // More aggressive backoff for 502s
                console.log(`Attempt ${attempt} failed with status 502, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            // For other errors, use standard backoff
            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(1.5, attempt - 1);
                console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// Add helper function to store failed requests
async function storeFailedRequest(data) {
    try {
        // Store the failed request in your database or send to a queue
        console.log('Storing failed request for retry:', {
            type: data.type,
            data: data.data,
            error: data.error,
            timestamp: new Date().toISOString()
        });
        
        // Here you could implement actual storage logic
        // For example, write to a DynamoDB table or send to an SQS queue
        
        return true;
    } catch (error) {
        console.error('Failed to store request:', error);
        return false;
    }
}

// Memberstack API client with built-in retries
async function callMemberstackAPI(query, variables, attempt = 1) {
    console.log(`Calling Memberstack GraphQL API with variables:`, variables);
    try {
        const response = await axios({
            method: 'POST',
            url: MEMBERSTACK_API,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
            },
            data: {
                query,
                variables
            },
            timeout: NETLIFY_TIMEOUT
        });

        if (response.data.errors) {
            throw new Error(JSON.stringify(response.data.errors));
        }

        return response.data;
    } catch (error) {
        console.error('Error calling Memberstack API:', error.response?.data || error.message);
        
        // Handle specific error cases
        if (error.response) {
            const status = error.response.status;
            if ((status === 401 || status === 403) && attempt < MAX_RETRIES) {
                const delay = Math.min(INITIAL_DELAY * Math.pow(2, attempt - 1), MAX_DELAY);
                console.log(`Auth error (${status}), retry attempt ${attempt} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return callMemberstackAPI(query, variables, attempt + 1);
            }
        }
        throw error;
    }
}

// Simple function to add a lifetime plan to a member
async function addLifetimePlanToMember(memberId, planId) {
    const mutation = `
        mutation UpdateMember($memberId: String!, $data: JSON!) {
            updateMember(id: $memberId, data: $data) {
                id
                email
                planConnections {
                    planId
                    status
                    purchasedAt
                }
                customFields
            }
        }
    `;

    console.log('Adding lifetime plan to member:', { memberId, planId });

    const variables = {
        memberId,
        data: {
            planConnections: [{
                planId,
                status: "ACTIVE",
                isLifetime: true,
                purchasedAt: new Date().toISOString()
            }]
        }
    };

    const result = await callMemberstackAPI(mutation, variables);
    
    // Verify the update was successful
    const member = result.data?.updateMember;
    if (!member) {
        throw new Error('Failed to update member: No member data returned');
    }

    const activePlan = member.planConnections?.find(
        conn => conn.planId === planId && conn.status === "ACTIVE"
    );

    if (!activePlan) {
        throw new Error('Lifetime plan was not successfully activated');
    }

    return member;
}

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        // Parse the incoming webhook event
        const webhookEvent = JSON.parse(event.body);
        console.log('Received webhook event:', webhookEvent);

        // Handle different event types
        switch (webhookEvent.type) {
            case 'checkout.session.completed':
                // Extract customer email and metadata from the session
                const session = webhookEvent.data.object;
                const customerEmail = session.customer_details.email;
                const metadata = session.metadata || {};
                
                // Get the member ID and plan ID from metadata
                const memberId = metadata.memberId;
                const planId = metadata.planId;

                if (!memberId || !planId) {
                    throw new Error('Missing required metadata: memberId or planId');
                }

                // Update member's lifetime plan in Memberstack
                const member = await addLifetimePlanToMember(memberId, planId);
                console.log('Successfully added lifetime plan:', {
                    memberId: member.id,
                    email: member.email,
                    planConnections: member.planConnections
                });

                // Send confirmation email if needed
                if (process.env.SENDGRID_API_KEY) {
                    try {
                        await sendOrderConfirmationEmail(customerEmail, {
                            planName: metadata.planName || 'Lifetime Access',
                            purchaseDate: new Date().toLocaleDateString()
                        });
                    } catch (error) {
                        console.error('Failed to send confirmation email:', error);
                        // Continue processing as email sending is not critical
                    }
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        message: 'Lifetime plan activated successfully',
                        member: {
                            id: member.id,
                            email: member.email,
                            activePlans: member.planConnections
                                .filter(conn => conn.status === "ACTIVE")
                                .map(conn => conn.planId)
                        }
                    })
                };

            default:
                console.log('Unhandled event type:', webhookEvent.type);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ message: 'Event type not handled' })
                };
        }
    } catch (error) {
        console.error('Webhook error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Webhook processing failed',
                message: error.message 
            })
        };
    }
};
