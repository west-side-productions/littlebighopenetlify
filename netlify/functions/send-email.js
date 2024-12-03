const sgMail = require('@sendgrid/mail');
const templates = {
  de: require('./email-templates/de'),
  en: require('./email-templates/en'),
  fr: require('./email-templates/fr'),
  it: require('./email-templates/it')
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

    // Log incoming request (without sensitive data)
    console.log('Email request details:', {
      templateName,
      language,
      hasVariables: Object.keys(variables).length > 0,
      variableKeys: Object.keys(variables),
      toEmailDomain: to ? to.split('@')[1] : undefined
    });

    // Validate required fields
    if (!to || !templateName) {
      console.error('Missing required fields:', { to: !!to, templateName: !!templateName });
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: 'Missing required fields',
          details: {
            to: !to ? 'Email address is required' : null,
            templateName: !templateName ? 'Template name is required' : null
          }
        })
      };
    }

    // Check if template exists for language
    console.log('Checking template availability...');
    const templateSet = templates[language] || templates[defaultLanguage];
    if (!templateSet) {
      console.error('Template set not found for language:', language);
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: `Template set not found for language: ${language}`,
          details: `Templates not found for language: ${language}`
        })
      };
    }

    const template = templateSet[templateName];
    if (!template) {
      console.error('Template not found:', { language, templateName });
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          message: `Template not found: ${templateName}`,
          details: `Template '${templateName}' not found in ${language} templates`
        })
      };
    }

    console.log('Processing template with variables...');
    const { subject, html, text } = template;
    const processedEmail = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: replaceTemplateVariables(subject, variables),
      html: replaceTemplateVariables(html, variables),
      text: replaceTemplateVariables(text, variables)
    };

    console.log('Sending email via SendGrid...');
    await sgMail.send(processedEmail);
    console.log('Email sent successfully!');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Email sent successfully',
        details: {
          to,
          templateName,
          language
        }
      })
    };
  } catch (error) {
    console.error('Error processing email request:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // Handle SendGrid specific errors
    if (error.response && error.response.body) {
      const { message, code } = error.response.body;
      return {
        statusCode: error.code || 500,
        body: JSON.stringify({ 
          message: 'Error sending email',
          details: message,
          code: code
        })
      };
    }

    // Return appropriate error response
    return {
      statusCode: error.code === 'ENOENT' ? 404 : 500,
      body: JSON.stringify({
        message: 'Error sending email',
        error: error.message
      })
    };
  }
};
