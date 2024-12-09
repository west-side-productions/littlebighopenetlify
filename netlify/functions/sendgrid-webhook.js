const crypto = require('crypto');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Twilio-Email-Event-Webhook-Signature, X-Twilio-Email-Event-Webhook-Timestamp',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

// In-memory store for tracking recent emails (in production, use a proper database)
const recentEmails = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of recentEmails.entries()) {
        if (now - value.timestamp > 5 * 60 * 1000) { // 5 minutes
            recentEmails.delete(key);
        }
    }
}, 5 * 60 * 1000);

// Verify SendGrid webhook signature
function verifySignature(payload, signature, timestamp, verificationKey) {
    const timestampedPayload = timestamp + payload;
    const hmac = crypto.createHmac('sha256', verificationKey);
    hmac.update(timestampedPayload);
    const expectedSignature = hmac.digest('base64');
    return signature === expectedSignature;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get signature verification details
        const signature = event.headers['x-twilio-email-event-webhook-signature'];
        const timestamp = event.headers['x-twilio-email-event-webhook-timestamp'];
        const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;

        // Verify the signature
        if (!signature || !timestamp || !verificationKey || 
            !verifySignature(event.body, signature, timestamp, verificationKey)) {
            console.error('Invalid webhook signature');
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid signature' })
            };
        }

        const events = JSON.parse(event.body);
        
        for (const evt of events) {
            if (evt.event === 'delivered') {
                const email = evt.email;
                const messageId = evt.sg_message_id;
                const timestamp = Date.now();
                
                // Create a key combining email and template
                const key = `${email}:${evt.template_id || 'unknown'}`;
                
                // Check if we've sent an email to this address recently
                const recent = recentEmails.get(key);
                if (recent && timestamp - recent.timestamp < 5 * 60 * 1000) { // 5 minutes
                    console.log(`Duplicate email detected for ${key}`);
                    // You could implement additional logic here
                } else {
                    recentEmails.set(key, {
                        messageId,
                        timestamp
                    });
                }
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('Error processing SendGrid webhook:', error);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid request' })
        };
    }
};
