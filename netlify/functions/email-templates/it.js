// Modelli email con formattazione e sicurezza migliorate
const sanitizeInput = (input) => {
    if (!input) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
        subject: 'Benvenuto su Little Big Hope!',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Benvenuto ${sanitizeInput(firstName)}!</h1>
                </div>
                <div class="content">
                    <p>Grazie per esserti registrato su Little Big Hope. Siamo lieti di averti nella nostra community.</p>
                    <p>Se hai domande, non esitare a contattarci.</p>
                </div>
                <div class="footer">
                    <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
                </div>
            </div>
        `
    },

    email_verification: {
        subject: 'Verifica il tuo indirizzo email',
        html: ({ firstName = '', verificationLink = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Ciao ${sanitizeInput(firstName)},</h1>
                </div>
                <div class="content">
                    <p>Per favore verifica il tuo indirizzo email cliccando sul pulsante qui sotto:</p>
                    <a href="${sanitizeInput(verificationLink)}" class="button">Verifica indirizzo email</a>
                    <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
                    <p style="word-break: break-all;">${sanitizeInput(verificationLink)}</p>
                    <p>Se non hai richiesto questa verifica, puoi ignorare questa email.</p>
                </div>
                <div class="footer">
                    <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
                    <p style="font-size: 12px;">Questo link scadrà tra 24 ore per motivi di sicurezza.</p>
                </div>
            </div>
        `
    },

    email_verified: {
        subject: 'Email verificata con successo',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Ciao ${sanitizeInput(firstName)},</h1>
                </div>
                <div class="content">
                    <p>Il tuo indirizzo email è stato verificato con successo!</p>
                    <p>Ora hai accesso completo al tuo account Little Big Hope.</p>
                </div>
                <div class="footer">
                    <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
                </div>
            </div>
        `
    },

    password_reset: {
        subject: 'Reimposta la tua password',
        html: ({ firstName = '', resetLink = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Ciao ${sanitizeInput(firstName)},</h1>
                </div>
                <div class="content">
                    <p>Abbiamo ricevuto una richiesta di reimpostazione della password.</p>
                    <a href="${sanitizeInput(resetLink)}" class="button">Reimposta password</a>
                    <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
                    <p style="word-break: break-all;">${sanitizeInput(resetLink)}</p>
                    <p>Se non hai fatto questa richiesta, puoi ignorare questa email.</p>
                </div>
                <div class="footer">
                    <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
                    <p style="font-size: 12px;">Questo link scadrà tra 24 ore per motivi di sicurezza.</p>
                </div>
            </div>
        `
    },

    password_changed: {
        subject: 'Password modificata con successo',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Ciao ${sanitizeInput(firstName)},</h1>
                </div>
                <div class="content">
                    <p>La tua password è stata modificata con successo.</p>
                    <p>Se non hai fatto questa modifica, contattaci immediatamente.</p>
                </div>
                <div class="footer">
                    <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
                </div>
            </div>
        `
    },

    purchase_confirmation: {
        subject: 'Grazie per il tuo acquisto!',
        html: ({ firstName = '', orderDetails = {} }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Grazie ${sanitizeInput(firstName)}!</h1>
                </div>
                <div class="content">
                    <p>Il tuo acquisto è stato confermato.</p>
                    <p>Dettagli dell'ordine:</p>
                    <table>
                        <tr>
                            <th>Prodotto</th>
                            <td>${sanitizeInput(orderDetails.productName || '')}</td>
                        </tr>
                        <tr>
                            <th>Prezzo</th>
                            <td>${sanitizeInput(orderDetails.price || '')}</td>
                        </tr>
                    </table>
                    <p>Se hai domande, non esitare a contattarci.</p>
                </div>
                <div class="footer">
                    <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
                </div>
            </div>
        `
    },

    orderConfirmation: {
        subject: 'Il tuo ordine su Little Big Hope',
        text: (data) => {
            return `
Grazie per il tuo ordine!

Il tuo ordine è stato ricevuto con successo e sarà elaborato il prima possibile.

Numero ordine: ${data.id}

Cordiali saluti,
Il team di Little Big Hope
            `;
        },
        html: (data) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Grazie per il tuo ordine!</h1>
                </div>
                <div class="content">
                    <p>Il tuo ordine è stato ricevuto con successo e sarà elaborato il prima possibile.</p>
                    <p><strong>Numero ordine:</strong> ${sanitizeInput(data.id)}</p>
                </div>
                <div class="footer">
                    <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
                </div>
            </div>
        `
    }
};
