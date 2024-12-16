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
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
        }
        .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 2px solid #f0f0f0;
            margin-bottom: 30px;
        }
        .logo {
            max-width: 200px;
            height: auto;
            margin-bottom: 20px;
        }
        h1 {
            color: #2c5282;
            font-size: 24px;
            margin: 20px 0;
            font-weight: 600;
        }
        h2 {
            color: #2d3748;
            font-size: 20px;
            margin: 15px 0;
            font-weight: 500;
        }
        .order-details {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .order-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            background: white;
            border-radius: 6px;
            overflow: hidden;
        }
        .order-table th,
        .order-table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        .order-table th {
            background: #f7fafc;
            font-weight: 600;
            color: #4a5568;
        }
        .order-table tr:last-child td {
            border-bottom: none;
        }
        .address-block {
            margin: 20px 0;
            padding: 20px;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .weight-info {
            margin: 20px 0;
            padding: 20px;
            background: #f1f5f9;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
            text-align: center;
            color: #718096;
            font-size: 14px;
        }
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
                padding: 10px !important;
            }
            .order-table {
                font-size: 14px;
            }
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
                    <img src="cid:logo" alt="Little Big Hope Logo" class="logo">
                    <h1>Willkommen ${sanitizeInput(firstName)}!</h1>
                </div>
                <p>Vielen Dank, dass Sie sich bei Little Big Hope angemeldet haben. Wir freuen uns, Sie in unserer Community begrüßen zu dürfen.</p>
                <p>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>
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
                    <img src="cid:logo" alt="Little Big Hope Logo" class="logo">
                    <h1>Hallo ${sanitizeInput(firstName)},</h1>
                </div>
                <p>Bitte bestätigen Sie Ihre E-Mail-Adresse durch Klicken auf den folgenden Link:</p>
                <a href="${sanitizeInput(verificationLink)}" class="button">E-Mail-Adresse bestätigen</a>
                <p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
                <p style="word-break: break-all;">${sanitizeInput(verificationLink)}</p>
                <p>Falls Sie diese Verifizierung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
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
                    <img src="cid:logo" alt="Little Big Hope Logo" class="logo">
                    <h1>Hallo ${sanitizeInput(firstName)},</h1>
                </div>
                <p>Ihre E-Mail-Adresse wurde erfolgreich bestätigt!</p>
                <p>Sie haben nun vollen Zugriff auf Ihr Little Big Hope Konto.</p>
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
                    <img src="cid:logo" alt="Little Big Hope Logo" class="logo">
                    <h1>Hallo ${sanitizeInput(firstName)},</h1>
                </div>
                <p>Wir haben eine Anfrage erhalten, Ihr Passwort zurückzusetzen.</p>
                <a href="${sanitizeInput(resetLink)}" class="button">Passwort zurücksetzen</a>
                <p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:</p>
                <p style="word-break: break-all;">${sanitizeInput(resetLink)}</p>
                <p>Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
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
                    <img src="cid:logo" alt="Little Big Hope Logo" class="logo">
                    <h1>Hallo ${sanitizeInput(firstName)},</h1>
                </div>
                <p>Ihr Passwort wurde erfolgreich geändert.</p>
                <p>Falls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie uns bitte umgehend.</p>
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
                    <img src="cid:logo" alt="Little Big Hope Logo" class="logo">
                    <h1>Vielen Dank für Ihren Einkauf!</h1>
                </div>
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
                    <img src="cid:logo" alt="Little Big Hope Logo" class="logo">
                    <h1>Vielen Dank für Ihre Bestellung!</h1>
                </div>
                <p>Ihre Bestellung wurde erfolgreich aufgegeben und wird schnellstmöglich bearbeitet.</p>
                <p><strong>Bestellnummer:</strong> ${sanitizeInput(data.id)}</p>
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
                    <img src="cid:logo" alt="Little Big Hope Logo" class="logo">
                    <h1>Neue Bestellung Eingegangen</h1>
                </div>
                
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

                <div class="footer">
                    <p>© ${new Date().getFullYear()} Little Big Hope. Alle Rechte vorbehalten.</p>
                </div>
            </div>`;
        }
    }
};
