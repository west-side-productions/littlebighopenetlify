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

// Simple function to add a plan to a member
async function addPlanToMember(memberId, planId) {
    const mutation = `
        mutation UpdateMember($memberId: String!, $data: JSON!) {
            updateMember(id: $memberId, data: $data) {
                id
                email
                planConnections {
                    planId
                    status
                    startedAt
                    renewalAt
                }
                customFields
            }
        }
    `;

    console.log('Adding plan to member:', { memberId, planId });

    const variables = {
        memberId,
        data: {
            planConnections: [{
                planId,
                status: "ACTIVE"
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
        throw new Error('Plan was not successfully activated');
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
            case 'subscription.created':
                // Extract member and plan IDs from the webhook payload
                const memberId = webhookEvent.data.memberId;
                const planId = webhookEvent.data.planId;

                if (!memberId || !planId) {
                    throw new Error('Missing required fields: memberId or planId');
                }

                // Update member's plan in Memberstack
                const member = await addPlanToMember(memberId, planId);
                console.log('Successfully updated member plan:', {
                    memberId: member.id,
                    email: member.email,
                    planConnections: member.planConnections
                });

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        message: 'Plan updated successfully',
                        member: {
                            id: member.id,
                            email: member.email,
                            activePlans: member.planConnections
                                .filter(conn => conn.status === "ACTIVE")
                                .map(conn => conn.planId)
                        }
                    })
                };

            case 'checkout.session.completed':
                const session = webhookEvent.data.object;
                console.log('Checkout session completed:', session.id);

                // Get the Memberstack member ID from metadata
                const memberstackMemberId = session.metadata?.memberstackUserId;
                if (!memberstackMemberId) {
                    throw new Error('No Memberstack member ID found in session metadata');
                }

                // Get the plan ID from metadata
                const checkoutPlanId = session.metadata?.planId;
                if (!checkoutPlanId) {
                    throw new Error('No plan ID found in session metadata');
                }

                // Update member's plan in Memberstack
                try {
                    const checkoutResult = await addPlanToMember(memberstackMemberId, checkoutPlanId);
                    console.log('Successfully updated member plan in Memberstack:', checkoutResult);
                } catch (error) {
                    console.error('Failed to update Memberstack:', error);
                    throw error;
                }

                // Extract relevant data
                console.log('Checkout session details:', {
                    id: session.id,
                    customerId: session.customer,
                    customerEmail: session.customer_details.email,
                    customerName: session.customer_details.name,
                    customerAddress: session.customer_details.address,
                    customerPhone: session.customer_details.phone,
                    amount: session.amount_total,
                    currency: session.currency,
                    metadata: session.metadata,
                    countryCode: session.metadata.countryCode
                });

                // Get country code from metadata
                const countryCode = session.metadata.countryCode;
                console.log('Using country code from metadata:', countryCode);

                // Calculate shipping rate
                console.log('Calculating shipping for country:', countryCode);
                const calculatedRate = calculateShippingRate(countryCode);
                console.log('Shipping calculation:', {
                    country: countryCode,
                    calculatedRate,
                    totalWeight: session.metadata.totalWeight,
                    productWeight: session.metadata.productWeight,
                    packagingWeight: session.metadata.packagingWeight,
                    source: session.metadata.source
                });

                // Prepare data for Memberstack update
                const customFields = {
                    shippingCountry: countryCode,
                    shippingRate: calculatedRate.price,
                    shippingLabel: calculatedRate.label,
                    orderTotal: session.amount_total,
                    orderCurrency: session.currency,
                    customerName: session.customer_details.name,
                    customerEmail: session.customer_details.email,
                    customerPhone: session.customer_details.phone,
                    customerAddress: session.customer_details.address
                };

                console.log('Preparing MemberStack update:', {
                    memberId: memberstackMemberId,
                    customFields
                });

                // Send order confirmation email
                try {
                    const emailTemplate = emailTemplates.de;
                    const msg = {
                        to: session.customer_details.email,
                        from: 'info@lieblingsbrot.at',
                        templateId: emailTemplate.confirmationTemplateId,
                        dynamicTemplateData: {
                            customerName: session.customer_details.name,
                            orderTotal: (session.amount_total / 100).toFixed(2),
                            currency: session.currency.toUpperCase(),
                            shippingAddress: {
                                name: session.customer_details.name,
                                line1: session.customer_details.address.line1,
                                line2: session.customer_details.address.line2,
                                city: session.customer_details.address.city,
                                postal_code: session.customer_details.address.postal_code,
                                country: session.customer_details.address.country
                            }
                        }
                    };

                    await sgMail.send(msg);
                    console.log('Order confirmation email sent');
                } catch (error) {
                    console.error('Failed to send order confirmation email:', error);
                    // Don't throw here, continue with other operations
                }

                try {
                    // Update custom fields
                    const updateCustomFieldsMutation = `
                        mutation UpdateMember($memberId: String!, $data: JSON!) {
                            updateMember(id: $memberId, data: $data) {
                                id
                                customFields
                            }
                        }
                    `;

                    const result = await callMemberstackAPI(updateCustomFieldsMutation, {
                        memberId: memberstackMemberId,
                        data: {
                            customFields
                        }
                    });

                    console.log('Successfully updated Memberstack member:', result);
                } catch (error) {
                    console.error('Failed to update MemberStack:', error);
                    // The error is already logged and stored for retry by callMemberstackAPI
                }

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ received: true })
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
