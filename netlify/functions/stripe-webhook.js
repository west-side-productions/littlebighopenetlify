const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load email templates
const emailTemplates = {
    de: require('./email-templates/de')
};

// Constants and configurations
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Memberstack API configuration
const MEMBERSTACK_API_BASE = 'https://api.memberstack.com/v2/graphql';

// Constants for API interaction
const MAX_RETRIES = 4;
const INITIAL_DELAY = 1000;
const MAX_DELAY = 3000;
const NETLIFY_TIMEOUT = 10000; // Leave 5s buffer from 10s limit

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
async function callMemberstackAPI(query, variables = null) {
    console.log(`Calling Memberstack GraphQL API with query:`, query, variables ? { variables } : '');
    
    try {
        const config = {
            method: 'POST',
            url: MEMBERSTACK_API_BASE,
            headers: {
                'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            data: {
                query,
                variables
            }
        };

        const response = await axios(config);
        
        if (response.data.errors) {
            throw new Error(response.data.errors[0].message);
        }
        
        return response.data.data;
    } catch (error) {
        console.error('Error calling Memberstack API:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

// Function to find member by email
async function findMemberByEmail(email) {
    const query = `
        query FindMemberByEmail($email: String!) {
            member(email: $email) {
                id
                email
                connected
                planConnections {
                    id
                    planId
                    status
                }
            }
        }
    `;
    
    const variables = { email };
    const result = await callMemberstackAPI(query, variables);
    return result.member;
}

// Function to create a new member
async function createMember(email) {
    const query = `
        mutation CreateMember($email: String!) {
            createMember(email: $email) {
                id
                email
                connected
            }
        }
    `;
    
    const variables = {
        email,
        metaData: { signupDate: new Date().toISOString() }
    };
    
    const result = await callMemberstackAPI(query, variables);
    return result.createMember;
}

// Function to add a lifetime plan to a member
async function addLifetimePlanToMember(memberId, planId) {
    const query = `
        mutation AddPlanConnection($memberId: ID!, $planId: ID!) {
            addPlanConnection(memberId: $memberId, planId: $planId) {
                id
                status
                planId
            }
        }
    `;
    
    const variables = {
        memberId,
        planId
    };
    
    const result = await callMemberstackAPI(query, variables);
    return result.addPlanConnection;
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
        console.log('Order confirmation email sent to:', email);
    } catch (error) {
        console.error('Failed to send order confirmation email:', error);
        throw error;
    }
}

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        // Verify and parse the webhook payload
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
                    // Find or create member
                    let member = await findMemberByEmail(session.customer_email);
                    
                    if (!member) {
                        console.log('Member not found, creating new member');
                        member = await createMember(session.customer_email);
                    }

                    // Use a default plan ID for lifetime access
                    const lifetimePlanId = process.env.MEMBERSTACK_LIFETIME_PLAN_ID || 'pln_lifetime-access';

                    // Add lifetime plan to member
                    const updateResult = await addLifetimePlanToMember(member.id, lifetimePlanId);
                    console.log('Successfully added lifetime plan:', {
                        memberId: member.id,
                        email: member.email,
                        plan: updateResult
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
                                id: member.id,
                                email: member.email,
                                planStatus: updateResult.status
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
            body: JSON.stringify({ error: error.message })
        };
    }
};
