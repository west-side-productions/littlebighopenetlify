# Memberstack Plan Setup

## Overview
This document explains how the Memberstack plans are configured in our system. We use a combination of Stripe for payments and Memberstack for access control.

## Plan Configuration

### Current Plan IDs
- Book Access: `pln_kostenloser-zugang-84l80t3u` (free plan)
- Course/Bundle Access: `pln_bundle-rd004n7` (free plan)

### Important Note
We use **free plans** in Memberstack because:
1. All payments are handled through Stripe
2. Memberstack is only used for access control
3. Using free plans avoids conflicts with Memberstack's payment system

## How It Works

### Single Product Purchase
- When a customer buys just the book, they get the free book plan (`pln_kostenloser-zugang-84l80t3u`)
- When a customer buys just the course, they get the free bundle plan (`pln_bundle-rd004n7`)

### Bundle Purchase
When a customer buys the bundle:
1. They pay through Stripe (with the bundle discount applied)
2. The webhook handler adds both Memberstack plans:
   - The free book plan (`pln_kostenloser-zugang-84l80t3u`)
   - The free bundle plan (`pln_bundle-rd004n7`)

## Code Implementation

### create-checkout-session.js
```javascript
const PRODUCT_CONFIG = {
    book: {
        // ...
        memberstackPlanId: 'pln_kostenloser-zugang-84l80t3u'
    },
    course: {
        // ...
        memberstackPlanId: 'pln_bundle-rd004n7'
    },
    bundle: {
        // ...
        memberstackPlanId: 'pln_bundle-rd004n7'
    }
};
```

### stripe-webhook.js
```javascript
// For bundle purchases
if (session.metadata.type === 'bundle') {
    // Add course access
    await addPlanToMember(session.metadata.memberstackUserId, 'pln_bundle-rd004n7');
    // Add book access
    await addPlanToMember(session.metadata.memberstackUserId, 'pln_kostenloser-zugang-84l80t3u');
}
```

## Troubleshooting

### Common Issues
1. "Plan not found" error
   - Make sure you're using the correct plan IDs
   - Verify that the plans exist in your Memberstack dashboard
   - Remember to use free plans, not paid ones

2. Access not granted
   - Check the webhook logs to ensure both plans were added successfully
   - Verify that the Memberstack user ID is being passed correctly

### Adding New Products
When adding new products:
1. Create a free plan in Memberstack
2. Use the plan ID in both `create-checkout-session.js` and `stripe-webhook.js`
3. Handle payments through Stripe, not Memberstack
