const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// CORS headers for all responses
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Shipping rate definitions
const SHIPPING_RATES = {
    AT: { price: 500, label: "Austria Shipping" },
    DE: { price: 1000, label: "Germany Shipping" },
    EU: { price: 1000, label: "Europe Shipping" }
};

// List of EU countries
const EU_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

// Calculate shipping rate based on country
function calculateShippingRate(country) {
    if (!country) {
        throw new Error('Country code is required');
    }

    // Convert to uppercase for consistency
    const countryCode = country.toUpperCase();

    // Check specific countries first
    if (countryCode === 'AT') {
        return SHIPPING_RATES.AT;
    }
    if (countryCode === 'DE') {
        return SHIPPING_RATES.DE;
    }

    // Check if it's an EU country
    if (EU_COUNTRIES.includes(countryCode)) {
        return SHIPPING_RATES.EU;
    }

    // If no matching rate found
    throw new Error(`No shipping rate available for country: ${country}`);
}

exports.handler = async (event, context) => {
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: 'Method not allowed'
            })
        };
    }

    try {
        const { country } = JSON.parse(event.body);
        console.log('Processing shipping for country:', country);

        // Calculate shipping rate
        const shippingRate = calculateShippingRate(country);
        console.log('Calculated shipping rate:', shippingRate);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(shippingRate)
        };

    } catch (error) {
        console.error('Shipping calculation error:', error);

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};
