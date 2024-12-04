const fetch = require('node-fetch');
const MEMBERSTACK_API_URL = 'https://api.memberstack.com/v1';

exports.handler = async (event, context) => {
  console.log('Starting email verification process');
  console.log('Query parameters:', event.queryStringParameters);

  if (event.httpMethod !== 'GET') {
    console.log('Invalid HTTP method:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  if (!process.env.MEMBERSTACK_SECRET_KEY) {
    console.error('MEMBERSTACK_SECRET_KEY is not set');
    return {
      statusCode: 302,
      headers: {
        Location: `https://littlebighope.com/verification-error?message=${encodeURIComponent('Server configuration error')}`
      }
    };
  }

  try {
    // Get the verification token from query parameters
    const params = new URLSearchParams(event.queryStringParameters);
    const token = params.get('token');
    console.log('Received verification token:', token);

    if (!token) {
      throw new Error('Verification token is missing');
    }

    // Decode the token to get memberId and timestamp
    let memberId, timestamp;
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      console.log('Decoded token:', decoded);
      [memberId, timestamp] = decoded.split(':');
      
      if (!memberId || !timestamp) {
        throw new Error('Invalid token format');
      }
    } catch (e) {
      console.error('Token decoding error:', e);
      throw new Error('Invalid verification token format');
    }

    // Verify the token hasn't expired (24 hour limit)
    const tokenAge = Date.now() - parseInt(timestamp);
    console.log('Token age (ms):', tokenAge);
    
    if (tokenAge > 24 * 60 * 60 * 1000) {
      throw new Error('Verification token has expired');
    }

    // Update member verification status in Memberstack
    console.log('Updating member verification status for ID:', memberId);
    const updateResponse = await fetch(`${MEMBERSTACK_API_URL}/members/${memberId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
      },
      body: JSON.stringify({
        verified: true
      })
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.text();
      console.error('Memberstack update failed:', errorData);
      throw new Error('Failed to verify member in Memberstack');
    }

    // Get member details to send confirmation email
    console.log('Fetching member details');
    const memberResponse = await fetch(`${MEMBERSTACK_API_URL}/members/${memberId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
      }
    });

    if (!memberResponse.ok) {
      const errorData = await memberResponse.text();
      console.error('Failed to fetch member details:', errorData);
      throw new Error('Failed to fetch member details');
    }

    const member = await memberResponse.json();
    console.log('Member details retrieved:', { 
      email: member.auth?.email,
      language: member.customFields?.language
    });

    // Send verification confirmation email
    console.log('Sending confirmation email');
    const emailResponse = await fetch(`${process.env.URL}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: member.auth.email,
        templateName: 'email_verified',
        language: member.customFields?.language || 'de',
        variables: {
          firstName: member.customFields?.['first-name'] || ''
        }
      })
    });

    if (!emailResponse.ok) {
      console.warn('Failed to send confirmation email:', await emailResponse.text());
    }

    console.log('Verification successful, redirecting to success page');
    return {
      statusCode: 302,
      headers: {
        Location: `https://littlebighope.com/verification-success`
      }
    };
  } catch (error) {
    console.error('Error verifying email:', error);
    console.error('Stack trace:', error.stack);
    
    return {
      statusCode: 302,
      headers: {
        Location: `https://littlebighope.com/verification-error?message=${encodeURIComponent(error.message || 'Unknown error occurred')}`
      }
    };
  }
};
