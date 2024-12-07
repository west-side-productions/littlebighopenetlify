const axios = require('axios');
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid client
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load email templates
const emailTemplates = {
    de: require('./email-templates/de')
};

// Function to add plan to member
async function addPlanToMember(memberId) {
    try {
        const url = `https://admin.memberstack.com/members/${memberId}/add-plan`;
        const data = {
            planId: process.env.MEMBERSTACK_LIFETIME_PLAN_ID
        };
        const headers = {
            "X-API-KEY": process.env.MEMBERSTACK_SECRET_KEY
        };

        const response = await axios.post(url, data, { headers });
        console.log(`Successfully added plan to member ${memberId}`, response.data);
    } catch (error) {
        const errorMessage = error.response?.data || error.message || 'Unknown error';
        console.error('Error adding plan to member:', errorMessage);
        throw new Error(`Failed to add plan to member: ${errorMessage}`);
    }
}

// Function to send order confirmation email
async function sendOrderConfirmationEmail(email, data) {
    try {
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: 'Order Confirmation',
            text: emailTemplates.de.orderConfirmation(data),
            html: emailTemplates.de.orderConfirmationHtml(data),
        };

        await sgMail.send(msg);
        console.log('Order confirmation email sent successfully');
    } catch (error) {
        console.error('Failed to send order confirmation email:', error);
    }
}

// Function to transform Stripe session data for email template
function prepareOrderNotificationData(session) {
    return {
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
                productWeight: session.metadata?.productWeight || 0,
                packagingWeight: session.metadata?.packagingWeight || 0,
                totalWeight: session.metadata?.totalWeight || 0
            },
            items: session.line_items?.data?.map(item => ({
                name: item.description,
                price: (item.amount_total / 100).toFixed(2),
                currency: item.currency?.toUpperCase()
            })) || [],
            shipping: {
                method: 'Standard Versand',
                cost: ((session.total_details?.shipping_cost || 0) / 100).toFixed(2),
                currency: session.currency?.toUpperCase()
            },
            total: {
                subtotal: ((session.amount_subtotal || 0) / 100).toFixed(2),
                shipping: ((session.total_details?.shipping_cost || 0) / 100).toFixed(2),
                tax: ((session.total_details?.amount_tax || 0) / 100).toFixed(2),
                total: ((session.amount_total || 0) / 100).toFixed(2),
                currency: session.currency?.toUpperCase()
            }
        }
    };
}

// Function to send order notification to shipping company
async function sendOrderNotificationEmail(session) {
    try {
        // Get line items for the session
        const lineItems = await Stripe.checkout.sessions.listLineItems(session.id);
        session.line_items = lineItems;

        // Transform data for email template
        const emailData = prepareOrderNotificationData(session);

        const msg = {
            to: 'office@west-side-productions.at',
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: 'Neue Bestellung eingegangen',
            text: emailTemplates.de.order_notification.html(emailData),
            html: emailTemplates.de.order_notification.html(emailData),
        };

        await sgMail.send(msg);
        console.log('Order notification email sent successfully to shipping company');
    } catch (error) {
        console.error('Failed to send order notification email:', error);
        console.error('Error details:', error.response?.body || error);
    }
}

// Main webhook handler
exports.handler = async (event) => {
    try {
        // Verify Stripe webhook signature
        const stripeEvent = Stripe.webhooks.constructEvent(
            event.body,
            event.headers['stripe-signature'],
            process.env.STRIPE_WEBHOOK_SECRET
        );

        // Only handle successful checkouts
        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            
            // Only proceed if payment is successful and we have a Memberstack ID
            if (session.payment_status === 'paid' && session.metadata?.memberstackUserId) {
                console.log('Processing successful payment for member:', session.metadata.memberstackUserId);
                
                // Add plan to existing member
                await addPlanToMember(session.metadata.memberstackUserId);
                
                // Send confirmation email to customer
                if (session.customer_details?.email) {
                    await sendOrderConfirmationEmail(session.customer_details.email, session);
                }

                // Send notification email to shipping company if it's a physical product
                if (session.metadata?.productType === 'physical' || session.metadata?.productType === 'bundle') {
                    await sendOrderNotificationEmail(session);
                }
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('Error processing webhook:', error);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message })
        };
    }
};
