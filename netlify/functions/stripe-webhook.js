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
async function retryWithBackoff(operation, maxRetries = 5, initialDelay = 2000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            // Consider more error codes that warrant a retry
            const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
            if (retryableStatusCodes.includes(error.response?.status)) {
                const delay = initialDelay * Math.pow(2, i);
                console.log(`Attempt ${i + 1} failed with status ${error.response?.status}, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error; // If it's not a retryable error, throw immediately
        }
    }
    // If we've exhausted all retries, store the failed request before throwing
    try {
        await storeFailedRequest({
            type: 'memberstack_plan',
            data: lastError.config?.data,
            error: {
                message: lastError.message,
                status: lastError.response?.status,
                data: lastError.response?.data
            }
        });
    } catch (storeError) {
        console.error('Failed to store failed request:', storeError);
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
                    console.log('Attempting MemberStack plan addition:', {
                        url: `${MEMBERSTACK_API_V1}/members/add-plan`,
                        memberId: memberStackData.memberId,
                        planId: session.metadata.planId
                    });

                    try {
                        const v1Response = await retryWithBackoff(async () => {
                            const response = await axios({
                                method: 'POST',
                                url: `${MEMBERSTACK_API_V1}/members/add-plan`,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
                                },
                                data: {
                                    planId: session.metadata.planId,
                                    memberId: memberStackData.memberId
                                }
                            });
                            console.log('MemberStack plan addition successful:', response.data);
                            return response;
                        }, 5, 2000); // 5 retries, 2 second initial delay

                        console.log('MemberStack plan addition complete:', {
                            status: v1Response.status,
                            data: v1Response.data
                        });
                    } catch (error) {
                        console.error('MemberStack API error:', {
                            message: error.message,
                            response: error.response?.data,
                            status: error.response?.status
                        });
                        throw error; // Re-throw to trigger webhook retry
                    }

                    // Update custom fields separately
                    const updateUrl = `${MEMBERSTACK_API_V1}/members/${memberStackData.memberId}`;
                    const updateResponse = await retryWithBackoff(async () => {
                        return await axios({
                            method: 'POST',
                            url: updateUrl,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
                            },
                            data: {
                                customFields: memberStackData.customFields
                            }
                        });
                    }, 5, 2000);

                    console.log('Member custom fields update response:', {
                        status: updateResponse.status,
                        data: updateResponse.data
                    });

                    // Process shipping if needed
                    if (memberStackData.customFields.shippingCountry) {
                        const shippingResponse = await axios({
                            method: 'POST',
                            url: '/.netlify/functions/process-shipping',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            data: {
                                countryCode: shippingCountry,
                                memberId: memberStackData.memberId,
                                sessionId: session.id,
                                totalWeight: memberStackData.customFields.totalWeight,
                                productWeight: memberStackData.customFields.productWeight,
                                packagingWeight: memberStackData.customFields.packagingWeight
                            }
                        });

                        console.log('Shipping process response:', shippingResponse.data);
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
