const fetch = require('node-fetch');
const MEMBERSTACK_API_URL = 'https://api.memberstack.com/v1';

exports.handler = async (event, context) => {
  console.log('Raw webhook payload:', event.body);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    // Parse the webhook payload
    const payload = JSON.parse(event.body);
    console.log('Parsed webhook payload:', payload);

    // Extract member data
    const { auth, customFields, id } = payload.payload;
    console.log('Processing webhook type:', payload.event);
    console.log('Handling member created with full data:', payload.payload);

    // Generate verification token
    const verificationToken = Buffer.from(`${id}:${Date.now()}`).toString('base64');
    const verificationLink = `https://littlebighope.com/verify?token=${verificationToken}`;

    // Send verification email
    const emailResponse = await fetch(`${process.env.URL}/.netlify/functions/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: auth.email,
        templateName: 'email_verification',
        language: customFields.language || 'de',
        variables: {
          firstName: customFields['first-name'] || '',
          verificationLink
        }
      })
    });

    if (!emailResponse.ok) {
      throw new Error('Failed to send verification email');
    }

    // Note: We no longer call process-shipping here since we don't have country data yet
    // Shipping will be handled during checkout when we have the country code

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Member created successfully',
        memberId: id
      })
    };
  } catch (error) {
    console.error('Error processing member creation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
