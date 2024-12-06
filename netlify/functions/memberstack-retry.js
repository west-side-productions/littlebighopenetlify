const axios = require('axios');

// Memberstack API URL
const MEMBERSTACK_API_V1 = 'https://api.memberstack.com/v1';

// Retry helper function
async function retryWithBackoff(operation, maxRetries = 5, initialDelay = 2000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (i === maxRetries - 1) throw error;
            
            const delay = initialDelay * Math.pow(2, i);
            console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { type, data } = JSON.parse(event.body);
        
        if (type !== 'memberstack_plan_retry') {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Invalid retry type' })
            };
        }

        const { memberId, planId, sessionId } = data;

        console.log('Retrying Memberstack plan addition:', {
            memberId,
            planId,
            sessionId
        });

        // Attempt to add the plan
        const response = await retryWithBackoff(async () => {
            return await axios({
                method: 'POST',
                url: `${MEMBERSTACK_API_V1}/members/add-plan`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`
                },
                data: {
                    planId,
                    memberId
                }
            });
        });

        console.log('Plan addition retry successful:', {
            status: response.status,
            data: response.data
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'success',
                message: 'Plan added successfully'
            })
        };
    } catch (error) {
        console.error('Plan addition retry failed:', {
            error: error.message,
            response: error.response?.data
        });

        return {
            statusCode: 500,
            body: JSON.stringify({
                status: 'error',
                message: 'Failed to add plan',
                error: error.message
            })
        };
    }
};
