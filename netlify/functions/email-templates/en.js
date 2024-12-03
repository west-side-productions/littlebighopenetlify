module.exports = {
  verification: {
    subject: 'Verify Your Email Address',
    body: `
      Hello {{firstName}},
      
      Please verify your email address by clicking the link below:
      {{verificationLink}}
      
      If you didn't request this, you can safely ignore this email.
      
      Best regards,
      Your Team
    `
  },
  passwordReset: {
    subject: 'Reset Your Password',
    body: `
      Hello {{firstName}},
      
      You requested to reset your password. Click the link below:
      {{resetLink}}
      
      If you didn't request this, you can safely ignore this email.
      
      Best regards,
      Your Team
    `
  },
  welcome: {
    subject: 'Welcome!',
    body: `
      Hello {{firstName}},
      
      Welcome! We're excited to have you on board.
      
      Best regards,
      Your Team
    `
  },
  abandonedCart: {
    subject: 'Your Cart is Waiting',
    body: `
      Hello {{firstName}},
      
      You still have items in your cart. Would you like to complete your purchase?
      {{cartLink}}
      
      Best regards,
      Your Team
    `
  }
};
