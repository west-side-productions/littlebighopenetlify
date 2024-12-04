const fetch = require('node-fetch');
const MEMBERSTACK_API_URL = 'https://api.memberstack.com/v1';

// Validate environment variables
const requiredEnvVars = [
    'MEMBERSTACK_SECRET_KEY',
    'URL'
];

const validateEnv = () => {
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
};

exports.handler = async (event, context) => {
    console.log('Starting email verification process');
    console.log('Query parameters:', event.queryStringParameters);

    // Validate HTTP method
    if (event.httpMethod !== 'GET') {
        console.log('Invalid HTTP method:', event.httpMethod);
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method not allowed' })
        };
    }

    try {
        // Validate environment variables
        validateEnv();

        // Get and validate the verification token
        const params = new URLSearchParams(event.queryStringParameters);
        const token = params.get('token');
        console.log('Received verification token:', token);

        if (!token) {
            throw new Error('Verification token is missing');
        }

        // Decode and validate the token
        let memberId, timestamp;
        try {
            const decoded = Buffer.from(token, 'base64').toString();
            console.log('Decoded token:', decoded);
            [memberId, timestamp] = decoded.split(':');
            
            if (!memberId || !timestamp || isNaN(parseInt(timestamp))) {
                throw new Error('Invalid token format');
            }
            
            // Validate member ID format
            if (!memberId.match(/^[a-zA-Z0-9_-]+$/)) {
                throw new Error('Invalid member ID format');
            }
        } catch (e) {
            console.error('Token validation error:', e);
            return {
                statusCode: 302,
                headers: {
                    Location: `/verification-error?message=${encodeURIComponent('Invalid verification token')}`
                }
            };
        }

        // Verify token expiration
        const tokenAge = Date.now() - parseInt(timestamp);
        console.log('Token age (ms):', tokenAge);
        
        if (tokenAge > 24 * 60 * 60 * 1000) {
            throw new Error('Verification token has expired');
        }

        // Update member verification status
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

        // Get member details for confirmation email
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

        // Send confirmation email
        try {
            console.log('Sending confirmation email');
            const emailResponse = await fetch(`${process.env.URL}/.netlify/functions/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: member.auth?.email,
                    templateName: 'verification_success',
                    language: member.customFields?.language || 'de',
                    variables: {
                        firstName: member.customFields?.['first-name'] || 'User'
                    }
                })
            });

            if (!emailResponse.ok) {
                console.error('Failed to send confirmation email:', await emailResponse.text());
                // Continue with verification success even if email fails
            }
        } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
            // Continue with verification success even if email fails
        }

        // Redirect to success page
        const language = member.customFields?.language || 'de';
        return {
            statusCode: 302,
            headers: {
                Location: language === 'de' ? '/verification-success' : `/${language}/verification-success`
            }
        };

    } catch (error) {
        console.error('Verification error:', error);
        const errorMessage = encodeURIComponent(error.message || 'Verification failed');
        return {
            statusCode: 302,
            headers: {
                Location: `/verification-error?message=${errorMessage}`
            }
        };
    }
};
