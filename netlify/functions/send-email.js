const sgMail = require('@sendgrid/mail');
const templates = {
  de: require('./email-templates/de'),
  en: require('./email-templates/en'),
  // Add fr and it templates when ready
};

// Initialize SendGrid with your API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const defaultLanguage = 'en';

const replaceTemplateVariables = (template, variables) => {
  let text = template;
  Object.keys(variables).forEach(key => {
    text = text.replace(new RegExp(`{{${key}}}`, 'g'), variables[key]);
  });
  return text;
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    const { 
      to, 
      templateName, 
      language = defaultLanguage, 
      variables = {} 
    } = JSON.parse(event.body);

    // Validate required fields
    if (!to || !templateName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' })
      };
    }

    // Get template for specified language, fallback to default language
    const langTemplates = templates[language] || templates[defaultLanguage];
    const template = langTemplates[templateName];

    if (!template) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Template not found' })
      };
    }

    // Replace variables in template
    const body = replaceTemplateVariables(template.body, variables);
    const subject = replaceTemplateVariables(template.subject, variables);

    // Prepare email
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      text: body,
      html: body.replace(/\n/g, '<br>') // Simple HTML conversion
    };

    // Send email
    await sgMail.send(msg);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' })
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error sending email', error: error.message })
    };
  }
};
