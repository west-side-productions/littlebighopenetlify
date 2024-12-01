const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Allow requests from Webflow and Netlify domains
const ALLOWED_ORIGINS = [
  'https://little-big-hope-2971af-688db640ffff8f55.webflow.io',
  'https://little-big-hope.netlify.app',
  'http://localhost:8888'
];

function getAllowedOriginHeader(requestOrigin) {
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
}

exports.handler = async function(event, context) {
  const origin = getAllowedOriginHeader(event.headers.origin || event.headers.Origin);
  
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { priceId, successUrl, cancelUrl } = JSON.parse(event.body);

    if (!priceId || !successUrl || !cancelUrl) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Missing required parameters',
          received: { priceId, successUrl, cancelUrl }
        })
      };
    }

    console.log('Creating checkout session with:', { priceId, successUrl, cancelUrl });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      shipping_address_collection: {
        allowed_countries: ['AT', 'DE', 'CH'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 500,
              currency: 'eur',
            },
            display_name: 'Standard Shipping - Austria',
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
            metadata: {
              country: 'AT'
            }
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 1000,
              currency: 'eur',
            },
            display_name: 'Standard Shipping - Germany',
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
            metadata: {
              country: 'DE'
            }
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 1000,
              currency: 'eur',
            },
            display_name: 'Standard Shipping - Switzerland',
            delivery_estimate: {
              minimum: {
                unit: 'business_day',
                value: 5,
              },
              maximum: {
                unit: 'business_day',
                value: 7,
              },
            },
            metadata: {
              country: 'CH'
            }
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log('Checkout session created:', session.id);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        id: session.id,
        url: session.url
      })
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: error.message,
        type: error.type
      })
    };
  }
};
