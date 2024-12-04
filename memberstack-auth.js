// Memberstack authentication and email handling
let currentUserLanguage = 'en'; // Default language

// Initialize Memberstack
const initializeMemberstack = async () => {
    try {
        // Wait for Memberstack to be ready
        await new Promise((resolve) => {
            if (window.memberstack) {
                resolve();
            } else {
                document.addEventListener('memberstack:ready', () => {
                    resolve();
                });
            }
        });

        // Initialize with new Memberstack 2.0 syntax
        const member = await window.memberstack.getCurrentMember();
        
        if (member) {
            // Set language based on user's profile or browser
            currentUserLanguage = member.customFields?.language || 
                                navigator.language.substring(0,2) || 
                                'en';
        }

        return window.memberstack;
    } catch (error) {
        console.error('Error initializing Memberstack:', error);
        throw error;
    }
};

// Send custom email using our multi-language system
const sendCustomEmail = async (to, templateName, variables) => {
    try {
        console.log('Sending email:', { templateName, language: currentUserLanguage });
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
            const error = await response.json();
            throw new Error(error.message || 'Failed to send email');
        }

        return await response.json();
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

// Handle Memberstack events
const setupMemberstackHandlers = (memberstack) => {
    // Update language when member signs in
    document.addEventListener('memberstack:member:signedIn', async () => {
        const member = await memberstack.getCurrentMember();
        if (member) {
            currentUserLanguage = member.customFields?.language || 'en';
        }
    });

    // Member signup/creation
    document.addEventListener('memberstack:member:created', async (event) => {
        const { email, firstName } = event.detail.member;
        console.log('Member created:', email);
        try {
            await sendCustomEmail(email, 'welcome', {
                firstName: firstName || 'User'
            });
        } catch (error) {
            console.error('Failed to send welcome email:', error);
        }
    });

    // Email verification
    document.addEventListener('memberstack:member:verification:needed', async (event) => {
        const { email, firstName, verificationToken } = event.detail;
        console.log('Verification needed:', email);
        try {
            await sendCustomEmail(email, 'verification', {
                firstName: firstName || 'User',
                verificationLink: `${window.location.origin}/verify?token=${verificationToken}`
            });
        } catch (error) {
            console.error('Failed to send verification email:', error);
        }
    });

    // Password reset
    document.addEventListener('memberstack:member:password:reset', async (event) => {
        const { email, firstName, resetToken } = event.detail;
        console.log('Password reset requested:', email);
        try {
            await sendCustomEmail(email, 'passwordReset', {
                firstName: firstName || 'User',
                resetLink: `${window.location.origin}/reset-password?token=${resetToken}`
            });
        } catch (error) {
            console.error('Failed to send password reset email:', error);
        }
    });

    // Abandoned cart (custom implementation)
    let cartCheckInterval;
    const checkForAbandonedCart = async () => {
        const member = await memberstack.getCurrentMember();
        if (member) {
            const cart = localStorage.getItem('cart');
            if (cart && JSON.parse(cart).length > 0) {
                try {
                    await sendCustomEmail(member.email, 'abandonedCart', {
                        firstName: member.firstName || 'User',
                        cartLink: `${window.location.origin}/cart`,
                        language: member.customFields?.language || currentUserLanguage
                    });
                } catch (error) {
                    console.error('Failed to send abandoned cart email:', error);
                }
            }
        }
    };

    // Check for abandoned cart after 24 hours
    document.addEventListener('memberstack:member:signedIn', () => {
        if (cartCheckInterval) clearInterval(cartCheckInterval);
        cartCheckInterval = setInterval(checkForAbandonedCart, 24 * 60 * 60 * 1000);
    });

    document.addEventListener('memberstack:member:signedOut', () => {
        if (cartCheckInterval) clearInterval(cartCheckInterval);
    });
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing Memberstack...');
        const memberstack = await initializeMemberstack();
        setupMemberstackHandlers(memberstack);
        console.log('Memberstack handlers set up successfully');
    } catch (error) {
        console.error('Error setting up Memberstack handlers:', error);
    }
});
