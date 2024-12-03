module.exports = {
  welcome: {
    subject: 'Welcome to Little Big Hope!',
    html: ({ firstName }) => `
      <h1>Welcome ${firstName}!</h1>
      <p>Thank you for joining Little Big Hope. We're excited to have you as part of our community.</p>
      <p>If you have any questions, feel free to reach out to us.</p>
      <p>Best regards,<br>The Little Big Hope Team</p>
    `
  },

  email_verification: {
    subject: 'Verify your email address',
    html: ({ firstName, verificationLink }) => `
      <h1>Hello ${firstName},</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationLink}">Verify Email Address</a></p>
      <p>If you didn't request this verification, you can safely ignore this email.</p>
      <p>Best regards,<br>The Little Big Hope Team</p>
    `
  },

  email_verified: {
    subject: 'Email Successfully Verified',
    html: ({ firstName }) => `
      <h1>Hello ${firstName},</h1>
      <p>Your email address has been successfully verified!</p>
      <p>You now have full access to your Little Big Hope account.</p>
      <p>Best regards,<br>The Little Big Hope Team</p>
    `
  },

  password_reset: {
    subject: 'Reset Your Password',
    html: ({ firstName, resetLink }) => `
      <h1>Hello ${firstName},</h1>
      <p>We received a request to reset your password.</p>
      <p>Click the link below to set a new password:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>If you didn't request this change, you can safely ignore this email.</p>
      <p>Best regards,<br>The Little Big Hope Team</p>
    `
  },

  password_changed: {
    subject: 'Password Successfully Changed',
    html: ({ firstName }) => `
      <h1>Hello ${firstName},</h1>
      <p>Your password has been successfully changed.</p>
      <p>If you didn't make this change, please contact us immediately.</p>
      <p>Best regards,<br>The Little Big Hope Team</p>
    `
  },

  purchase_confirmation: {
    subject: 'Thank You for Your Purchase!',
    html: ({ firstName, purchaseId }) => `
      <h1>Thank you for your purchase, ${firstName}!</h1>
      <p>We've received your order (ID: ${purchaseId}) and are processing it now.</p>
      <p>You'll receive another email with your order details and tracking information once it ships.</p>
      <p>Best regards,<br>The Little Big Hope Team</p>
    `
  }
};
