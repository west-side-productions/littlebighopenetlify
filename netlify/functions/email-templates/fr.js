module.exports = {
    welcome: {
        subject: 'Bienvenue chez Little Big Hope !',
        html: ({ firstName }) => `
            <h1>Bienvenue ${firstName} !</h1>
            <p>Merci de vous être inscrit(e) chez Little Big Hope. Nous sommes ravis de vous accueillir dans notre communauté.</p>
            <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
            <p>Cordialement,<br>L'équipe Little Big Hope</p>
        `
    },

    email_verification: {
        subject: 'Vérifiez votre adresse e-mail',
        html: ({ firstName, verificationLink }) => `
            <h1>Bonjour ${firstName},</h1>
            <p>Veuillez vérifier votre adresse e-mail en cliquant sur le lien ci-dessous :</p>
            <p><a href="${verificationLink}">Vérifier l'adresse e-mail</a></p>
            <p>Si vous n'avez pas demandé cette vérification, vous pouvez ignorer cet e-mail.</p>
            <p>Cordialement,<br>L'équipe Little Big Hope</p>
        `
    },

    email_verified: {
        subject: 'E-mail vérifié avec succès',
        html: ({ firstName }) => `
            <h1>Bonjour ${firstName},</h1>
            <p>Votre adresse e-mail a été vérifiée avec succès !</p>
            <p>Vous avez maintenant un accès complet à votre compte Little Big Hope.</p>
            <p>Cordialement,<br>L'équipe Little Big Hope</p>
        `
    },

    password_reset: {
        subject: 'Réinitialisation de votre mot de passe',
        html: ({ firstName, resetLink }) => `
            <h1>Bonjour ${firstName},</h1>
            <p>Nous avons reçu une demande de réinitialisation de votre mot de passe.</p>
            <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
            <p><a href="${resetLink}">Réinitialiser le mot de passe</a></p>
            <p>Si vous n'avez pas fait cette demande, vous pouvez ignorer cet e-mail.</p>
            <p>Cordialement,<br>L'équipe Little Big Hope</p>
        `
    },

    password_changed: {
        subject: 'Mot de passe modifié avec succès',
        html: ({ firstName }) => `
            <h1>Bonjour ${firstName},</h1>
            <p>Votre mot de passe a été modifié avec succès.</p>
            <p>Si vous n'avez pas effectué cette modification, veuillez nous contacter immédiatement.</p>
            <p>Cordialement,<br>L'équipe Little Big Hope</p>
        `
    },

    purchase_confirmation: {
        subject: 'Merci pour votre achat !',
        html: ({ firstName, purchaseId }) => `
            <h1>Merci pour votre achat, ${firstName} !</h1>
            <p>Nous avons reçu votre commande (ID : ${purchaseId}) et nous la traitons actuellement.</p>
            <p>Vous recevrez un autre e-mail avec les détails de votre commande et les informations de suivi dès qu'elle sera expédiée.</p>
            <p>Cordialement,<br>L'équipe Little Big Hope</p>
        `
    }
};
