const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Configure CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Product Configuration
const PRODUCT_CONFIG = {
    book: {
        type: 'physical',
        requiresShipping: true,
        weight: 450, // in grams
        packagingWeight: 50, // in grams
        prices: {
            de: 'price_1QScHkJRMXFic4sWXYZ123AB', // €49
            en: 'price_1QScHkJRMXFic4sWABC456CD'
        }
    },
    course: {
        type: 'digital',
        requiresShipping: false,
        prices: {
            de: 'price_1QScIpJRMXFic4sWDEF789GH', // €60
            en: 'price_1QScIpJRMXFic4sWIJK012LM'
        }
    },
    bundle: {
        type: 'bundle',
        requiresShipping: true,
        components: ['book', 'course'],
        discountAmount: 1400, // €14 discount (to make total €95 instead of €109)
        weight: 450,
        packagingWeight: 50
    }
};

exports.handler = async function(event, context) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        if (event.httpMethod !== 'POST') {
            throw new Error('Method not allowed');
        }

        const data = JSON.parse(event.body);
        const { email, language, productType, shippingRateId } = data;
        
        if (!email || !productType) {
            throw new Error('Missing required fields');
        }

        const config = PRODUCT_CONFIG[productType];
        if (!config) {
            throw new Error('Invalid product type');
        }

        // Prepare session parameters
        const sessionParams = {
            customer_email: email,
            mode: 'payment',
            success_url: `${data.successUrl || 'https://lillebighope.at/vielen-dank-email'}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: data.cancelUrl || 'https://lillebighope.at',
            automatic_tax: { enabled: true },
            billing_address_collection: 'required',
            allow_promotion_codes: true,
            metadata: {
                productType,
                language
            }
        };

        // Handle shipping if required
        if (config.requiresShipping && shippingRateId) {
            sessionParams.shipping_options = [{
                shipping_rate: shippingRateId
            }];
            sessionParams.shipping_address_collection = {
                allowed_countries: ['AT', 'DE', 'GB', 'SG']
            };
        }

        // Handle bundle vs single product
        if (config.type === 'bundle') {
            // Create a discount for the bundle
            const discount = await stripe.coupons.create({
                amount_off: config.discountAmount,
                currency: 'eur',
                name: 'Bundle Discount',
                duration: 'once'
            });

            // Add both products
            sessionParams.line_items = config.components.map(componentType => {
                const componentConfig = PRODUCT_CONFIG[componentType];
                return {
                    price: componentConfig.prices[language] || componentConfig.prices['de'],
                    quantity: 1,
                    adjustable_quantity: { enabled: false }
                };
            });

            // Apply the discount
            sessionParams.discounts = [{
                coupon: discount.id
            }];
        } else {
            // Single product
            sessionParams.line_items = [{
                price: config.prices[language] || config.prices['de'],
                quantity: 1,
                adjustable_quantity: { enabled: false }
            }];
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create(sessionParams);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ id: session.id })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};