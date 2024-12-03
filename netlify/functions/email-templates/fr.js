module.exports = {
  verification: {
    subject: 'Vérifiez votre adresse e-mail',
    body: `
      Bonjour {{firstName}},
      
      Veuillez vérifier votre adresse e-mail en cliquant sur le lien ci-dessous :
      {{verificationLink}}
      
      Si vous n'avez pas fait cette demande, vous pouvez ignorer cet e-mail.
      
      Cordialement,
      Votre équipe
    `
  },
  passwordReset: {
    subject: 'Réinitialisation de votre mot de passe',
    body: `
      Bonjour {{firstName}},
      
      Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous :
      {{resetLink}}
      
      Si vous n'avez pas fait cette demande, vous pouvez ignorer cet e-mail.
      
      Cordialement,
      Votre équipe
    `
  },
  welcome: {
    subject: 'Bienvenue !',
    body: `
      Bonjour {{firstName}},
      
      Bienvenue ! Nous sommes ravis de vous avoir parmi nous.
      
      Cordialement,
      Votre équipe
    `
  },
  abandonedCart: {
    subject: 'Votre panier vous attend',
    body: `
      Bonjour {{firstName}},
      
      Vous avez encore des articles dans votre panier. Souhaitez-vous finaliser votre achat ?
      {{cartLink}}
      
      Cordialement,
      Votre équipe
    `
  }
};
