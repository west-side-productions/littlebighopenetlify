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
async function sendOrderConfirmationEmail(email, session) {
    try {
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: emailTemplates.de.orderConfirmation.subject,
            text: emailTemplates.de.orderConfirmation.text(session),
            html: emailTemplates.de.orderConfirmation.html(session),
        };

        await sgMail.send(msg);
        console.log('Order confirmation email sent successfully');
    } catch (error) {
        console.error('Failed to send order confirmation email:', error);
        console.error('Error details:', error.response?.body?.errors || error);
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
        console.log('Preparing to send order notification email');
        
        // Get line items for the session
        console.log('Fetching line items for session:', session.id);
        const lineItems = await Stripe.checkout.sessions.listLineItems(session.id);
        session.line_items = lineItems;
        console.log('Line items fetched:', lineItems.data.length, 'items');

        // Transform data for email template
        const emailData = prepareOrderNotificationData(session);
        console.log('Prepared email data:', JSON.stringify(emailData, null, 2));

        // Verify template exists
        if (!emailTemplates.de.orderNotification) {
            console.error('Available templates:', Object.keys(emailTemplates.de));
            throw new Error('Email template "orderNotification" not found');
        }

        const msg = {
            to: 'office@west-side-productions.at',
            from: process.env.SENDGRID_FROM_EMAIL,
            subject: 'Neue Bestellung eingegangen',
            text: emailTemplates.de.orderNotification.text ? 
                  emailTemplates.de.orderNotification.text(emailData) : 
                  emailTemplates.de.orderNotification.html(emailData).replace(/<[^>]*>/g, ''),
            html: emailTemplates.de.orderNotification.html(emailData)
        };

        console.log('Sending email with SendGrid:', {
            to: msg.to,
            from: msg.from,
            subject: msg.subject
        });

        await sgMail.send(msg);
        console.log('✅ Order notification email sent successfully to shipping company');
    } catch (error) {
        console.error('❌ Failed to send order notification email:', error);
        console.error('Error details:', error.response?.body?.errors || error);
        throw error; // Re-throw to handle in the main webhook handler
    }
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
            console.log('Processing checkout session:', {
                id: session.id,
                payment_status: session.payment_status,
                metadata: session.metadata,
                customer_email: session.customer_details?.email
            });
            
            // Only proceed if payment is successful and we have a Memberstack ID
            if (session.payment_status === 'paid' && session.metadata?.memberstackUserId) {
                console.log('Payment successful, processing for member:', session.metadata.memberstackUserId);
                
                // Add plan to existing member
                try {
                    await addPlanToMember(session.metadata.memberstackUserId);
                    console.log('Successfully added plan to member');
                } catch (error) {
                    console.error('Failed to add plan to member:', error);
                }
                
                // Send confirmation email to customer
                // Only send if this is a first-time purchase (check metadata)
                if (session.customer_details?.email && session.metadata?.isFirstPurchase !== 'false') {
                    console.log('Sending confirmation email to:', session.customer_details.email);
                    await sendOrderConfirmationEmail(session.customer_details.email, session);
                } else {
                    console.log('⚠️ Skipping confirmation email - not first purchase or no email');
                }

                // Send notification email to shipping company if it's a physical product
                if (session.metadata?.type === 'physical' || session.metadata?.type === 'bundle') {
                    console.log('Product requires shipping, sending notification email', {
                        productType: session.metadata.productType,
                        type: session.metadata.type,
                        weights: {
                            productWeight: session.metadata.productWeight,
                            packagingWeight: session.metadata.packagingWeight,
                            totalWeight: session.metadata.totalWeight
                        }
                    });
                    await sendOrderNotificationEmail(session);
                } else {
                    console.log('Product type does not require shipping:', {
                        productType: session.metadata.productType,
                        type: session.metadata.type
                    });
                }
            } else {
                console.log('⚠️ Session not processed:', {
                    payment_status: session.payment_status,
                    has_memberstack_id: !!session.metadata?.memberstackUserId
                });
            }
        } else {
            console.log('Ignoring non-checkout event:', stripeEvent.type);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ received: true })
        };
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        console.error('Error details:', error.response?.body || error);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: error.message })
        };
    }
};
