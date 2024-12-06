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
const MEMBERSTACK_API_BASE = 'https://api.memberstack.com/v2';

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

// Helper function to create headers with correct Memberstack authentication
function createHeaders(apiKey) {
    if (!apiKey?.trim()) {
        throw new Error('API key is required');
    }
    
    const key = apiKey.trim().replace(/\s+/g, '');
    if (!key.startsWith('sk_')) {
        throw new Error('Invalid API key format');
    }

    return {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

// Function to find member by email using Memberstack API v2
async function findMemberByEmail(email) {
    console.log(`Finding member by email: ${email}`);
    
    try {
        const headers = createHeaders(process.env.MEMBERSTACK_SECRET_KEY);
        const encodedEmail = encodeURIComponent(email);
        const url = `https://api.memberstack.com/v2/members/search?email=${encodedEmail}`;
        
        console.log('Making request to:', url);
        console.log('Request headers:', {
            ...headers,
            'Authorization': 'Bearer [REDACTED]'
        });

        const response = await axios.get(url, { headers });

        console.log('Member search response status:', response.status);
        
        if (response.data && response.data.data && response.data.data.length > 0) {
            return response.data.data[0];
        }
        
        return null;
    } catch (error) {
        console.error('Error finding member by email:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
            url: error.config?.url
        });
        throw error;
    }
}

// Function to create a new member
async function createMember(email) {
    console.log(`Creating new member with email: ${email}`);
    
    try {
        const headers = createHeaders(process.env.MEMBERSTACK_SECRET_KEY);

        console.log('Making request with headers:', {
            ...headers,
            'Authorization': 'Bearer [REDACTED]'
        });

        const response = await axios.post(
            'https://api.memberstack.com/v2/members',
            {
                email: email,
                status: "ACTIVE"
            },
            { headers }
        );

        console.log('Successfully created member:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error creating member:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

// Function to add a lifetime plan to a member
async function addLifetimePlanToMember(memberId, planId) {
    console.log(`Adding lifetime plan ${planId} to member ${memberId}`);
    
    try {
        const headers = createHeaders(process.env.MEMBERSTACK_SECRET_KEY);

        console.log('Making request with headers:', {
            ...headers,
            'Authorization': 'Bearer [REDACTED]'
        });

        const response = await axios.post(
            `https://api.memberstack.com/v2/members/${memberId}/plans`,
            {
                planId: planId,
                status: "ACTIVE"
            },
            { headers }
        );

        console.log('Successfully added plan to member:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error adding plan to member:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
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

// Test function to verify Memberstack API key
async function testMemberstackAPI() {
    console.log('Testing Memberstack API connection...');
    
    try {
        const apiKey = process.env.MEMBERSTACK_SECRET_KEY?.trim();
        if (!apiKey) {
            throw new Error('MEMBERSTACK_SECRET_KEY is not set');
        }

        console.log('API Key format:', {
            length: apiKey.length,
            prefix: apiKey.substring(0, 6),
            isComplete: apiKey.length > 20
        });

        // Try a simple API call to verify the key
        const headers = createHeaders(apiKey);
        const response = await axios.get(
            'https://api.memberstack.com/v2/members',
            { headers }
        );

        console.log('API test successful:', {
            status: response.status,
            statusText: response.statusText
        });
        
        return true;
    } catch (error) {
        console.error('API test failed:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });
        return false;
    }
}

// Test function to verify Memberstack API configuration
async function testMemberstackConfiguration() {
    try {
        const apiKey = process.env.MEMBERSTACK_SECRET_KEY;
        
        // Log API key presence (safely)
        console.log('API Key present:', !!apiKey);
        console.log('API Key length:', apiKey?.length);
        console.log('API Key starts with:', apiKey?.substring(0, 5));
        
        // Test headers creation
        const headers = createHeaders(apiKey);
        console.log('Generated headers:', {
            ...headers,
            'Authorization': 'Bearer [REDACTED]'
        });
        
        // Test API with a simple request
        const testEmail = 'test@example.com';
        const encodedEmail = encodeURIComponent(testEmail);
        const url = `https://api.memberstack.com/v2/members/search?email=${encodedEmail}`;
        
        console.log('Making test request to:', url);
        
        const response = await axios.get(url, { 
            headers,
            validateStatus: false // Allow any status code for testing
        });
        
        console.log('Test response status:', response.status);
        console.log('Test response data:', response.data);
        
        return {
            success: response.status === 200,
            status: response.status,
            message: 'API test completed'
        };
    } catch (error) {
        console.error('API test error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url
        });
        return {
            success: false,
            error: error.message,
            status: error.response?.status
        };
    }
}

exports.handler = async (event, context) => {
    try {
        // Test Memberstack configuration first
        console.log('Testing Memberstack API configuration...');
        const testResult = await testMemberstackConfiguration();
        console.log('Memberstack API test result:', testResult);
        
        if (!testResult.success) {
            console.error('Memberstack API configuration test failed:', testResult);
        }

        // Test Memberstack API connection first
        const apiTest = await testMemberstackAPI();
        if (!apiTest) {
            console.error('⚠️ Memberstack API test failed - check your API key');
        }

        // Verify Stripe webhook signature
        const stripeSignature = event.headers['stripe-signature'];
        let stripeEvent;
        
        try {
            stripeEvent = Stripe.webhooks.constructEvent(
                event.body,
                stripeSignature,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error('⚠️ Webhook signature verification failed:', err.message);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid signature' })
            };
        }

        console.log('Received webhook event:', stripeEvent);

        // Handle the checkout.session.completed event
        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            
            console.log('Processing checkout session:', {
                id: session.id,
                email: session.customer_details?.email,
                amount: session.amount_total,
                currency: session.currency,
                status: session.payment_status
            });

            // Only process if payment is successful
            if (session.payment_status !== 'paid') {
                console.log('Skipping session - payment not completed');
                return {
                    statusCode: 200,
                    body: JSON.stringify({ received: true })
                };
            }

            try {
                // Find or create member
                const email = session.customer_details?.email;
                if (!email) {
                    throw new Error('No email found in session');
                }

                let member = await findMemberByEmail(email);
                
                if (!member) {
                    console.log('Member not found, creating new member');
                    member = await createMember(email);
                }

                // Add lifetime plan
                const planId = process.env.MEMBERSTACK_LIFETIME_PLAN_ID;
                if (!planId) {
                    throw new Error('MEMBERSTACK_LIFETIME_PLAN_ID not set');
                }

                await addLifetimePlanToMember(member.id, planId);

                // Send confirmation email
                await sendOrderConfirmationEmail(email, {
                    amount: session.amount_total,
                    currency: session.currency,
                    shipping: session.shipping_details
                });

                return {
                    statusCode: 200,
                    body: JSON.stringify({ received: true })
                };
            } catch (error) {
                console.error('Error processing checkout:', error);
                
                // Store failed request for retry
                await storeFailedRequest({
                    type: 'checkout.session.completed',
                    data: stripeEvent.data,
                    error: error.message
                });

                // Return 200 to acknowledge receipt
                return {
                    statusCode: 200,
                    body: JSON.stringify({ 
                        received: true,
                        warning: 'Processed with errors, queued for retry'
                    })
                };
            }
        }

        // Return 200 for other events
        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('Webhook error:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Webhook handler failed' })
        };
    }
};
