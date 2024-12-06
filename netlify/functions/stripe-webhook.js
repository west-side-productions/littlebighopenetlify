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
const MEMBERSTACK_API = 'https://api.memberstack.com/v2/graphql';

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

// Helper function to call Memberstack API
async function callMemberstackAPI(query, variables) {
    console.log('Calling Memberstack GraphQL API with variables:', variables);
    
    try {
        const response = await axios.post(MEMBERSTACK_API, {
            query,
            variables
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.errors) {
            console.error('Memberstack API returned errors:', response.data.errors);
            throw new Error(response.data.errors[0].message);
        }

        return response.data;
    } catch (error) {
        console.error('Error calling Memberstack API:', error.response?.data || error.message);
        throw error;
    }
}

// Simple function to add a lifetime plan to a member
async function addLifetimePlanToMember(memberId, planId) {
    const mutation = `
        mutation UpdateMember($memberId: ID!, $planId: ID!) {
            updateMember(id: $memberId, data: {
                planConnections: [{
                    planId: $planId,
                    status: "ACTIVE",
                    isLifetime: true
                }]
            }) {
                id
                email
                planConnections {
                    planId
                    status
                }
            }
        }
    `;

    console.log('Adding lifetime plan to member:', { memberId, planId });

    return callMemberstackAPI(mutation, { memberId, planId });
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
                // Extract session data
                const session = webhookEvent.data.object;
                console.log('Processing checkout session:', {
                    id: session.id,
                    email: session.customer_email,
                    amount: session.amount_total,
                    currency: session.currency,
                    status: session.payment_status
                });

                // Verify payment status
                if (session.payment_status !== 'paid') {
                    console.log('Payment not completed:', session.payment_status);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({ 
                            message: 'Payment not completed',
                            status: session.payment_status 
                        })
                    };
                }

                try {
                    // Query Memberstack to find or create member by email
                    const findMemberQuery = `
                        query FindMemberByEmail($email: String!) {
                            members(email: $email) {
                                id
                                email
                                planConnections {
                                    planId
                                    status
                                }
                            }
                        }
                    `;

                    const memberResult = await callMemberstackAPI(findMemberQuery, {
                        email: session.customer_email
                    });

                    let memberId;
                    let member = memberResult.data?.members?.[0];

                    if (!member) {
                        // Create new member if not found
                        const createMemberMutation = `
                            mutation CreateMember($email: String!) {
                                createMember(email: $email) {
                                    id
                                    email
                                }
                            }
                        `;

                        const newMemberResult = await callMemberstackAPI(createMemberMutation, {
                            email: session.customer_email
                        });
                        member = newMemberResult.data?.createMember;
                        if (!member) {
                            throw new Error('Failed to create member');
                        }
                    }

                    memberId = member.id;

                    // Use a default plan ID for lifetime access
                    const lifetimePlanId = process.env.MEMBERSTACK_LIFETIME_PLAN_ID || 'pln_lifetime_access';

                    // Add lifetime plan to member
                    const updateResult = await addLifetimePlanToMember(memberId, lifetimePlanId);
                    console.log('Successfully added lifetime plan:', {
                        memberId: updateResult.id,
                        email: updateResult.email,
                        planConnections: updateResult.planConnections
                    });

                    // Send confirmation email
                    if (process.env.SENDGRID_API_KEY) {
                        try {
                            await sendOrderConfirmationEmail(session.customer_email, {
                                planName: 'Lifetime Access',
                                purchaseDate: new Date().toLocaleDateString(),
                                amount: (session.amount_total / 100).toFixed(2),
                                currency: session.currency.toUpperCase()
                            });
                        } catch (error) {
                            console.error('Failed to send confirmation email:', error);
                        }
                    }

                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({ 
                            message: 'Lifetime access granted successfully',
                            member: {
                                id: updateResult.id,
                                email: updateResult.email,
                                activePlans: updateResult.planConnections
                                    .filter(conn => conn.status === "ACTIVE")
                                    .map(conn => conn.planId)
                            }
                        })
                    };

                } catch (error) {
                    console.error('Error processing checkout:', error);
                    return {
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({ 
                            error: 'Failed to process checkout',
                            message: error.message 
                        })
                    };
                }

            default:
                console.log('Unhandled event type:', webhookEvent.type);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        message: 'Unhandled event type',
                        type: webhookEvent.type 
                    })
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
