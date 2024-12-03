const sgMail = require('@sendgrid/mail');
const templates = {
  de: require('./email-templates/de'),
  en: require('./email-templates/en'),
  fr: require('./email-templates/fr'),
  it: require('./email-templates/it')
};

// Initialize SendGrid with your API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const defaultLanguage = 'de';

exports.handler = async (event, context) => {
  console.log('=== Email Sending Function Started ===');
  console.log('Request details:', {
    method: event.httpMethod,
    path: event.path,
    headers: event.headers
  });

  if (event.httpMethod !== 'POST') {
    console.log('Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    console.log('Parsing request body...');
    const { 
      to, 
      templateName, 
      language = defaultLanguage, 
      variables = {} 
    } = JSON.parse(event.body);

    console.log('Email request details:', {
      to,
      templateName,
      language,
      hasVariables: Object.keys(variables).length > 0,
      variableKeys: Object.keys(variables)
    });

    // Validate required fields
    if (!to || !templateName) {
      console.error('Missing required fields');
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' })
      };
    }

    // Get the correct language template
    const languageTemplates = templates[language] || templates[defaultLanguage];
    if (!languageTemplates) {
      console.error('No templates found for language:', language);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid language' })
      };
    }

    // Get the specific email template
    const template = languageTemplates[templateName];
    if (!template) {
      console.error('Template not found:', templateName);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Template not found' })
      };
    }

    console.log('Template found:', {
      language,
      templateName,
      hasSubject: !!template.subject,
      hasHtmlFunction: typeof template.html === 'function'
    });

    // Generate the email HTML using the template function
    const html = template.html(variables);
    console.log('Generated HTML length:', html.length);

    // Prepare the email
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: template.subject,
      html
    };

    console.log('Sending email...');
    await sgMail.send(msg);
    console.log('Email sent successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' })
    };

  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Error sending email',
        error: error.message
      })
    };
  }
};
