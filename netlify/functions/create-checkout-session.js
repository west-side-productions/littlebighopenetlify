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
        weight: 1005,
        packagingWeight: 156,
        prices: {
            de: 'price_1QSkYvJRMXFic4sWeAmPTYAe',
            en: 'price_1QSkYvJRMXFic4sWeAmPTYAe',
            fr: 'price_1QSkYvJRMXFic4sWeAmPTYAe',
            it: 'price_1QSkYvJRMXFic4sWeAmPTYAe'
        },
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
    },
    course: {
        type: 'digital',
        requiresShipping: false,
        prices: {
            de: 'price_1QUAGZJRMXFic4sWrT05083n',
            en: 'price_1QUAGZJRMXFic4sWrT05083n',
            fr: 'price_1QUAGZJRMXFic4sWrT05083n',
            it: 'price_1QUAGZJRMXFic4sWrT05083n'
        },
        memberstackPlanId: 'pln_bundle-rd004n7'
    },
    bundle: {
        type: 'bundle',
        requiresShipping: true,
        components: ['book', 'course'],
        discountAmount: 1400, // €14 discount
        weight: 1005,
        packagingWeight: 156,
        memberstackPlanId: 'pln_bundle-rd004n7',  // Use free bundle plan
        prices: {
            de: 'price_1QSkYvJRMXFic4sWeAmPTYAe',
            en: 'price_1QSkYvJRMXFic4sWeAmPTYAe',
            fr: 'price_1QSkYvJRMXFic4sWeAmPTYAe',
            it: 'price_1QSkYvJRMXFic4sWeAmPTYAe'
        }
    }
};

// Shipping Rates from Documentation
const SHIPPING_RATES = {
    'shr_1QjI5oJRMXFic4sWJvDUJlzU': { 
        price: 0, 
        label: 'Österreich', 
        countries: ['AT']
    },
    'shr_1QjI0sJRMXFic4sWHjuPK2hx': { 
        price: 20.36, 
        label: 'Europe', 
        countries: [
            'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
        ]
    },
    'shr_1QjI2gJRMXFic4sWUDisEAPh': { 
        price: 20.72, 
        label: 'Great Britain', 
        countries: ['GB']
    },
    'shr_1QjI1pJRMXFic4sWTsmZOJiK': { 
        price: 36.53, 
        label: 'Singapore', 
        countries: ['SG']
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

        console.log('Received request body:', event.body);
        const data = JSON.parse(event.body);
        console.log('Parsed request data:', data);

        // Validate required fields
        const requiredFields = ['email', 'language', 'productType'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            console.error('Missing required fields:', missingFields);
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        const config = PRODUCT_CONFIG[data.productType];
        if (!config) {
            throw new Error(`Invalid product type: ${data.productType}`);
        }

        // Get shipping rate data if provided
        const shippingRate = data.shippingRateId ? SHIPPING_RATES[data.shippingRateId] : null;
        console.log('Shipping rate data:', {
            providedRateId: data.shippingRateId,
            foundRate: shippingRate,
            requiresShipping: config.requiresShipping,
            allRates: Object.keys(SHIPPING_RATES)
        });

        // Validate shipping rate for physical products
        if (config.requiresShipping) {
            if (!data.shippingRateId) {
                throw new Error('Shipping rate is required for physical products');
            }
            if (!shippingRate) {
                throw new Error(`Invalid shipping rate ID: ${data.shippingRateId}`);
            }
        }

        // Prepare session parameters
        const sessionParams = {
            customer_email: data.email,
            mode: 'payment',
            success_url: data.successUrl || `${process.env.SITE_URL}/vielen-dank-email?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: data.cancelUrl || process.env.SITE_URL,
            automatic_tax: { enabled: true },
            tax_id_collection: { enabled: true },
            billing_address_collection: 'required',
            metadata: {
                productType: data.productType,
                language: data.language,
                memberstackUserId: data.memberstackUserId,  
                memberstackPlanId: config.memberstackPlanId,
                type: config.type,
                productWeight: config.weight?.toString() || '0',
                packagingWeight: config.packagingWeight?.toString() || '0',
                totalWeight: ((config.weight || 0) + (config.packagingWeight || 0)).toString(),
                ...data.metadata  
            }
        };

        // Handle shipping if required
        if (config.requiresShipping && shippingRate) {
            console.log('Adding shipping options to session:', {
                rateId: data.shippingRateId,
                countries: shippingRate.countries,
                sessionParams
            });
            sessionParams.shipping_options = [{
                shipping_rate: data.shippingRateId
            }];
            sessionParams.shipping_address_collection = {
                allowed_countries: shippingRate.countries
            };
            
            // Add weight information for physical products
            if (config.weight) {
                sessionParams.metadata.productWeight = config.weight.toString();
                sessionParams.metadata.packagingWeight = config.packagingWeight.toString();
                sessionParams.metadata.totalWeight = (config.weight + config.packagingWeight).toString();
            }
        }

        // Handle bundle vs single product
        if (config.type === 'bundle') {
            // Add both products
            sessionParams.line_items = config.components.map(componentType => {
                const componentConfig = PRODUCT_CONFIG[componentType];
                return {
                    price: componentConfig.prices[data.language] || componentConfig.prices['de'],
                    quantity: 1,
                    adjustable_quantity: { enabled: false }
                };
            });

            // Create and apply fixed amount coupon
            const coupon = await stripe.coupons.create({
                amount_off: config.discountAmount,
                currency: 'eur',
                name: 'Bundle Discount',
                duration: 'once'
            });
            sessionParams.discounts = [{ coupon: coupon.id }];
        } else {
            // Single product
            sessionParams.line_items = [{
                price: config.prices[data.language] || config.prices['de'],
                quantity: 1,
                adjustable_quantity: { enabled: false }
            }];
            // Allow promotion codes only for non-bundle products
            sessionParams.allow_promotion_codes = true;
        }

        console.log('Creating Stripe session with params:', sessionParams);
        const session = await stripe.checkout.sessions.create(sessionParams);
        console.log('Created session:', session.id);

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
            body: JSON.stringify({ 
                error: error.message,
                details: error.stack
            })
        };
    }
};
