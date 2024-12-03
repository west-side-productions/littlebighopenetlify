const sgMail = require('@sendgrid/mail');
const templates = {
  de: require('./email-templates/de'),
  en: require('./email-templates/en'),
  fr: require('./email-templates/fr'),
  it: require('./email-templates/it')
};

exports.handler = async (event, context) => {
  // Only allow GET requests for testing
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  // Get parameters from query string
  const params = event.queryStringParameters || {};
  const {
    to = process.env.TEST_EMAIL, // fallback to environment variable
    template = 'welcome',        // default to welcome template
    language = 'de',            // default to German
    firstName = 'Test User'     // default test name
  } = params;

  // Initialize SendGrid
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    // Get template
    const langTemplates = templates[language] || templates['en'];
    const emailTemplate = langTemplates[template];

    if (!emailTemplate) {
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          message: 'Template not found',
          availableTemplates: Object.keys(langTemplates)
        })
      };
    }

    // Prepare email
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: emailTemplate.subject,
      text: emailTemplate.body.replace('{{firstName}}', firstName),
      html: emailTemplate.body.replace('{{firstName}}', firstName).replace(/\n/g, '<br>')
    };

    // Add template-specific variables
    switch (template) {
      case 'verification':
        msg.text = msg.text.replace('{{verificationLink}}', 'https://example.com/verify?token=test-token');
        msg.html = msg.html.replace('{{verificationLink}}', 'https://example.com/verify?token=test-token');
        break;
      case 'passwordReset':
        msg.text = msg.text.replace('{{resetLink}}', 'https://example.com/reset?token=test-token');
        msg.html = msg.html.replace('{{resetLink}}', 'https://example.com/reset?token=test-token');
        break;
      case 'abandonedCart':
        msg.text = msg.text.replace('{{cartLink}}', 'https://example.com/cart');
        msg.html = msg.html.replace('{{cartLink}}', 'https://example.com/cart');
        break;
    }

    // Send email
    await sgMail.send(msg);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Test email sent successfully',
        details: {
          to,
          template,
          language,
          firstName
        }
      })
    };

  } catch (error) {
    console.error('Error sending test email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error sending test email',
        error: error.message,
        details: error.response?.body || {}
      })
    };
  }
};
