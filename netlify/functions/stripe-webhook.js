const axios = require('axios');
const fs = require('fs'); 
const path = require('path');
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid client
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load email templates
const emailTemplates = {
    de: require('./email-templates/de'),
    en: require('./email-templates/en'),
    fr: require('./email-templates/fr'),
    it: require('./email-templates/it')
};

// Default language if none specified
const DEFAULT_LANGUAGE = 'de';

// Function to get email template for language
function getEmailTemplate(language) {
    return emailTemplates[language] || emailTemplates[DEFAULT_LANGUAGE];
}

// Function to add plan to member
async function addPlanToMember(memberId, planId) {
    try {
        const url = `https://admin.memberstack.com/members/${memberId}/add-plan`;
        const data = {
            planId: planId
        };
        const headers = {
            "X-API-KEY": process.env.MEMBERSTACK_SECRET_KEY
        };

        console.log('Making request to Memberstack:', {
            url,
            memberId,
            planId,
            headers: {
                ...headers,
                "X-API-KEY": "REDACTED"
            },
            data
        });

        const response = await axios.post(url, data, { headers });
        console.log('Memberstack response:', {
            status: response.status,
            data: response.data
        });
        console.log(`Successfully added plan ${planId} to member ${memberId}`, response.data);
    } catch (error) {
        console.error('Error adding plan to member:', {
            error: error.response?.data || error.message,
            status: error.response?.status,
            headers: error.response?.headers,
            config: {
                url: error.config?.url,
                method: error.config?.method,
                data: error.config?.data,
                headers: {
                    ...error.config?.headers,
                    "X-API-KEY": "REDACTED"
                }
            }
        });
        throw new Error(`Failed to add plan to member: ${error.response?.data || error.message}`);
    }
}

// Logo URL from Webflow
const LOGO_URL = 'https://cdn.prod.website-files.com/66fe7e7fc06ec10a17ffa57f/67609d5ffc9ced97f9c15adc_lbh_logo_rgb.png';

// Function to fetch and encode logo
async function getEncodedLogo() {
    try {
        const response = await axios.get(LOGO_URL, { responseType: 'arraybuffer' });
        return Buffer.from(response.data).toString('base64');
    } catch (error) {
        console.error('Error fetching logo:', error);
        throw error;
    }
}

// Function to send order confirmation email
async function sendOrderConfirmationEmail(email, session) {
    try {
        const language = session.metadata?.language || DEFAULT_LANGUAGE;
        const template = getEmailTemplate(language);
        
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: template.orderConfirmation.subject,
            text: template.orderConfirmation.text(session),
            html: template.orderConfirmation.html(session)
        };

        console.log('Sending order confirmation email:', {
            to: msg.to,
            from: msg.from,
            subject: msg.subject
        });

        await sgMail.send(msg);
        console.log('✅ Order confirmation email sent successfully');
    } catch (error) {
        console.error('❌ Failed to send order confirmation email:', error);
        console.error('Error details:', error.response?.body?.errors || error);
    }
}

// Function to send order notification email
async function sendOrderNotificationEmail(session) {
    try {
        // Get line items for the session
        console.log('Fetching line items for session:', session.id);
        const lineItems = await Stripe.checkout.sessions.listLineItems(session.id);
        session.line_items = lineItems;
        console.log('Line items fetched:', lineItems.data.length, 'items');

        const orderData = prepareOrderNotificationData(session);
        const template = getEmailTemplate('de'); // Always use German for shipping notifications
        
        const msg = {
            to: 'office@west-side-productions.at',
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: template.orderNotification.subject,
            text: template.orderNotification.text(orderData),
            html: template.orderNotification.html(orderData)
        };

        console.log('Sending shipping notification email:', {
            to: msg.to,
            from: msg.from,
            subject: msg.subject,
            orderData: orderData
        });

        await sgMail.send(msg);
        console.log('✅ Order notification email sent successfully to shipping company');
    } catch (error) {
        console.error('❌ Failed to send order notification email:', error);
        console.error('Error details:', error.response?.body?.errors || error);
        throw error;
    }
}

// Function to transform Stripe session data for email template
function prepareOrderNotificationData(session) {
    // Get line items and shipping details
    const orderData = {
        orderDetails: {
            orderNumber: session.id,
            customerEmail: session.customer_details?.email,
            shippingAddress: {
                name: session.shipping_details?.name,
                line1: session.shipping_details?.address?.line1,
                line2: session.shipping_details?.address?.line2,
                postal_code: session.shipping_details?.address?.postal_code,
                city: session.shipping_details?.address?.city,
                state: session.shipping_details?.address?.state,
                country: session.shipping_details?.address?.country
            },
            weights: {
                productWeight: parseInt(session.metadata?.productWeight) || 0,
                packagingWeight: parseInt(session.metadata?.packagingWeight) || 0,
                totalWeight: parseInt(session.metadata?.totalWeight) || 0
            },
            items: session.line_items?.data?.map(item => ({
                name: item.description,
                price: (item.amount_total / 100).toFixed(2),
                currency: item.currency.toUpperCase()
            })) || []
        }
    };

    console.log('Prepared order notification data:', JSON.stringify(orderData, null, 2));
    return orderData;
}

// Main webhook handler
exports.handler = async (event) => {
    try {
        console.log('Received webhook event:', event.headers['stripe-signature']);
        
        // Verify Stripe webhook signature
        let stripeEvent;
        try {
            stripeEvent = Stripe.webhooks.constructEvent(
                event.body,
                event.headers['stripe-signature'],
                process.env.STRIPE_WEBHOOK_SECRET
            );
            console.log('Webhook signature verified. Event type:', stripeEvent.type);
        } catch (err) {
            console.error('⚠️ Webhook signature verification failed:', err.message);
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Webhook signature verification failed' })
            };
        }

        // Only handle successful checkouts
        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            
            // Retrieve the session with line items expanded
            const expandedSession = await Stripe.checkout.sessions.retrieve(
                session.id,
                {
                    expand: ['line_items']
                }
            );
            
            console.log('Processing checkout session:', {
                id: expandedSession.id,
                payment_status: expandedSession.payment_status,
                metadata: expandedSession.metadata,
                customer_email: expandedSession.customer_email,
                line_items: expandedSession.line_items
            });
            
            // Only proceed if payment is successful
            if (expandedSession.payment_status === 'paid') {
                console.log('Payment successful, processing order');
                
                try {
                    // Add plan to member if memberstackUserId exists
                    if (expandedSession.metadata?.memberstackUserId && expandedSession.metadata?.memberstackPlanId) {
                        await addPlanToMember(
                            expandedSession.metadata.memberstackUserId,
                            expandedSession.metadata.memberstackPlanId
                        );
                    }

                    // Send confirmation email to customer
                    await sendOrderConfirmationEmail(expandedSession.customer_email, expandedSession);
                    
                    // Send notification email to admin
                    await sendOrderNotificationEmail(expandedSession);

                    return {
                        statusCode: 200,
                        body: JSON.stringify({ received: true })
                    };
                } catch (error) {
                    console.error('Error processing successful payment:', error);
                    return {
                        statusCode: 500,
                        body: JSON.stringify({ error: 'Error processing successful payment' })
                    };
                }
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('❌ Webhook processing failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Webhook processing failed' })
        };
    }
};
