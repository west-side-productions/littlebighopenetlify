const sgMail = require('@sendgrid/mail');
const fetch = require('node-fetch');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// CORS headers
const headers = {
    'Access-Control-Allow-Origin': 'https://littlebighope.com',
    'Access-Control-Allow-Headers': 'Content-Type, svix-id, svix-signature, svix-timestamp',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    console.log('Webhook received with headers:', event.headers);

    try {
        // Log the raw payload
        console.log('Raw webhook payload:', event.body);
        
        const payload = JSON.parse(event.body);
        console.log('Parsed webhook payload:', payload);

        // Check for Svix headers
        const svixId = event.headers['svix-id'];
        const svixTimestamp = event.headers['svix-timestamp'];
        const svixSignature = event.headers['svix-signature'];

        if (!svixId || !svixTimestamp || !svixSignature) {
            console.error('Missing Svix headers');
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Missing webhook signature headers' })
            };
        }

        console.log('Svix headers:', {
            id: svixId,
            timestamp: svixTimestamp,
            signature: svixSignature
        });

        // Process the webhook data
        const { type, data } = payload;
        console.log('Processing webhook type:', type);

        switch (type) {
            case 'memberstack:member:created':
                await handleMemberCreated(data);
                break;
            case 'memberstack:member:updated':
                await handleMemberUpdated(data);
                break;
            default:
                console.log('Unhandled webhook type:', type);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                received: true,
                type: type,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Webhook processing error:', error);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: 'Webhook processing failed',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

async function handleMemberCreated(data) {
    console.log('Handling member created:', data);
    const { email, customFields = {} } = data;

    try {
        const response = await fetch('https://littlebighope.com/.netlify/functions/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: email,
                templateName: 'welcome',
                language: customFields.language || 'de',
                variables: {
                    firstName: customFields.firstName || 'User'
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Email API responded with status: ${response.status}`);
        }

        const responseData = await response.json();
        console.log('Welcome email sent:', responseData);
        
    } catch (error) {
        console.error('Failed to send welcome email:', error);
        throw error;
    }
}

async function handleMemberUpdated(data) {
    console.log('Handling member updated:', data);
    const { email, customFields = {}, metadata = {} } = data;
    
    if (metadata.lastPurchase) {
        console.log('Purchase detected:', metadata.lastPurchase);

        try {
            const response = await fetch('https://littlebighope.com/.netlify/functions/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: email,
                    templateName: 'purchase_confirmation',
                    language: customFields.language || 'de',
                    variables: {
                        firstName: customFields.firstName || 'User',
                        purchaseId: metadata.lastPurchase.id
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Email API responded with status: ${response.status}`);
            }

            const responseData = await response.json();
            console.log('Purchase confirmation email sent:', responseData);
            
        } catch (error) {
            console.error('Failed to send purchase confirmation:', error);
            throw error;
        }
    }
}
