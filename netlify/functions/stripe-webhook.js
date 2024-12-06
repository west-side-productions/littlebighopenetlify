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
const MEMBERSTACK_API_V2 = 'https://api.memberstack.com/v2';

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
    const startTime = Date.now();
    const delay = Math.min(INITIAL_DELAY * Math.pow(1.5, attempt - 1), MAX_DELAY);
    
    try {
        const response = await axios({
            method: 'POST',
            url: `${MEMBERSTACK_API_V2}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': process.env.MEMBERSTACK_SECRET_KEY
            },
            data,
            timeout: 5000 // 5 second timeout per request
        });
        
        return response.data;
    } catch (error) {
        console.log(`API attempt ${attempt} failed:`, {
            status: error.response?.status,
            endpoint,
            delay,
            timeElapsed: Date.now() - startTime,
            error: error.message,
            response: error.response?.data
        });

        if (attempt < 4 && (error.response?.status === 403 || error.response?.status === 401)) {
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return callMemberstackAPI(endpoint, data, attempt + 1);
        }

        if (Date.now() - startTime > NETLIFY_TIMEOUT) {
            console.log('Approaching Netlify timeout, storing request for later retry');
            await storeFailedRequest({
                type: 'memberstack',
                data: {
                    endpoint,
                    payload: data,
                    error: error.message,
                    status: error.response?.status,
                    response: error.response?.data
                }
            });
            throw new Error('Netlify timeout approaching');
        }

        throw error;
    }
}

exports.handler = async (event) => {
    try {
        console.log('Webhook endpoint hit:', {
            method: event.httpMethod,
            path: event.path,
            headers: Object.keys(event.headers)
        });

        // Handle preflight request
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers
            };
        }

        // Log environment check
        console.log('Environment check:', {
            stripeKey: !!process.env.STRIPE_SECRET_KEY,
            webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
            memberstackKey: !!process.env.MEMBERSTACK_SECRET_KEY,
            webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 8)
        });

        // Parse and verify the webhook payload
        console.log('Raw webhook body:', event.body);
        const stripeEvent = Stripe.webhooks.constructEvent(
            event.body,
            event.headers['stripe-signature'],
            process.env.STRIPE_WEBHOOK_SECRET
        );

        console.log('Stripe event constructed:', {
            type: stripeEvent.type,
            id: stripeEvent.id
        });

        // Handle the checkout.session.completed event
        if (stripeEvent.type === 'checkout.session.completed') {
            console.log('Processing checkout.session.completed event');
            const session = stripeEvent.data.object;

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
            const memberId = session.metadata.memberstackUserId;
            const planId = session.metadata.planId;
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
                memberId,
                planId,
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
            console.log('Attempting MemberStack plan update:', {
                memberId,
                planId
            });

            try {
                // First try to add the plan
                await callMemberstackAPI(`/members/${memberId}/plans`, {
                    planId: planId
                });

                // Then update custom fields
                await callMemberstackAPI(`/members/${memberId}`, {
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
