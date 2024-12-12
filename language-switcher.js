// Language switcher implementation
document.addEventListener('DOMContentLoaded', () => {
    // Find the language dropdown list
    const localesList = document.querySelector('.w-locales-list');
    if (!localesList) return;

    // Add click event listener to each language option
    const localeItems = localesList.querySelectorAll('.w-locales-item a');
    localeItems.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const newLang = link.getAttribute('hreflang');
            
            try {
                // Update Memberstack if user is logged in
                if (window.$memberstackDom) {
                    const member = await window.$memberstackDom.getCurrentMember();
                    if (member) {
                        await window.$memberstackDom.updateMember({
                            customFields: {
                                language: newLang
                            }
                        }, {
                            skipWebhook: true // Skip webhook to avoid welcome email
                        });
                        console.log('Updated language preference in Memberstack:', newLang);
                    }
                }

                // Get the target URL from the link
                const targetUrl = link.getAttribute('href');
                
                // Redirect to the new language URL
                window.location.href = targetUrl;
            } catch (error) {
                console.error('Error updating language:', error);
                // Still redirect even if Memberstack update fails
                window.location.href = link.getAttribute('href');
            }
        });
    });
});
