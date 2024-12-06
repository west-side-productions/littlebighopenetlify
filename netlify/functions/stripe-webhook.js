const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load email templates
const emailTemplates = {
    de: require('./email-templates/de')
};

// Memberstack API URL
const MEMBERSTACK_API_V1 = 'https://api.memberstack.com/v1';

// Constants for API interaction
const MAX_RETRIES = 4;
const INITIAL_DELAY = 1000;
const MAX_DELAY = 3000;
const NETLIFY_TIMEOUT = 25000; // Leave 5s buffer from 30s limit

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
            url: `${MEMBERSTACK_API_V1}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            data: {
                secretKey: process.env.MEMBERSTACK_SECRET_KEY,
                ...data
            },
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
            response: error.response?.data // Add response data for better debugging
        });

        // Check if we're approaching the Netlify timeout
        if (Date.now() - startTime > NETLIFY_TIMEOUT) {
            console.log('Approaching Netlify timeout, storing request for later retry');
            await storeFailedRequest({
                type: 'memberstack_timeout',
                data: {
                    endpoint,
                    payload: data,
                    error: 'Netlify timeout approaching',
                    attempts: attempt
                }
            });
            throw new Error('Netlify timeout approaching');
        }

        // If we have retries left and time remaining, retry on specific errors
        if (attempt < MAX_RETRIES && (error.response?.status === 502 || error.response?.status === 400)) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return callMemberstackAPI(endpoint, data, attempt + 1);
        }

        // Store failed request if we've exhausted retries
        await storeFailedRequest({
            type: 'memberstack',
            data: {
                endpoint,
                payload: data,
                error: error.message,
                status: error.response?.status,
                response: error.response?.data // Add response data for debugging
            }
        });
        throw error;
    }
}

exports.handler = async (event) => {
    console.log('Webhook endpoint hit:', {
        method: event.httpMethod,
        path: event.path,
        headers: Object.keys(event.headers)
    });

    // Add comprehensive validation
    if (!event.body) {
        console.error('Missing request body');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: 'Invalid request',
                details: 'Request body is required'
            })
        };
    }

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers
        };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        console.log('Raw webhook body:', event.body);
        
        const sig = event.headers['stripe-signature'];
        console.log('Stripe signature:', sig ? sig.substring(0, 20) + '...' : 'missing');
        
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
        console.log('Environment check:', {
            stripeKey: !!process.env.STRIPE_SECRET_KEY,
            webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
            memberstackKey: !!process.env.MEMBERSTACK_SECRET_KEY,
            webhookSecretPrefix: endpointSecret ? endpointSecret.substring(0, 8) : 'missing'
        });

        let stripeEvent;
        try {
            stripeEvent = Stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
            console.log('Stripe event constructed:', {
                type: stripeEvent.type,
                id: stripeEvent.id
            });
        } catch (err) {
            console.error('Error constructing webhook event:', err);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
            };
        }

        // Handle the event
        switch (stripeEvent.type) {
            case 'checkout.session.completed':
                console.log('Processing checkout.session.completed event');
                const session = stripeEvent.data.object;
                
                // Log complete session data
                console.log('Checkout session details:', {
                    id: session.id,
                    customer: session.customer,
                    customerEmail: session.customer_email,
                    shipping: session.shipping,
                    metadata: session.metadata
                });

                // Validate required metadata
                const requiredMetadata = [
                    'memberstackUserId', 
                    'planId', 
                    'countryCode', 
                    'totalWeight',
                    'productWeight',
                    'packagingWeight'
                ];
                const missingMetadata = requiredMetadata.filter(field => !session.metadata?.[field]);
                
                if (missingMetadata.length > 0) {
                    console.error('Missing required metadata:', missingMetadata);
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            error: 'Invalid metadata',
                            details: `Missing required fields: ${missingMetadata.join(', ')}`
                        })
                    };
                }

                // Validate weight values are numeric
                const weightFields = ['totalWeight', 'productWeight', 'packagingWeight'];
                const invalidWeights = weightFields.filter(field => 
                    isNaN(Number(session.metadata[field]))
                );

                if (invalidWeights.length > 0) {
                    console.error('Invalid weight values:', invalidWeights);
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            error: 'Invalid weight values',
                            details: `Non-numeric weight fields: ${invalidWeights.join(', ')}`
                        })
                    };
                }

                // Validate total weight matches sum of product and packaging
                const totalWeight = Number(session.metadata.totalWeight);
                const productWeight = Number(session.metadata.productWeight);
                const packagingWeight = Number(session.metadata.packagingWeight);

                if (totalWeight !== (productWeight + packagingWeight)) {
                    console.error('Weight mismatch:', {
                        total: totalWeight,
                        sum: productWeight + packagingWeight,
                        product: productWeight,
                        packaging: packagingWeight
                    });
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            error: 'Weight mismatch',
                            details: 'Total weight does not match sum of product and packaging weights'
                        })
                    };
                }

                // Validate shipping information
                let shippingCountry;
                if (session.shipping?.address?.country) {
                    shippingCountry = session.shipping.address.country;
                } else if (session.metadata?.countryCode) {
                    shippingCountry = session.metadata.countryCode;
                    console.log('Using country code from metadata:', shippingCountry);
                } else {
                    console.error('Missing shipping country');
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({
                            error: 'Invalid shipping',
                            details: 'Shipping country is required'
                        })
                    };
                }

                try {
                    // Calculate shipping rate for the country
                    const shippingRate = calculateShippingRate(shippingCountry);
                    console.log('Shipping calculation:', {
                        country: shippingCountry,
                        calculatedRate: shippingRate,
                        totalWeight: session.metadata.totalWeight,
                        productWeight: session.metadata.productWeight,
                        packagingWeight: session.metadata.packagingWeight,
                        source: session.metadata.source
                    });

                    // Prepare data for MemberStack
                    const memberStackData = {
                        memberId: session.metadata.memberstackUserId,
                        planId: session.metadata.planId,
                        customFields: {
                            shippingCountry: shippingCountry,
                            shippingRate: shippingRate.price,
                            totalWeight: Number(session.metadata.totalWeight),
                            productWeight: Number(session.metadata.productWeight),
                            packagingWeight: Number(session.metadata.packagingWeight),
                            checkoutSessionId: session.id,
                            source: session.metadata.source,
                            orderDate: new Date().toISOString()
                        }
                    };

                    console.log('Preparing MemberStack update:', memberStackData);

                    // Send order notification email first
                    try {
                        console.log('Sending order notification email...');
                        const template = emailTemplates['de'];
                        const emailData = {
                            orderDetails: {
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
                                    productWeight: session.metadata.productWeight,
                                    packagingWeight: session.metadata.packagingWeight,
                                    totalWeight: session.metadata.totalWeight
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
                            }
                        };

                        const msg = {
                            to: 'office@west-side-productions.at',
                            from: process.env.SENDGRID_FROM_EMAIL,
                            subject: template.order_notification.subject,
                            html: template.order_notification.html(emailData)
                        };

                        await retryWithBackoff(async () => {
                            const response = await sgMail.send(msg);
                            console.log('Order notification email sent successfully:', response[0].statusCode);
                            return response;
                        }, 3, 1000);
                    } catch (emailError) {
                        console.error('Failed to send order notification email:', {
                            error: emailError.message,
                            response: emailError.response?.data,
                            stack: emailError.stack
                        });
                        // Store failed email request for retry
                        await storeFailedRequest({
                            type: 'email',
                            data: {
                                sessionId: session.id,
                                customerEmail: session.customer_details.email,
                                error: emailError.message
                            }
                        });
                    }

                    // Now try to add the Memberstack plan
                    console.log('Attempting MemberStack plan update:', {
                        memberId: memberStackData.memberId,
                        planId: session.metadata.planId
                    });

                    try {
                        // Try to add the plan first
                        try {
                            const planResponse = await callMemberstackAPI('/members/add-plan', {
                                memberId: memberStackData.memberId,
                                planId: session.metadata.planId
                            });
                            console.log('Plan addition complete:', planResponse);
                            
                            // If plan addition succeeds, update custom fields
                            try {
                                const updateResponse = await callMemberstackAPI('/members/update', {
                                    id: memberStackData.memberId,
                                    customFields: memberStackData.customFields
                                });
                                console.log('Member custom fields update response:', updateResponse);
                            } catch (updateError) {
                                // Store the custom fields update for retry but don't block
                                await storeFailedRequest({
                                    type: 'memberstack_update',
                                    data: {
                                        memberId: memberStackData.memberId,
                                        customFields: memberStackData.customFields,
                                        error: updateError.message
                                    }
                                });
                                console.log('Custom fields update stored for retry:', updateError.message);
                            }
                        } catch (planError) {
                            // Store the plan addition for retry but don't block the webhook
                            await storeFailedRequest({
                                type: 'memberstack_plan',
                                data: {
                                    memberId: memberStackData.memberId,
                                    planId: session.metadata.planId,
                                    error: planError.message
                                }
                            });
                            console.log('Plan addition stored for retry:', planError.message);
                        }
                    } catch (error) {
                        console.error('MemberStack API error:', {
                            message: error.message,
                            memberId: memberStackData.memberId,
                            response: error.response?.data
                        });
                        
                        // Store the error but don't throw - let the webhook complete
                        await storeFailedRequest({
                            type: 'memberstack_update',
                            data: {
                                sessionId: session.id,
                                memberId: memberStackData.memberId,
                                planId: session.metadata.planId,
                                customFields: memberStackData.customFields,
                                error: error.message
                            }
                        });
                    }

                    // Process shipping if needed
                    if (memberStackData.customFields.shippingCountry) {
                        try {
                            const shippingResponse = await axios({
                                method: 'POST',
                                url: `${process.env.URL}/.netlify/functions/process-shipping`,
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                data: {
                                    countryCode: shippingCountry,
                                    memberId: memberStackData.memberId,
                                    productWeight: memberStackData.customFields.productWeight,
                                    packagingWeight: memberStackData.customFields.packagingWeight
                                }
                            });

                            console.log('Shipping process response:', shippingResponse.data);
                        } catch (shippingError) {
                            console.error('Shipping process error:', {
                                message: shippingError.message,
                                response: shippingError.response?.data
                            });
                            // Store failed shipping request for retry
                            await storeFailedRequest({
                                type: 'shipping',
                                data: {
                                    countryCode: shippingCountry,
                                    memberId: memberStackData.memberId,
                                    productWeight: memberStackData.customFields.productWeight,
                                    packagingWeight: memberStackData.customFields.packagingWeight,
                                    error: shippingError.message
                                }
                            });
                        }
                    }

                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            received: true,
                            memberstackUserId: memberStackData.memberId,
                            memberstackPlanId: memberStackData.planId,
                            countryCode: shippingCountry,
                            totalWeight: memberStackData.customFields.totalWeight,
                            productWeight: memberStackData.customFields.productWeight,
                            packagingWeight: memberStackData.customFields.packagingWeight
                        })
                    };
                } catch (error) {
                    console.error('MemberStack API error:', {
                        message: error.message,
                        response: error.response?.data,
                        status: error.response?.status
                    });
                    throw error; // Re-throw to be caught by outer try-catch
                }
                break;  
            
            case 'payment_intent.payment_failed':
                const paymentIntent = stripeEvent.data.object;
                console.error('Payment failed:', {
                    customer: paymentIntent.customer,
                    error: paymentIntent.last_payment_error
                });
                break;
            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ 
                        received: true, 
                        type: stripeEvent.type 
                    })
                };
        }
    } catch (error) {
        console.error('Webhook handler error:', {
            message: error.message,
            stack: error.stack
        });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                details: error.stack
            })
        };
    }
};
