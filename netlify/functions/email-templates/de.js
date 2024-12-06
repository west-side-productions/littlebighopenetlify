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
            <h1>Vielen Dank für Ihre Bestellung!</h1>
            <p>Ihre Bestellung wurde erfolgreich aufgegeben und wird schnellstmöglich bearbeitet.</p>
            <p><strong>Bestellnummer:</strong> ${sanitizeInput(data.id)}</p>
            <div class="footer">
                <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
            </div>
        `
    },
    orderNotification: {
        subject: 'Neue Bestellung eingegangen',
        text: ({ orderDetails = {} }) => {
            const address = orderDetails.shippingAddress;
            return `
Neue Bestellung Eingegangen

Bestellnummer: ${orderDetails.orderNumber}

Kundeninformationen:
Lieferadresse:
${address.name}
${address.line1}
${address.line2 ? `${address.line2}\n` : ''}${address.postal_code} ${address.city}
${address.state ? `${address.state}\n` : ''}${address.country}

E-Mail: ${orderDetails.customerEmail}

Gewichtsinformationen:
Produktgewicht: ${orderDetails.weights.productWeight} g
Verpackungsgewicht: ${orderDetails.weights.packagingWeight} g
Gesamtgewicht: ${orderDetails.weights.totalWeight} g

Bestelldetails:
${orderDetails.items.map(item => `${item.name}: ${item.price} ${item.currency}`).join('\n')}

Versand:
Versandart: ${orderDetails.shipping.method}
Versandkosten: ${orderDetails.shipping.cost} ${orderDetails.shipping.currency}

Zusammenfassung:
Zwischensumme: ${orderDetails.total.subtotal} ${orderDetails.total.currency}
Versand: ${orderDetails.total.shipping} ${orderDetails.total.currency}
MwSt.: ${orderDetails.total.tax} ${orderDetails.total.currency}
Gesamtsumme: ${orderDetails.total.total} ${orderDetails.total.currency}
            `;
        },
        html: ({ orderDetails = {} }) => `
            ${baseStyles}
            <style>
                .order-details {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .order-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                }
                .order-table th, .order-table td {
                    padding: 10px;
                    text-align: left;
                    border-bottom: 1px solid #ddd;
                }
                .order-table th {
                    background: #edf2f7;
                }
                .address-box {
                    background: white;
                    border: 1px solid #ddd;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 4px;
                }
                .total-row {
                    font-weight: bold;
                    background: #edf2f7;
                }
                .weight-info {
                    background: white;
                    border: 1px solid #ddd;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 4px;
                }
            </style>
            <h1>Neue Bestellung Eingegangen</h1>
            <div class="order-details">
                <h2>Bestellnummer: ${sanitizeInput(orderDetails.orderNumber)}</h2>
                
                <h3>Kundeninformationen</h3>
                <div class="address-box">
                    <p><strong>Lieferadresse:</strong><br>
                    ${sanitizeInput(orderDetails.shippingAddress.name)}<br>
                    ${sanitizeInput(orderDetails.shippingAddress.line1)}
                    ${orderDetails.shippingAddress.line2 ? `<br>${sanitizeInput(orderDetails.shippingAddress.line2)}` : ''}<br>
                    ${sanitizeInput(orderDetails.shippingAddress.postal_code)} ${sanitizeInput(orderDetails.shippingAddress.city)}<br>
                    ${orderDetails.shippingAddress.state ? `${sanitizeInput(orderDetails.shippingAddress.state)}<br>` : ''}
                    ${sanitizeInput(orderDetails.shippingAddress.country)}</p>
                    
                    <p><strong>E-Mail:</strong> ${sanitizeInput(orderDetails.customerEmail)}</p>
                </div>

                <h3>Gewichtsinformationen</h3>
                <div class="weight-info">
                    <p><strong>Produktgewicht:</strong> ${sanitizeInput(orderDetails.weights.productWeight)} g</p>
                    <p><strong>Verpackungsgewicht:</strong> ${sanitizeInput(orderDetails.weights.packagingWeight)} g</p>
                    <p><strong>Gesamtgewicht:</strong> ${sanitizeInput(orderDetails.weights.totalWeight)} g</p>
                </div>

                <h3>Bestelldetails</h3>
                <table class="order-table">
                    <tr>
                        <th>Produkt</th>
                        <th>Preis</th>
                    </tr>
                    ${orderDetails.items.map(item => `
                        <tr>
                            <td>${sanitizeInput(item.name)}</td>
                            <td>${sanitizeInput(item.price)} ${sanitizeInput(item.currency)}</td>
                        </tr>
                    `).join('')}
                </table>

                <h3>Versand</h3>
                <table class="order-table">
                    <tr>
                        <td>Versandart</td>
                        <td>${sanitizeInput(orderDetails.shipping.method)}</td>
                    </tr>
                    <tr>
                        <td>Versandkosten</td>
                        <td>${sanitizeInput(orderDetails.shipping.cost)} ${sanitizeInput(orderDetails.shipping.currency)}</td>
                    </tr>
                </table>

                <h3>Zusammenfassung</h3>
                <table class="order-table">
                    <tr>
                        <td>Zwischensumme</td>
                        <td>${sanitizeInput(orderDetails.total.subtotal)} ${sanitizeInput(orderDetails.total.currency)}</td>
                    </tr>
                    <tr>
                        <td>Versand</td>
                        <td>${sanitizeInput(orderDetails.total.shipping)} ${sanitizeInput(orderDetails.total.currency)}</td>
                    </tr>
                    <tr>
                        <td>MwSt.</td>
                        <td>${sanitizeInput(orderDetails.total.tax)} ${sanitizeInput(orderDetails.total.currency)}</td>
                    </tr>
                    <tr class="total-row">
                        <td>Gesamtsumme</td>
                        <td>${sanitizeInput(orderDetails.total.total)} ${sanitizeInput(orderDetails.total.currency)}</td>
                    </tr>
                </table>
            </div>
        `
    }
};
