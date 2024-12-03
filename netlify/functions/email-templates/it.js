module.exports = {
  verification: {
    subject: 'Verifica il tuo indirizzo email',
    body: `
      Ciao {{firstName}},
      
      Per favore verifica il tuo indirizzo email cliccando sul link qui sotto:
      {{verificationLink}}
      
      Se non hai richiesto questa verifica, puoi ignorare questa email.
      
      Cordiali saluti,
      Il tuo team
    `
  },
  passwordReset: {
    subject: 'Reimposta la tua password',
    body: `
      Ciao {{firstName}},
      
      Hai richiesto di reimpostare la tua password. Clicca sul link qui sotto:
      {{resetLink}}
      
      Se non hai fatto questa richiesta, puoi ignorare questa email.
      
      Cordiali saluti,
      Il tuo team
    `
  },
  welcome: {
    subject: 'Benvenuto!',
    body: `
      Ciao {{firstName}},
      
      Benvenuto! Siamo felici di averti con noi.
      
      Cordiali saluti,
      Il tuo team
    `
  },
  abandonedCart: {
    subject: 'Il tuo carrello ti sta aspettando',
    body: `
      Ciao {{firstName}},
      
      Hai ancora degli articoli nel tuo carrello. Vuoi completare il tuo acquisto?
      {{cartLink}}
      
      Cordiali saluti,
      Il tuo team
    `
  }
};
