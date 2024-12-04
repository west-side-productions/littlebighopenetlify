// Email templates with improved formatting and safety checks
const sanitizeInput = (input) => {
    if (!input) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const baseStyles = `
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        h1 { color: #2c5282; }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 16px 0;
        }
        .footer { margin-top: 32px; color: #666; font-size: 14px; }
    </style>
`;

module.exports = {
    welcome: {
        subject: 'Welcome to Little Big Hope!',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Welcome ${sanitizeInput(firstName)}!</h1>
            <p>Thank you for joining Little Big Hope. We're excited to have you as part of our community.</p>
            <p>If you have any questions, feel free to reach out to us.</p>
            <div class="footer">
                <p>Best regards,<br>The Little Big Hope Team</p>
            </div>
        `
    },
    email_verification: {
        subject: 'Verify your email address',
        html: ({ firstName = '', verificationLink = '' }) => `
            ${baseStyles}
            <h1>Hello ${sanitizeInput(firstName)},</h1>
            <p>Please verify your email address by clicking the button below:</p>
            <a href="${sanitizeInput(verificationLink)}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${sanitizeInput(verificationLink)}</p>
            <p>If you didn't request this verification, you can safely ignore this email.</p>
            <div class="footer">
                <p>Best regards,<br>The Little Big Hope Team</p>
                <p style="font-size: 12px;">This link will expire in 24 hours for security reasons.</p>
            </div>
        `
    },
    email_verified: {
        subject: 'Email Successfully Verified',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Hello ${sanitizeInput(firstName)},</h1>
            <p>Your email address has been successfully verified!</p>
            <p>You now have full access to your Little Big Hope account.</p>
            <div class="footer">
                <p>Best regards,<br>The Little Big Hope Team</p>
            </div>
        `
    },
    password_reset: {
        subject: 'Reset Your Password',
        html: ({ firstName = '', resetLink = '' }) => `
            ${baseStyles}
            <h1>Hello ${sanitizeInput(firstName)},</h1>
            <p>We received a request to reset your password.</p>
            <a href="${sanitizeInput(resetLink)}" class="button">Reset Password</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${sanitizeInput(resetLink)}</p>
            <p>If you didn't request this change, you can safely ignore this email.</p>
            <div class="footer">
                <p>Best regards,<br>The Little Big Hope Team</p>
                <p style="font-size: 12px;">This link will expire in 24 hours for security reasons.</p>
            </div>
        `
    },
    password_changed: {
        subject: 'Password Successfully Changed',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Hello ${sanitizeInput(firstName)},</h1>
            <p>Your password has been successfully changed.</p>
            <p>If you didn't make this change, please contact us immediately.</p>
            <div class="footer">
                <p>Best regards,<br>The Little Big Hope Team</p>
            </div>
        `
    },
    purchase_confirmation: {
        subject: 'Thank You for Your Purchase!',
        html: ({ firstName = '', purchaseId = '' }) => `
            ${baseStyles}
            <h1>Hello ${sanitizeInput(firstName)},</h1>
            <p>Thank you for your purchase from Little Big Hope!</p>
            <p>We've received your order (ID: ${sanitizeInput(purchaseId)}) and are processing it now.</p>
            <p>You'll receive another email with your order details and tracking information once it ships.</p>
            <div class="footer">
                <p>Best regards,<br>The Little Big Hope Team</p>
            </div>
        `
    }
};
