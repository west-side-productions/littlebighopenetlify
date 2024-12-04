const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');

// Memberstack API URLs
const MEMBERSTACK_API_V1 = 'https://api.memberstack.com/v1';
const MEMBERSTACK_API_V2 = 'https://api.memberstack.com/v2';

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
        AT: { price: 500, label: "Austria Shipping" },
        DE: { price: 1000, label: "Germany Shipping" },
        EU: { price: 1000, label: "Europe Shipping" }
    };

    // EU country list
    const EU_COUNTRIES = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];

    if (countryCode === 'AT') return SHIPPING_RATES.AT;
    if (countryCode === 'DE') return SHIPPING_RATES.DE;
    if (EU_COUNTRIES.includes(countryCode)) return SHIPPING_RATES.EU;

    throw new Error(`No shipping rate available for country: ${countryCode}`);
}

// Add retry helper function at the top level
async function retryWithBackoff(operation, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (error.response?.status === 502) {
                const delay = initialDelay * Math.pow(2, i);
                console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error; // If it's not a 502 error, throw immediately
        }
    }
    throw lastError;
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

                    // Add plan to member using Memberstack API
                    try {
                        // First try V2 API with retry logic
                        const v2Url = `${MEMBERSTACK_API_V2}/members/${memberStackData.memberId}/plans/${memberStackData.planId}`;
                        console.log('Attempting MemberStack V2 API:', {
                            url: v2Url,
                            memberId: memberStackData.memberId,
                            planId: memberStackData.planId
                        });

                        try {
                            const v2Response = await retryWithBackoff(async () => {
                                return await axios({
                                    method: 'POST',
                                    url: v2Url,
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
                                    },
                                    data: {
                                        status: 'ACTIVE',
                                        customFields: memberStackData.customFields
                                    }
                                });
                            });

                            console.log('MemberStack V2 API response:', {
                                status: v2Response.status,
                                data: v2Response.data
                            });

                            if (v2Response.status === 200 || v2Response.status === 201) {
                                console.log('Successfully added plan using V2 API');
                            } else {
                                throw new Error('Unexpected response status');
                            }
                        } catch (v2Error) {
                            console.log('V2 API failed, falling back to V1:', v2Error.message);
                            
                            // Fallback to V1 API with retry logic
                            const v1Url = `${MEMBERSTACK_API_V1}/members/add-plan`;
                            console.log('Attempting MemberStack V1 API:', {
                                url: v1Url,
                                memberId: memberStackData.memberId,
                                planId: memberStackData.planId
                            });

                            const v1Response = await retryWithBackoff(async () => {
                                return await axios({
                                    method: 'POST',
                                    url: v1Url,
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
                                    },
                                    data: {
                                        planId: memberStackData.planId,
                                        memberId: memberStackData.memberId,
                                        status: 'ACTIVE'
                                    }
                                });
                            });

                            console.log('MemberStack V1 API response:', {
                                status: v1Response.status,
                                data: v1Response.data
                            });

                            if (v1Response.status !== 200) {
                                throw new Error(`V1 API failed: ${v1Response.status}`);
                            }
                        }

                        // Update member custom fields separately with retry logic
                        const updateUrl = `${MEMBERSTACK_API_V2}/members/${memberStackData.memberId}`;
                        const updateResponse = await retryWithBackoff(async () => {
                            return await axios({
                                method: 'PATCH',
                                url: updateUrl,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
                                },
                                data: {
                                    customFields: memberStackData.customFields
                                }
                            });
                        });

                        console.log('Member custom fields update response:', {
                            status: updateResponse.status,
                            data: updateResponse.data
                        });

                        // Process shipping information
                        console.log('Processing shipping...');
                        try {
                            const shippingResponse = await axios({
                                method: 'POST',
                                url: '/.netlify/functions/process-shipping',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                data: JSON.stringify({
                                    countryCode: shippingCountry,
                                    memberId: session.metadata.memberstackUserId,
                                    sessionId: session.id,
                                    totalWeight: session.metadata.totalWeight,
                                    productWeight: session.metadata.productWeight,
                                    packagingWeight: session.metadata.packagingWeight
                                })
                            });

                            console.log('Shipping processed:', shippingResponse.data);
                        } catch (shippingError) {
                            console.error('Shipping process failed:', {
                                error: shippingError.message,
                                response: shippingError.response?.data
                            });
                            // Continue even if shipping fails
                        }

                        return {
                            statusCode: 200,
                            headers,
                            body: JSON.stringify({ 
                                received: true,
                                memberstackUserId: session.metadata.memberstackUserId,
                                memberstackPlanId: session.metadata.planId,
                                countryCode: shippingCountry,
                                totalWeight: session.metadata.totalWeight,
                                productWeight: session.metadata.productWeight,
                                packagingWeight: session.metadata.packagingWeight
                            })
                        };
                    } catch (memberstackError) {
                        console.error('Memberstack API error:', {
                            message: memberstackError.message,
                            response: memberstackError.response?.data,
                            status: memberstackError.response?.status
                        });
                        throw memberstackError;
                    }
                } catch (error) {
                    console.error('Error processing webhook:', {
                        message: error.message,
                        response: error.response?.data,
                        stack: error.stack
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
