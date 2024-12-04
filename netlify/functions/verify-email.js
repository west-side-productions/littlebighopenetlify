const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    // Get the verification token from query parameters
    const params = new URLSearchParams(event.queryStringParameters);
    const token = params.get('token');

    if (!token) {
      throw new Error('Verification token is missing');
    }

    // Decode the token to get memberId and timestamp
    const [memberId, timestamp] = Buffer.from(token, 'base64').toString().split(':');

    // Verify the token hasn't expired (24 hour limit)
    const tokenAge = Date.now() - parseInt(timestamp);
    if (tokenAge > 24 * 60 * 60 * 1000) {
      throw new Error('Verification token has expired');
    }

    // Update member verification status in Memberstack
    const updateResponse = await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MEMBERSTACK_API_KEY}`
      },
      body: JSON.stringify({
        verified: true
      })
    });

    if (!updateResponse.ok) {
      throw new Error('Failed to verify member in Memberstack');
    }

    // Get member details to send confirmation email
    const memberResponse = await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MEMBERSTACK_API_KEY}`
      }
    });

    if (!memberResponse.ok) {
      throw new Error('Failed to fetch member details');
    }

    const member = await memberResponse.json();

    // Send verification confirmation email
    await fetch(`${process.env.URL}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: member.auth.email,
        templateName: 'email_verified',
        language: member.customFields.language || 'de',
        variables: {
          firstName: member.customFields['first-name'] || ''
        }
      })
    });

    // Redirect to success page
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.SITE_URL}/verification-success`
      }
    };
  } catch (error) {
    console.error('Error verifying email:', error);
    
    // Redirect to error page
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.SITE_URL}/verification-error?message=${encodeURIComponent(error.message)}`
      }
    };
  }
};
