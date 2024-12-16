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
            margin: 20px 0;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f8f8;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            color: #666666;
            font-size: 14px;
        }
    </style>
`;

module.exports = {
    welcome: {
        subject: 'Willkommen bei Little Big Hope!',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Willkommen ${sanitizeInput(firstName)}!</h1>
                </div>
                <div class="content">
                    <p>Vielen Dank, dass Sie sich bei Little Big Hope angemeldet haben. Wir freuen uns, Sie in unserer Community begrüßen zu dürfen.</p>
                    <p>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>
                </div>
                <div class="footer">
                    <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
                </div>
            </div>
        `
    },
    email_verification: {
        subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
        html: ({ firstName = '', verificationLink = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Hallo ${sanitizeInput(firstName)},</h1>
                </div>
                <div class="content">
                    <p>Bitte bestätigen Sie Ihre E-Mail-Adresse durch Klicken auf den folgenden Link:</p>
                    <a href="${sanitizeInput(verificationLink)}" class="button">E-Mail-Adresse bestätigen</a>
                    <p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
                    <p style="word-break: break-all;">${sanitizeInput(verificationLink)}</p>
                    <p>Falls Sie diese Verifizierung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
                </div>
                <div class="footer">
                    <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
                    <p style="font-size: 12px;">Dieser Link ist aus Sicherheitsgründen nur 24 Stunden gültig.</p>
                </div>
            </div>
        `
    },
    verification_success: {
        subject: 'E-Mail-Adresse erfolgreich bestätigt',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Hallo ${sanitizeInput(firstName)},</h1>
                </div>
                <div class="content">
                    <p>Ihre E-Mail-Adresse wurde erfolgreich bestätigt!</p>
                    <p>Sie haben nun vollen Zugriff auf Ihr Little Big Hope Konto.</p>
                </div>
                <div class="footer">
                    <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
                </div>
            </div>
        `
    },
    password_reset: {
        subject: 'Passwort zurücksetzen',
        html: ({ firstName = '', resetLink = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Hallo ${sanitizeInput(firstName)},</h1>
                </div>
                <div class="content">
                    <p>Wir haben eine Anfrage erhalten, Ihr Passwort zurückzusetzen.</p>
                    <a href="${sanitizeInput(resetLink)}" class="button">Passwort zurücksetzen</a>
                    <p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
                    <p style="word-break: break-all;">${sanitizeInput(resetLink)}</p>
                    <p>Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
                </div>
                <div class="footer">
                    <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
                    <p style="font-size: 12px;">Dieser Link ist aus Sicherheitsgründen nur 24 Stunden gültig.</p>
                </div>
            </div>
        `
    },
    password_changed: {
        subject: 'Passwort erfolgreich geändert',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Hallo ${sanitizeInput(firstName)},</h1>
                </div>
                <div class="content">
                    <p>Ihr Passwort wurde erfolgreich geändert.</p>
                    <p>Falls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie uns bitte umgehend.</p>
                </div>
                <div class="footer">
                    <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
                </div>
            </div>
        `
    },
    purchase_confirmation: {
        subject: 'Vielen Dank für Ihren Einkauf!',
        html: ({ firstName = '', orderDetails = {} }) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <h1>Vielen Dank für Ihren Einkauf!</h1>
                </div>
                <div class="content">
                    <p>Vielen Dank für Ihren Einkauf bei Little Big Hope!</p>
                    ${orderDetails.items ? `
                        <div class="order-details">
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
                </div>
                <div class="footer">
                    <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
                </div>
            </div>
        `
    },
    orderConfirmation: {
        subject: 'Ihre Bestellung bei Little Big Hope',
        text: (data) => {
            return `
Vielen Dank für Ihre Bestellung!

Ihre Bestellung wurde erfolgreich aufgegeben und wird schnellstmöglich bearbeitet.

Bestellnummer: ${data.id}

Beste Grüße,
Ihr Little Big Hope Team
            `;
        },
        html: (data) => `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Vielen Dank für Ihre Bestellung!</h1>
                </div>
                <div class="content">
                    <p>Ihre Bestellung wurde erfolgreich aufgegeben und wird schnellstmöglich bearbeitet.</p>
                    <p><strong>Bestellnummer:</strong> ${sanitizeInput(data.id)}</p>
                </div>
                <div class="footer">
                    <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
                </div>
            </div>
        `
    },
    orderNotification: {
        subject: 'Neue Bestellung eingegangen',
        text: ({ orderDetails = {} }) => {
            const address = orderDetails.shippingAddress || {};
            return `
Neue Bestellung Eingegangen

Bestellnummer: ${orderDetails.orderNumber}

Kundeninformationen:
Lieferadresse:
${address.name || ''}
${address.line1 || ''}
${address.line2 ? `${address.line2}\n` : ''}${address.postal_code || ''} ${address.city || ''}
${address.state ? `${address.state}\n` : ''}${address.country || ''}
E-Mail: ${orderDetails.customerEmail || ''}

Gewichtsinformationen:
Produktgewicht: ${orderDetails.weights?.productWeight || 0} g
Verpackungsgewicht: ${orderDetails.weights?.packagingWeight || 0} g
Gesamtgewicht: ${orderDetails.weights?.totalWeight || 0} g

Bestelldetails:
${orderDetails.items ? orderDetails.items.map(item => `${item.name}: ${item.price} ${item.currency}`).join('\n') : ''}
`;
        },
        html: ({ orderDetails = {} }) => {
            const address = orderDetails.shippingAddress || {};
            return `
            ${baseStyles}
            <div class="email-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Little Big Hope Logo" class="logo">
                    <h1>Neue Bestellung Eingegangen</h1>
                </div>
                
                <div class="content">
                    <p><strong>Bestellnummer:</strong> ${orderDetails.orderNumber}</p>
                    
                    <div class="address-block">
                        <h2>Lieferadresse</h2>
                        <p>
                            ${address.name || ''}<br>
                            ${address.line1 || ''}<br>
                            ${address.line2 ? `${address.line2}<br>` : ''}
                            ${address.postal_code || ''} ${address.city || ''}<br>
                            ${address.state ? `${address.state}<br>` : ''}
                            ${address.country || ''}
                        </p>
                        <p><strong>E-Mail:</strong> ${orderDetails.customerEmail || ''}</p>
                    </div>

                    <div class="weight-info">
                        <h2>Gewichtsinformationen</h2>
                        <p>
                            <strong>Produktgewicht:</strong> ${orderDetails.weights?.productWeight || 0} g<br>
                            <strong>Verpackungsgewicht:</strong> ${orderDetails.weights?.packagingWeight || 0} g<br>
                            <strong>Gesamtgewicht:</strong> ${orderDetails.weights?.totalWeight || 0} g
                        </p>
                    </div>

                    <div class="order-details">
                        <h2>Bestelldetails</h2>
                        <table class="order-table">
                            <thead>
                                <tr>
                                    <th>Produkt</th>
                                    <th>Preis</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orderDetails.items ? orderDetails.items.map(item => `
                                    <tr>
                                        <td>${item.name}</td>
                                        <td>${item.price} ${item.currency}</td>
                                    </tr>
                                `).join('') : ''}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="footer">
                    <p>Little Big Hope - Bestellsystem</p>
                </div>
            </div>`;
        }
    }
};
