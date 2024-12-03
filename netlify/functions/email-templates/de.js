module.exports = {
  verification: {
    subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
    body: `
      Hallo {{firstName}},
      
      Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf den folgenden Link klicken:
      {{verificationLink}}
      
      Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
      
      Mit freundlichen Grüßen,
      Ihr Team
    `
  },
  passwordReset: {
    subject: 'Passwort zurücksetzen',
    body: `
      Hallo {{firstName}},
      
      Sie haben angefordert, Ihr Passwort zurückzusetzen. Klicken Sie auf den folgenden Link:
      {{resetLink}}
      
      Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.
      
      Mit freundlichen Grüßen,
      Ihr Team
    `
  },
  welcome: {
    subject: 'Willkommen!',
    body: `
      Hallo {{firstName}},
      
      Willkommen! Wir freuen uns, Sie bei uns begrüßen zu dürfen.
      
      Mit freundlichen Grüßen,
      Ihr Team
    `
  },
  abandonedCart: {
    subject: 'Ihr Warenkorb wartet auf Sie',
    body: `
      Hallo {{firstName}},
      
      Sie haben noch Artikel in Ihrem Warenkorb. Möchten Sie Ihren Einkauf abschließen?
      {{cartLink}}
      
      Mit freundlichen Grüßen,
      Ihr Team
    `
  }
};
