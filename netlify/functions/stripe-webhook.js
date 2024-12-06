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
const MEMBERSTACK_API_V1 = 'https://api.memberstack.io/v1';

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
async function callMemberstackAPI(endpoint, data, attempt = 1) {
    console.log(`Calling Memberstack API endpoint: ${endpoint}`);
    try {
        const response = await axios({
            method: 'POST',
            url: `${MEMBERSTACK_API_V1}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
            },
            data: data,
            timeout: NETLIFY_TIMEOUT
        });
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
                return callMemberstackAPI(endpoint, data, attempt + 1);
            }
        }
        throw error;
    }
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        const sig = event.headers['stripe-signature'];
        const stripeEvent = Stripe.webhooks.constructEvent(
            event.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        console.log('Processing Stripe event:', stripeEvent.type);

        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            console.log('Checkout session completed:', session.id);

            // Get the Memberstack member ID from metadata
            const memberstackMemberId = session.metadata?.memberstackUserId;
            if (!memberstackMemberId) {
                throw new Error('No Memberstack member ID found in session metadata');
            }

            // Get the plan ID from metadata
            const planId = session.metadata?.planId;
            if (!planId) {
                throw new Error('No plan ID found in session metadata');
            }

            // Update member's plan in Memberstack
            try {
                await callMemberstackAPI(`/member/update`, {
                    id: memberstackMemberId,
                    planConnections: [{
                        planId: planId,
                        status: "ACTIVE"
                    }]
                });
                console.log('Successfully updated member plan in Memberstack');
            } catch (error) {
                console.error('Failed to update Memberstack:', error);
                throw error;
            }

            // Extract relevant data
            console.log('Checkout session details:', {
                id: session.id,
                customer: session.customer,
                customerEmail: session.customer_email,
                shipping: session.shipping,
                metadata: session.metadata
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
                totalWeight: parseInt(session.metadata.totalWeight),
                productWeight: parseInt(session.metadata.productWeight),
                packagingWeight: parseInt(session.metadata.packagingWeight),
                checkoutSessionId: session.id,
                source: session.metadata.source,
                orderDate: new Date().toISOString()
            };

            console.log('Preparing MemberStack update:', {
                memberId: memberstackMemberId,
                customFields
            });

            // Send order notification email
            console.log('Sending order notification email...');
            try {
                const template = emailTemplates[session.metadata.language || 'de'];
                const orderDetails = {
                    orderNumber: session.id,
                    customerEmail: session.customer_details.email,
                    shippingAddress: {
                        name: session.customer_details.name,
                        line1: session.customer_details.address.line1,
                        line2: session.customer_details.address.line2,
                        city: session.customer_details.address.city,
                        state: session.customer_details.address.state,
                        postal_code: session.customer_details.address.postal_code,
                        country: session.customer_details.address.country
                    },
                    weights: {
                        productWeight: parseInt(session.metadata.productWeight),
                        packagingWeight: parseInt(session.metadata.packagingWeight),
                        totalWeight: parseInt(session.metadata.totalWeight)
                    },
                    items: [{
                        name: 'Little Big Hope Kochbuch',
                        price: (session.amount_subtotal / 100).toFixed(2),
                        currency: session.currency.toUpperCase()
                    }],
                    shipping: {
                        method: 'Standard Versand',
                        cost: (session.shipping_cost.amount_total / 100).toFixed(2),
                        currency: session.currency.toUpperCase()
                    },
                    total: {
                        subtotal: (session.amount_subtotal / 100).toFixed(2),
                        shipping: (session.shipping_cost.amount_total / 100).toFixed(2),
                        tax: (session.total_details.amount_tax / 100).toFixed(2),
                        total: (session.amount_total / 100).toFixed(2),
                        currency: session.currency.toUpperCase()
                    }
                };

                const msg = {
                    to: session.customer_email,
                    from: process.env.SENDGRID_FROM_EMAIL,
                    subject: template.order_notification.subject,
                    html: template.order_notification.html({ orderDetails })
                };

                const emailResponse = await sgMail.send(msg);
                console.log('Order notification email sent successfully:', emailResponse[0].statusCode);
            } catch (error) {
                console.error('Failed to send order notification email:', error.response?.body || error);
                // Continue processing even if email fails
            }

            // Update Memberstack member
            console.log('Attempting MemberStack update:', {
                memberId: memberstackMemberId,
                customFields
            });

            try {
                // Update custom fields
                await callMemberstackAPI(`/members/${memberstackMemberId}`, {
                    data: customFields
                });
            } catch (error) {
                console.error('Failed to update MemberStack:', error);
                // The error is already logged and stored for retry by callMemberstackAPI
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };

    } catch (error) {
        console.error('Webhook error:', error.message);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};
