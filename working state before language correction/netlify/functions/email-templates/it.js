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
        subject: 'Benvenuto su Little Big Hope!',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Benvenuto ${sanitizeInput(firstName)}!</h1>
            <p>Grazie per esserti registrato su Little Big Hope. Siamo lieti di averti nella nostra community.</p>
            <p>Se hai domande, non esitare a contattarci.</p>
            <div class="footer">
                <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
            </div>
        `
    },

    email_verification: {
        subject: 'Verifica il tuo indirizzo email',
        html: ({ firstName = '', verificationLink = '' }) => `
            ${baseStyles}
            <h1>Ciao ${sanitizeInput(firstName)},</h1>
            <p>Per favore verifica il tuo indirizzo email cliccando sul pulsante qui sotto:</p>
            <a href="${sanitizeInput(verificationLink)}" class="button">Verifica indirizzo email</a>
            <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
            <p style="word-break: break-all;">${sanitizeInput(verificationLink)}</p>
            <p>Se non hai richiesto questa verifica, puoi ignorare questa email.</p>
            <div class="footer">
                <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
                <p style="font-size: 12px;">Questo link scadrà tra 24 ore per motivi di sicurezza.</p>
            </div>
        `
    },

    email_verified: {
        subject: 'Email verificata con successo',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Ciao ${sanitizeInput(firstName)},</h1>
            <p>Il tuo indirizzo email è stato verificato con successo!</p>
            <p>Ora hai accesso completo al tuo account Little Big Hope.</p>
            <div class="footer">
                <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
            </div>
        `
    },

    password_reset: {
        subject: 'Reimposta la tua password',
        html: ({ firstName = '', resetLink = '' }) => `
            ${baseStyles}
            <h1>Ciao ${sanitizeInput(firstName)},</h1>
            <p>Abbiamo ricevuto una richiesta di reimpostazione della password.</p>
            <a href="${sanitizeInput(resetLink)}" class="button">Reimposta password</a>
            <p>Se il pulsante non funziona, copia e incolla questo link nel tuo browser:</p>
            <p style="word-break: break-all;">${sanitizeInput(resetLink)}</p>
            <p>Se non hai fatto questa richiesta, puoi ignorare questa email.</p>
            <div class="footer">
                <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
                <p style="font-size: 12px;">Questo link scadrà tra 24 ore per motivi di sicurezza.</p>
            </div>
        `
    },

    password_changed: {
        subject: 'Password modificata con successo',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Ciao ${sanitizeInput(firstName)},</h1>
            <p>La tua password è stata modificata con successo.</p>
            <p>Se non hai fatto questa modifica, contattaci immediatamente.</p>
            <div class="footer">
                <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
            </div>
        `
    },

    purchase_confirmation: {
        subject: 'Grazie per il tuo acquisto!',
        html: ({ firstName = '', orderDetails = {} }) => `
            ${baseStyles}
            <h1>Ciao ${sanitizeInput(firstName)},</h1>
            <p>Grazie per il tuo acquisto su Little Big Hope!</p>
            ${orderDetails.items ? `
                <div style="margin: 24px 0;">
                    <h2>Il tuo ordine:</h2>
                    ${orderDetails.items.map(item => `
                        <div style="margin: 8px 0;">
                            <strong>${sanitizeInput(item.name)}</strong> - €${sanitizeInput(item.price)}
                        </div>
                    `).join('')}
                    ${orderDetails.shipping ? `
                        <div style="margin-top: 16px;">
                            <strong>Spese di spedizione:</strong> €${sanitizeInput(orderDetails.shipping)}
                        </div>
                    ` : ''}
                    <div style="margin-top: 16px; font-weight: bold;">
                        <strong>Totale:</strong> €${sanitizeInput(orderDetails.total)}
                    </div>
                </div>
            ` : ''}
            <div class="footer">
                <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
            </div>
        `
    }
};
