const sgMail = require('@sendgrid/mail');
const fetch = require('node-fetch');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*', // Allow all origins since this is a webhook
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
        const { event: webhookEvent, payload: webhookPayload } = payload;
        console.log('Processing webhook type:', webhookEvent);

        switch (webhookEvent) {
            case 'member.created':
                await handleMemberCreated(webhookPayload);
                break;
            case 'member.updated':
                await handleMemberUpdated(webhookPayload);
                break;
            default:
                console.log('Unhandled webhook type:', webhookEvent);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                received: true,
                type: webhookEvent,
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
    const { auth: { email }, customFields = {} } = data;

    try {
        const response = await fetch('https://lillebighopefunctions.netlify.app/.netlify/functions/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to: email,
                templateName: 'welcome',
                language: customFields.language || 'de',
                variables: {
                    firstName: customFields['first-name'] || 'User'
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
    const { auth: { email }, customFields = {}, metaData = {} } = data;
    
    if (metaData.lastPurchase) {
        console.log('Purchase detected:', metaData.lastPurchase);

        try {
            const response = await fetch('https://lillebighopefunctions.netlify.app/.netlify/functions/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: email,
                    templateName: 'purchase_confirmation',
                    language: customFields.language || 'de',
                    variables: {
                        firstName: customFields['first-name'] || 'User',
                        purchaseId: metaData.lastPurchase.id
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
