module.exports = {
    welcome: {
        subject: 'Benvenuto su Little Big Hope!',
        html: ({ firstName }) => `
            <h1>Benvenuto ${firstName}!</h1>
            <p>Grazie per esserti registrato su Little Big Hope. Siamo lieti di averti nella nostra community.</p>
            <p>Se hai domande, non esitare a contattarci.</p>
            <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
        `
    },

    email_verification: {
        subject: 'Verifica il tuo indirizzo email',
        html: ({ firstName, verificationLink }) => `
            <h1>Ciao ${firstName},</h1>
            <p>Per favore verifica il tuo indirizzo email cliccando sul link qui sotto:</p>
            <p><a href="${verificationLink}">Verifica indirizzo email</a></p>
            <p>Se non hai richiesto questa verifica, puoi ignorare questa email.</p>
            <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
        `
    },

    email_verified: {
        subject: 'Email verificata con successo',
        html: ({ firstName }) => `
            <h1>Ciao ${firstName},</h1>
            <p>Il tuo indirizzo email è stato verificato con successo!</p>
            <p>Ora hai accesso completo al tuo account Little Big Hope.</p>
            <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
        `
    },

    password_reset: {
        subject: 'Reimposta la tua password',
        html: ({ firstName, resetLink }) => `
            <h1>Ciao ${firstName},</h1>
            <p>Abbiamo ricevuto una richiesta di reimpostazione della password.</p>
            <p>Clicca sul link qui sotto per impostare una nuova password:</p>
            <p><a href="${resetLink}">Reimposta password</a></p>
            <p>Se non hai fatto questa richiesta, puoi ignorare questa email.</p>
            <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
        `
    },

    password_changed: {
        subject: 'Password modificata con successo',
        html: ({ firstName }) => `
            <h1>Ciao ${firstName},</h1>
            <p>La tua password è stata modificata con successo.</p>
            <p>Se non hai fatto questa modifica, contattaci immediatamente.</p>
            <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
        `
    },

    purchase_confirmation: {
        subject: 'Grazie per il tuo acquisto!',
        html: ({ firstName, purchaseId }) => `
            <h1>Grazie per il tuo acquisto, ${firstName}!</h1>
            <p>Abbiamo ricevuto il tuo ordine (ID: ${purchaseId}) e lo stiamo elaborando.</p>
            <p>Riceverai un'altra email con i dettagli dell'ordine e le informazioni di tracciamento una volta spedito.</p>
            <p>Cordiali saluti,<br>Il team di Little Big Hope</p>
        `
    }
};
