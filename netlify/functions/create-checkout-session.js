const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Allow requests from Webflow and Netlify domains
const ALLOWED_ORIGINS = [
  'https://little-big-hope-2971af-688db640ffff8f55.webflow.io',
  'https://lillebighopefunctions.netlify.app',
  'https://lbhtest.netlify.app',
  'http://localhost:8888',
  'http://localhost:3000'
];

// Shipping rate configuration
const SHIPPING_RATES = {
    AT: { amount: 500, label: 'Austria Shipping' },  // €5.00
    DE: { amount: 1000, label: 'Germany Shipping' }, // €10.00
    CH: { amount: 1000, label: 'Switzerland Shipping' } // €10.00
};

function getAllowedOriginHeader(requestOrigin) {
  // During development, allow any origin if not in production
  if (process.env.NODE_ENV !== 'production') {
    return requestOrigin || '*';
  }
  // Check if the origin is in our allowed list
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  // Default to the first allowed origin if none match
  return ALLOWED_ORIGINS[0];
}

// Helper function to add CORS headers
function addCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

exports.handler = async function(event, context) {
  console.log('Received request:', {
    method: event.httpMethod,
    origin: event.headers.origin || event.headers.Origin,
    path: event.path
  });

  const origin = getAllowedOriginHeader(event.headers.origin || event.headers.Origin);
  
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return {
      statusCode: 200,
      headers: addCorsHeaders(origin),
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    console.log('Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      headers: addCorsHeaders(origin),
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('Processing POST request');
    const data = JSON.parse(event.body);
    const { priceId, successUrl, cancelUrl, customerEmail, shipping, metadata } = data;

    if (!priceId || !successUrl || !cancelUrl || !customerEmail || !shipping) {
      console.log('Missing required parameters:', { priceId, successUrl, cancelUrl, customerEmail, shipping });
      return {
        statusCode: 400,
        headers: addCorsHeaders(origin),
        body: JSON.stringify({ 
          error: 'Missing required parameters',
          received: { priceId, successUrl, cancelUrl, customerEmail, shipping }
        })
      };
    }

    // Create dynamic shipping options
    const shipping_options = Object.entries(SHIPPING_RATES).map(([country, rate]) => ({
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: {
          amount: rate.amount,
          currency: 'eur',
        },
        display_name: rate.label,
        delivery_estimate: {
          minimum: {
            unit: 'business_day',
            value: 3,
          },
          maximum: {
            unit: 'business_day',
            value: 5,
          },
        },
      }
    }));

    console.log('Creating checkout session with:', { 
      priceId,
      successUrl,
      cancelUrl,
      customerEmail,
      shipping,
      metadata 
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      shipping_address_collection: {
        allowed_countries: shipping.allowedCountries
      },
      shipping_options,
      metadata: {
        ...metadata,
        source: 'little-big-hope'
      }
    });

    console.log('Checkout session created:', session.id);

    return {
      statusCode: 200,
      headers: addCorsHeaders(origin),
      body: JSON.stringify({ 
        id: session.id,
        url: session.url
      })
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    return {
      statusCode: 500,
      headers: addCorsHeaders(origin),
      body: JSON.stringify({ 
        error: {
          message: error.message,
          type: error.type
        }
      })
    };
  }
};
