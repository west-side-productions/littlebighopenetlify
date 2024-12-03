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
  },
  welcome: {
    subject: 'Willkommen bei Little Big Hope!',
    html: ({ firstName }) => `
      <h1>Willkommen ${firstName}!</h1>
      <p>Vielen Dank, dass Sie sich bei Little Big Hope angemeldet haben. Wir freuen uns, Sie in unserer Community begrüßen zu dürfen.</p>
      <p>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>
      <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
    `
  },
  email_verification: {
    subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
    html: ({ firstName, verificationLink }) => `
      <h1>Hallo ${firstName},</h1>
      <p>Bitte bestätigen Sie Ihre E-Mail-Adresse durch Klicken auf den folgenden Link:</p>
      <p><a href="${verificationLink}">E-Mail-Adresse bestätigen</a></p>
      <p>Falls Sie diese Verifizierung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
      <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
    `
  },
  email_verified: {
    subject: 'E-Mail-Adresse erfolgreich bestätigt',
    html: ({ firstName }) => `
      <h1>Hallo ${firstName},</h1>
      <p>Ihre E-Mail-Adresse wurde erfolgreich bestätigt!</p>
      <p>Sie haben nun vollen Zugriff auf Ihr Little Big Hope Konto.</p>
      <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
    `
  },
  password_reset: {
    subject: 'Passwort zurücksetzen',
    html: ({ firstName, resetLink }) => `
      <h1>Hallo ${firstName},</h1>
      <p>Wir haben eine Anfrage erhalten, Ihr Passwort zurückzusetzen.</p>
      <p>Klicken Sie auf den folgenden Link, um ein neues Passwort festzulegen:</p>
      <p><a href="${resetLink}">Passwort zurücksetzen</a></p>
      <p>Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
      <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
    `
  },
  password_changed: {
    subject: 'Passwort erfolgreich geändert',
    html: ({ firstName }) => `
      <h1>Hallo ${firstName},</h1>
      <p>Ihr Passwort wurde erfolgreich geändert.</p>
      <p>Falls Sie diese Änderung nicht vorgenommen haben, kontaktieren Sie uns bitte umgehend.</p>
      <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
    `
  },
  purchase_confirmation: {
    subject: 'Vielen Dank für Ihren Einkauf!',
    html: ({ firstName, purchaseId }) => `
      <h1>Vielen Dank für Ihren Einkauf, ${firstName}!</h1>
      <p>Wir haben Ihre Bestellung (ID: ${purchaseId}) erhalten und bearbeiten sie jetzt.</p>
      <p>Sie erhalten eine weitere E-Mail mit Ihren Bestelldetails und der Sendungsverfolgung, sobald Ihre Bestellung versendet wurde.</p>
      <p>Beste Grüße,<br>Ihr Little Big Hope Team</p>
    `
  }
};
