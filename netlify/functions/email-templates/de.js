// Email templates with improved formatting and safety checks
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
        subject: 'Willkommen bei Little Big Hope!',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Willkommen ${sanitizeInput(firstName)}!</h1>
            <p>Vielen Dank, dass Sie sich bei Little Big Hope angemeldet haben. Wir freuen uns, Sie in unserer Community begrüßen zu dürfen.</p>
            <p>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>
            <div class="footer">
                <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
            </div>
        `
    },
    email_verification: {
        subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
        html: ({ firstName = '', verificationLink = '' }) => `
            ${baseStyles}
            <h1>Hallo ${sanitizeInput(firstName)},</h1>
            <p>Bitte bestätigen Sie Ihre E-Mail-Adresse durch Klicken auf den folgenden Link:</p>
            <a href="${sanitizeInput(verificationLink)}" class="button">E-Mail-Adresse bestätigen</a>
            <p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
            <p style="word-break: break-all;">${sanitizeInput(verificationLink)}</p>
            <p>Falls Sie diese Verifizierung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
            <div class="footer">
                <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
                <p style="font-size: 12px;">Dieser Link ist aus Sicherheitsgründen nur 24 Stunden gültig.</p>
            </div>
        `
    },
    verification_success: {
        subject: 'E-Mail-Adresse erfolgreich bestätigt',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Hallo ${sanitizeInput(firstName)},</h1>
            <p>Ihre E-Mail-Adresse wurde erfolgreich bestätigt!</p>
            <p>Sie haben nun vollen Zugriff auf Ihr Little Big Hope Konto.</p>
            <div class="footer">
                <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
            </div>
        `
    },
    password_reset: {
        subject: 'Passwort zurücksetzen',
        html: ({ firstName = '', resetLink = '' }) => `
            ${baseStyles}
            <h1>Hallo ${sanitizeInput(firstName)},</h1>
            <p>Wir haben eine Anfrage erhalten, Ihr Passwort zurückzusetzen.</p>
            <a href="${sanitizeInput(resetLink)}" class="button">Passwort zurücksetzen</a>
            <p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
            <p style="word-break: break-all;">${sanitizeInput(resetLink)}</p>
            <p>Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
            <div class="footer">
                <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
                <p style="font-size: 12px;">Dieser Link ist aus Sicherheitsgründen nur 24 Stunden gültig.</p>
            </div>
        `
    },
    password_changed: {
        subject: 'Passwort erfolgreich geändert',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Hallo ${sanitizeInput(firstName)},</h1>
            <p>Ihr Passwort wurde erfolgreich geändert.</p>
            <p>Falls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie uns bitte umgehend.</p>
            <div class="footer">
                <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
            </div>
        `
    },
    purchase_confirmation: {
        subject: 'Vielen Dank für Ihren Einkauf!',
        html: ({ firstName = '', orderDetails = {} }) => `
            ${baseStyles}
            <h1>Hallo ${sanitizeInput(firstName)},</h1>
            <p>Vielen Dank für Ihren Einkauf bei Little Big Hope!</p>
            ${orderDetails.items ? `
                <div style="margin: 24px 0;">
                    <h2>Ihre Bestellung:</h2>
                    ${orderDetails.items.map(item => `
                        <div style="margin: 8px 0;">
                            <strong>${sanitizeInput(item.name)}</strong> - €${sanitizeInput(item.price)}
                        </div>
                    `).join('')}
                    ${orderDetails.shipping ? `
                        <div style="margin-top: 16px;">
                            <strong>Versand:</strong> €${sanitizeInput(orderDetails.shipping)}
                        </div>
                    ` : ''}
                    <div style="margin-top: 16px; font-weight: bold;">
                        <strong>Gesamt:</strong> €${sanitizeInput(orderDetails.total)}
                    </div>
                </div>
            ` : ''}
            <div class="footer">
                <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
            </div>
        `
    }
};
