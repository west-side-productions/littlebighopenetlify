const sgMail = require('@sendgrid/mail');
const fetch = require('node-fetch');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Configuration
const SUPPORTED_LANGUAGES = ['de', 'en', 'fr', 'it'];
const DEFAULT_LANGUAGE = 'de';

// CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Headers': 'Content-Type, svix-id, svix-signature, svix-timestamp',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// Delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async (event) => {
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
        console.log('Raw webhook payload:', event.body);
        const payload = JSON.parse(event.body);
        console.log('Parsed webhook payload:', payload);

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

        const { event: webhookEvent, payload: webhookPayload } = payload;
        console.log('Processing webhook type:', webhookEvent);

        switch (webhookEvent) {
            case 'member.created':
                // Wait a bit to allow for any immediate updates
                await delay(2000);
                await handleMemberCreated(webhookPayload);
                break;
            case 'member.updated':
                if (webhookPayload.verified === true) {
                    console.log('Member verified, sending welcome emails');
                    await delay(2000);
                    await handleMemberVerified(webhookPayload);
                } else {
                    console.log('Member updated but not verified:', webhookPayload);
                }
                break;
            case 'member.plan.added':
                await handlePlanAdded(webhookPayload);
                break;
            case 'member.plan.updated':
                await handlePlanUpdated(webhookPayload);
                break;
            case 'member.plan.canceled':
                await handlePlanCanceled(webhookPayload);
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
                details: error.stack
            })
        };
    }
};

async function handleMemberCreated(data) {
    console.log('Handling member created with full data:', JSON.stringify(data, null, 2));
    const { auth: { email }, customFields = {} } = data;
    
    console.log('Custom fields received:', JSON.stringify(customFields, null, 2));

    const firstName = customFields['first-name'] || 
                     customFields['firstName'] || 
                     customFields['firstname'] || 
                     customFields['First Name'] || 
                     'User';
    
    let language = customFields.language || 
                  customFields['Language'] || 
                  customFields['preferred_language'] ||
                  DEFAULT_LANGUAGE;

    if (!SUPPORTED_LANGUAGES.includes(language)) {
        console.warn(`Unsupported language ${language}, falling back to ${DEFAULT_LANGUAGE}`);
        language = DEFAULT_LANGUAGE;
    }

    console.log('Detected language:', language);
    console.log('Using firstName:', firstName);
    console.log('Using language:', language);
    console.log('Member created successfully - verification email will be sent through frontend');
}

async function handleMemberVerified(data) {
    console.log('Handling member verified:', JSON.stringify(data, null, 2));
    const { auth: { email }, customFields = {}, id: memberId } = data;
    
    const firstName = customFields['first-name'] || 
                     customFields['firstName'] || 
                     customFields['firstname'] || 
                     customFields['First Name'] || 
                     'User';
    
    let language = customFields.language || 
                  customFields['Language'] || 
                  customFields['preferred_language'] || 
                  DEFAULT_LANGUAGE;

    // Validate language is supported
    if (!SUPPORTED_LANGUAGES.includes(language)) {
        console.warn(`Unsupported language ${language}, falling back to ${DEFAULT_LANGUAGE}`);
        language = DEFAULT_LANGUAGE;
    }

    console.log('Detected language:', language);
    console.log('Using firstName:', firstName);
    console.log('Using language:', language);

    try {
        // Check if user has already made a purchase
        const hasPurchase = customFields.hasPurchase === 'true' || 
                           customFields.hasActiveSubscription === 'true';
        
        // Only send welcome email if user hasn't made a purchase
        if (!hasPurchase) {
            await sendEmail({
                to: email,
                templateName: 'welcome',
                language,
                variables: {
                    firstName,
                    language
                }
            });
            console.log('Welcome email sent');
        } else {
            console.log('Skipping welcome email - user already has a purchase');
        }

        // Always send verification success email
        await sendEmail({
            to: email,
            templateName: 'email_verified',
            language,
            variables: {
                firstName
            }
        });
        console.log('Verification success email sent');
        
    } catch (error) {
        console.error('Failed to send verification emails:', error);
        throw error;
    }
}

async function handlePlanAdded(data) {
    console.log('Handling plan added:', JSON.stringify(data, null, 2));
    const { auth: { email }, customFields = {}, planConnections = [] } = data;
    
    if (planConnections.length > 0) {
        const latestPlan = planConnections[planConnections.length - 1];
        
        try {
            await sendEmail({
                to: email,
                templateName: 'purchase_confirmation',
                language: customFields.language || 'de',
                variables: {
                    firstName: customFields['first-name'] || 'User',
                    purchaseId: latestPlan.id
                }
            });
            
            console.log('Purchase confirmation email sent');
            
        } catch (error) {
            console.error('Failed to send purchase confirmation:', error);
            throw error;
        }
    }
}

async function handlePlanUpdated(data) {
    console.log('Handling plan updated:', data);
}

async function handlePlanCanceled(data) {
    console.log('Handling plan canceled:', data);
}

async function sendEmail({ to, templateName, language, variables }) {
    console.log(`Sending ${templateName} email to ${to}`);
    console.log('Email language:', language);
    console.log('Email variables:', variables);

    try {
        // Import the send-email function directly
        const { handler: sendEmailHandler } = require('./send-email');
        
        // Create proper event object structure
        const result = await sendEmailHandler({
            httpMethod: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                to,
                templateName,
                language,
                variables
            })
        });

        if (result.statusCode !== 200) {
            throw new Error(`Email API responded with status: ${result.statusCode}, body: ${result.body}`);
        }

        console.log(`${templateName} email sent:`, result);
        return result;
    } catch (error) {
        console.error(`Failed to send ${templateName} email:`, error);
        throw error;
    }
}
