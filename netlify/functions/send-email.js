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
  if (event.httpMethod !== 'POST') {
    console.log('Method not allowed:', event.httpMethod);
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

    // Log incoming request (without sensitive data)
    console.log('Processing email request:', {
      templateName,
      language,
      hasVariables: Object.keys(variables).length > 0,
      variables: { ...variables, email: undefined }  // Log variables without email
    });

    // Validate required fields
    if (!to || !templateName) {
      console.log('Missing required fields:', { to: !!to, templateName: !!templateName });
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

    // Validate language
    const validLanguages = Object.keys(templates);
    if (!validLanguages.includes(language)) {
      console.warn(`Invalid language ${language}, falling back to ${defaultLanguage}`);
      language = defaultLanguage;
    }

    // Get template for specified language
    const langTemplates = templates[language];
    if (!langTemplates) {
      console.error(`No templates found for language: ${language}`);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          message: 'Template configuration error',
          details: `Templates not found for language: ${language}`
        })
      };
    }

    console.log('Using templates for language:', language);
    console.log('Available templates:', Object.keys(langTemplates));
    
    const template = langTemplates[templateName];
    if (!template) {
      console.error(`Template '${templateName}' not found in ${language} templates`);
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          message: 'Template not found',
          details: `Template '${templateName}' not found in ${language} templates`
        })
      };
    }

    console.log('Using template:', {
      name: templateName,
      language,
      hasSubject: !!template.subject,
      hasHtmlFunction: typeof template.html === 'function'
    });

    // Get HTML content from template function
    const htmlContent = template.html(variables);
    console.log('Generated HTML preview:', htmlContent.substring(0, 200) + '...');

    const subject = template.subject;

    // Prepare email
    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      text: htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
      html: htmlContent
    };

    // Validate SendGrid configuration
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          message: 'Email service not configured',
          details: 'SendGrid API key is missing'
        })
      };
    }

    if (!process.env.SENDGRID_FROM_EMAIL) {
      console.error('SendGrid sender email not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          message: 'Email service not configured',
          details: 'Sender email is missing'
        })
      };
    }

    // Send email
    console.log('Sending email in language:', language);
    await sgMail.send(msg);
    console.log('Email sent successfully');

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
    console.error('Error sending email:', error);
    
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

    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Error sending email',
        details: error.message
      })
    };
  }
};
