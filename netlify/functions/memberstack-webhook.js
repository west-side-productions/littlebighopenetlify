const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const signature = event.headers['memberstack-signature'];
        if (!signature) {
            return { statusCode: 401, body: 'No signature' };
        }

        const payload = JSON.parse(event.body);
        console.log('Webhook received:', payload);

        const { type, data } = payload;

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
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('Webhook error:', error);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Webhook error' })
        };
    }
};

async function handleMemberCreated(data) {
    const { email, customFields = {} } = data;
    console.log('New member created:', email);

    try {
        await fetch('https://littlebighope.com/.netlify/functions/send-email', {
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
    } catch (error) {
        console.error('Error sending welcome email:', error);
        throw error;
    }
}

async function handleMemberUpdated(data) {
    const { email, customFields = {}, metadata = {} } = data;
    
    // Check if this update includes a purchase
    if (metadata.lastPurchase) {
        console.log('Purchase detected in member update:', {
            email,
            purchaseDetails: metadata.lastPurchase
        });

        try {
            await fetch('https://littlebighope.com/.netlify/functions/send-email', {
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
        } catch (error) {
            console.error('Error sending purchase confirmation:', error);
            throw error;
        }
    }
}
