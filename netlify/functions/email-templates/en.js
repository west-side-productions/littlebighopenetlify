// Email templates with improved formatting and safety checks
const sanitizeInput = (input) => {
    if (!input) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/`/g, '&#x60;')
        .replace(/\(/g, '&#40;')
        .replace(/\)/g, '&#41;');
};

const validateTemplateData = (data) => {
    const required = ['firstName'];
    const missing = required.filter(field => !data[field]);
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
};

const logoUrl = 'https://cdn.prod.website-files.com/66fe7e7fc06ec10a17ffa57f/67609d5ffc9ced97f9c15adc_lbh_logo_rgb.png';

const baseStyles = `
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #ffffff;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            max-width: 200px;
            height: auto;
            margin-bottom: 20px;
        }
        .content {
            margin: 20px 0;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
        }
    </style>
`;

module.exports = {
    welcome: {
        subject: 'Welcome to Little Big Hope!',
        html: ({ firstName = '' }) => {
            validateTemplateData({ firstName });
            return `
                ${baseStyles}
                <div class="email-container">
                    <div class="header">
                        <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                        <h1>Welcome ${sanitizeInput(firstName)}!</h1>
                    </div>
                    <div class="content">
                        <p>Thank you for joining Little Big Hope. We're excited to have you as part of our community.</p>
                        <p>If you have any questions, feel free to reach out to us.</p>
                    </div>
                    <div class="footer">
                        <p>Best regards,<br>The Little Big Hope Team</p>
                    </div>
                </div>
            `;
        },
        text: ({ firstName = '' }) => {
            validateTemplateData({ firstName });
            return `
Welcome ${firstName},

Thank you for joining Little Big Hope. We're excited to have you as part of our community.

If you have any questions, feel free to reach out to us.

Best regards,
The Little Big Hope Team
            `.trim();
        }
    },
    email_verification: {
        subject: 'Verify your email address',
        html: ({ firstName = '', verificationLink = '' }) => {
            validateTemplateData({ firstName });
            return `
                ${baseStyles}
                <div class="email-container">
                    <div class="header">
                        <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                        <h1>Hello ${sanitizeInput(firstName)},</h1>
                    </div>
                    <div class="content">
                        <p>Please verify your email address by clicking the button below:</p>
                        <a href="${sanitizeInput(verificationLink)}" class="button">Verify Email Address</a>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p style="word-break: break-all;">${sanitizeInput(verificationLink)}</p>
                        <p>If you didn't request this verification, you can safely ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>Best regards,<br>The Little Big Hope Team</p>
                        <p style="font-size: 12px;">This link will expire in 24 hours for security reasons.</p>
                    </div>
                </div>
            `;
        },
        text: ({ firstName = '', verificationLink = '' }) => {
            validateTemplateData({ firstName });
            return `
Hello ${firstName},

Please verify your email address by clicking the link below:

${verificationLink}

If you didn't request this verification, you can safely ignore this email.

Best regards,
The Little Big Hope Team
            `.trim();
        }
    },
    email_verified: {
        subject: 'Email Successfully Verified',
        html: ({ firstName = '' }) => {
            validateTemplateData({ firstName });
            return `
                ${baseStyles}
                <div class="email-container">
                    <div class="header">
                        <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                        <h1>Hello ${sanitizeInput(firstName)},</h1>
                    </div>
                    <div class="content">
                        <p>Your email address has been successfully verified!</p>
                        <p>You now have full access to your Little Big Hope account.</p>
                    </div>
                    <div class="footer">
                        <p>Best regards,<br>The Little Big Hope Team</p>
                    </div>
                </div>
            `;
        },
        text: ({ firstName = '' }) => {
            validateTemplateData({ firstName });
            return `
Hello ${firstName},

Your email address has been successfully verified!

You now have full access to your Little Big Hope account.

Best regards,
The Little Big Hope Team
            `.trim();
        }
    },
    password_reset: {
        subject: 'Reset Your Password',
        html: ({ firstName = '', resetLink = '' }) => {
            validateTemplateData({ firstName });
            return `
                ${baseStyles}
                <div class="email-container">
                    <div class="header">
                        <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                        <h1>Hello ${sanitizeInput(firstName)},</h1>
                    </div>
                    <div class="content">
                        <p>We received a request to reset your password.</p>
                        <a href="${sanitizeInput(resetLink)}" class="button">Reset Password</a>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p style="word-break: break-all;">${sanitizeInput(resetLink)}</p>
                        <p>If you didn't request this change, you can safely ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>Best regards,<br>The Little Big Hope Team</p>
                        <p style="font-size: 12px;">This link will expire in 24 hours for security reasons.</p>
                    </div>
                </div>
            `;
        },
        text: ({ firstName = '', resetLink = '' }) => {
            validateTemplateData({ firstName });
            return `
Hello ${firstName},

We received a request to reset your password.

Please click the link below to reset your password:

${resetLink}

If you didn't request this change, you can safely ignore this email.

Best regards,
The Little Big Hope Team
            `.trim();
        }
    },
    password_changed: {
        subject: 'Password Successfully Changed',
        html: ({ firstName = '' }) => {
            validateTemplateData({ firstName });
            return `
                ${baseStyles}
                <div class="email-container">
                    <div class="header">
                        <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                        <h1>Hello ${sanitizeInput(firstName)},</h1>
                    </div>
                    <div class="content">
                        <p>Your password has been successfully changed.</p>
                        <p>If you didn't make this change, please contact us immediately at <a href="mailto:support@littlebighope.com">support@littlebighope.com</a></p>
                    </div>
                    <div class="footer">
                        <p>Best regards,<br>The Little Big Hope Team</p>
                    </div>
                </div>
            `;
        },
        text: ({ firstName = '' }) => {
            validateTemplateData({ firstName });
            return `
Hello ${firstName},

Your password has been successfully changed.

If you didn't make this change, please contact us immediately at support@littlebighope.com

Best regards,
The Little Big Hope Team
            `.trim();
        }
    },
    purchase_confirmation: {
        subject: 'Thank You for Your Purchase!',
        html: ({ firstName = '', purchaseId = '' }) => {
            validateTemplateData({ firstName });
            return `
                ${baseStyles}
                <div class="email-container">
                    <div class="header">
                        <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                        <h1>Thank you ${sanitizeInput(firstName)}!</h1>
                    </div>
                    <div class="content">
                        <p>Your purchase has been confirmed.</p>
                        <p>Order ID: ${sanitizeInput(purchaseId)}</p>
                    </div>
                    <div class="footer">
                        <p>Best regards,<br>The Little Big Hope Team</p>
                    </div>
                </div>
            `;
        },
        text: ({ firstName = '', purchaseId = '' }) => {
            validateTemplateData({ firstName });
            return `
Thank you ${firstName}!

Your purchase has been confirmed.
Order ID: ${purchaseId}

Best regards,
The Little Big Hope Team
            `.trim();
        }
    },
    orderConfirmation: {
        subject: 'Your Order at Little Big Hope',
        text: (data) => {
            return `
Thank you for your order!

Your order has been successfully placed and will be processed as soon as possible.

Order number: ${data.id}

Best regards,
Your Little Big Hope Team
            `;
        },
        html: (data) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Thank you for your order!</h1>
                </div>
                <div class="content">
                    <p>Your order has been successfully placed and will be processed as soon as possible.</p>
                    <p><strong>Order number:</strong> ${sanitizeInput(data.id)}</p>
                </div>
                <div class="footer">
                    <p>Best regards,<br>Your Little Big Hope Team</p>
                </div>
            </div>
        `
    }
};
