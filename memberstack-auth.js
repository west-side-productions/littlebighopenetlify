// Memberstack authentication and email handling
let currentUserLanguage = 'en'; // Default language

// Initialize Memberstack
const initializeMemberstack = async () => {
    try {
        const memberstack = await window.$memberstackDom.init({
            appId: "YOUR_MEMBERSTACK_APP_ID" // Replace with your Memberstack App ID
        });
        
        // Get current member if logged in
        const member = await memberstack.getCurrentMember();
        if (member) {
            // Set language based on user's profile or browser
            currentUserLanguage = member.customFields?.language || 
                                navigator.language.substring(0,2) || 
                                'en';
        }

        // Disable Memberstack's built-in emails
        memberstack.confirmEmailAddress = false;
        memberstack.resetPassword = false;
        memberstack.passwordlessLogin = false;
        memberstack.welcomeEmail = false;

        return memberstack;
    } catch (error) {
        console.error('Error initializing Memberstack:', error);
        throw error;
    }
};

// Send custom email using our multi-language system
const sendCustomEmail = async (to, templateName, variables) => {
    try {
        const response = await fetch('/.netlify/functions/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to,
                templateName,
                language: currentUserLanguage,
                variables
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send email');
        }

        return await response.json();
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

// Handle Memberstack events
const setupMemberstackHandlers = (memberstack) => {
    // Email verification
    memberstack.addEventListener("emailVerification:process", async (event) => {
        const { email, token, firstName } = event.data;
        await sendCustomEmail(email, 'verification', {
            firstName: firstName || 'User',
            verificationLink: `${window.location.origin}/verify?token=${token}`
        });
    });

    // Password reset
    memberstack.addEventListener("password:reset", async (event) => {
        const { email, token, firstName } = event.data;
        await sendCustomEmail(email, 'passwordReset', {
            firstName: firstName || 'User',
            resetLink: `${window.location.origin}/reset-password?token=${token}`
        });
    });

    // Welcome email
    memberstack.addEventListener("member:create", async (event) => {
        const { email, firstName } = event.data;
        await sendCustomEmail(email, 'welcome', {
            firstName: firstName || 'User'
        });
    });

    // Abandoned cart (custom implementation)
    const checkForAbandonedCart = async (member) => {
        const cart = await getCartItems(); // Implement this based on your cart system
        if (cart && cart.length > 0) {
            await sendCustomEmail(member.email, 'abandonedCart', {
                firstName: member.firstName || 'User',
                cartLink: `${window.location.origin}/cart`
            });
        }
    };
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const memberstack = await initializeMemberstack();
        setupMemberstackHandlers(memberstack);
    } catch (error) {
        console.error('Error setting up Memberstack handlers:', error);
    }
});
