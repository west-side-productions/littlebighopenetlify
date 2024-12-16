// Modèles d'e-mails avec formatage et sécurité améliorés
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
        subject: 'Bienvenue chez Little Big Hope !',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Bienvenue ${sanitizeInput(firstName)} !</h1>
            <p>Merci de vous être inscrit(e) chez Little Big Hope. Nous sommes ravis de vous accueillir dans notre communauté.</p>
            <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
            <div class="footer">
                <p>Cordialement,<br>L'équipe Little Big Hope</p>
            </div>
        `
    },

    email_verification: {
        subject: 'Vérifiez votre adresse e-mail',
        html: ({ firstName = '', verificationLink = '' }) => `
            ${baseStyles}
            <h1>Bonjour ${sanitizeInput(firstName)},</h1>
            <p>Veuillez vérifier votre adresse e-mail en cliquant sur le bouton ci-dessous :</p>
            <a href="${sanitizeInput(verificationLink)}" class="button">Vérifier l'adresse e-mail</a>
            <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
            <p style="word-break: break-all;">${sanitizeInput(verificationLink)}</p>
            <p>Si vous n'avez pas demandé cette vérification, vous pouvez ignorer cet e-mail.</p>
            <div class="footer">
                <p>Cordialement,<br>L'équipe Little Big Hope</p>
                <p style="font-size: 12px;">Ce lien expirera dans 24 heures pour des raisons de sécurité.</p>
            </div>
        `
    },

    email_verified: {
        subject: 'E-mail vérifié avec succès',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Bonjour ${sanitizeInput(firstName)},</h1>
            <p>Votre adresse e-mail a été vérifiée avec succès !</p>
            <p>Vous avez maintenant un accès complet à votre compte Little Big Hope.</p>
            <div class="footer">
                <p>Cordialement,<br>L'équipe Little Big Hope</p>
            </div>
        `
    },

    password_reset: {
        subject: 'Réinitialisation de votre mot de passe',
        html: ({ firstName = '', resetLink = '' }) => `
            ${baseStyles}
            <h1>Bonjour ${sanitizeInput(firstName)},</h1>
            <p>Nous avons reçu une demande de réinitialisation de votre mot de passe.</p>
            <a href="${sanitizeInput(resetLink)}" class="button">Réinitialiser le mot de passe</a>
            <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
            <p style="word-break: break-all;">${sanitizeInput(resetLink)}</p>
            <p>Si vous n'avez pas fait cette demande, vous pouvez ignorer cet e-mail.</p>
            <div class="footer">
                <p>Cordialement,<br>L'équipe Little Big Hope</p>
                <p style="font-size: 12px;">Ce lien expirera dans 24 heures pour des raisons de sécurité.</p>
            </div>
        `
    },

    password_changed: {
        subject: 'Mot de passe modifié avec succès',
        html: ({ firstName = '' }) => `
            ${baseStyles}
            <h1>Bonjour ${sanitizeInput(firstName)},</h1>
            <p>Votre mot de passe a été modifié avec succès.</p>
            <p>Si vous n'avez pas effectué cette modification, veuillez nous contacter immédiatement.</p>
            <div class="footer">
                <p>Cordialement,<br>L'équipe Little Big Hope</p>
            </div>
        `
    },

    purchase_confirmation: {
        subject: 'Merci pour votre achat !',
        html: ({ firstName = '', orderDetails = {} }) => `
            ${baseStyles}
            <h1>Bonjour ${sanitizeInput(firstName)},</h1>
            <p>Merci pour votre achat chez Little Big Hope !</p>
            ${orderDetails.items ? `
                <div style="margin: 24px 0;">
                    <h2>Votre commande :</h2>
                    ${orderDetails.items.map(item => `
                        <div style="margin: 8px 0;">
                            <strong>${sanitizeInput(item.name)}</strong> - €${sanitizeInput(item.price)}
                        </div>
                    `).join('')}
                    ${orderDetails.shipping ? `
                        <div style="margin-top: 16px;">
                            <strong>Frais de port :</strong> €${sanitizeInput(orderDetails.shipping)}
                        </div>
                    ` : ''}
                    <div style="margin-top: 16px; font-weight: bold;">
                        <strong>Total :</strong> €${sanitizeInput(orderDetails.total)}
                    </div>
                </div>
            ` : ''}
            <div class="footer">
                <p>Cordialement,<br>L'équipe Little Big Hope</p>
            </div>
        `
    },

    orderConfirmation: {
        subject: 'Confirmation de votre commande chez Little Big Hope',
        text: (data) => {
            return `
                Merci pour votre commande chez Little Big Hope !
                
                Votre commande a été confirmée et sera traitée dans les plus brefs délais.
                
                Cordialement,
                L'équipe Little Big Hope
            `;
        },
        html: (data) => {
            return `
                ${baseStyles}
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <img src="cid:logo" alt="Little Big Hope Logo" style="max-width: 200px; height: auto;">
                    </div>
                    <h1>Merci pour votre commande !</h1>
                    <p>Nous avons bien reçu votre commande et nous la traitons actuellement.</p>
                    <p>Vous recevrez un e-mail de confirmation dès que votre commande sera expédiée.</p>
                    <div style="margin-top: 30px;">
                        <p>Cordialement,<br>L'équipe Little Big Hope</p>
                    </div>
                </div>
            `;
        }
    }
};
