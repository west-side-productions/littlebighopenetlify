// Unified Shipping Calculator and Checkout for Webflow + Memberstack 2.0
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Checkout script loaded');
    
    // Configuration
    const SHIPPING_RATES = {
        AT: { price: 5, label: "Austria (€5)" },
        DE: { price: 10, label: "Germany (€10)" },
        EU: { price: 10, label: "Europe (€10)" },
        INT: { price: 15, label: "International (€15)" }
    };

    const EU_COUNTRIES = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];

    let state = {
        productType: '',
        quantity: 1,
        country: '',
        basePrice: 0,
        shippingCost: 0
    };

    // Wait for Memberstack 2.0
    function waitForMemberstack() {
        return new Promise((resolve) => {
            if (window.$memberstackDom) {
                resolve(window.$memberstackDom);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                if (window.$memberstackDom) {
                    obs.disconnect();
                    resolve(window.$memberstackDom);
                }
            });

            observer.observe(document, {
                childList: true,
                subtree: true
            });
        });
    }

    // Populate country dropdown
    function populateCountryDropdown() {
        console.log('Populating country dropdown');
        const countrySelect = document.getElementById('shipping-country');
        
        if (!countrySelect) {
            console.error('Country select element not found!');
            return;
        }

        // Clear existing options
        countrySelect.innerHTML = '';

        // Add default option
        countrySelect.appendChild(new Option('Select Country', ''));

        // Add Austria and Germany first
        countrySelect.appendChild(new Option(SHIPPING_RATES.AT.label, 'AT'));
        countrySelect.appendChild(new Option(SHIPPING_RATES.DE.label, 'DE'));

        // Add other EU countries
        EU_COUNTRIES.forEach(country => {
            if (country !== 'AT' && country !== 'DE') {
                countrySelect.appendChild(new Option(`${country} (€${SHIPPING_RATES.EU.price})`, country));
            }
        });

        // Add International option
        countrySelect.appendChild(new Option(SHIPPING_RATES.INT.label, 'INT'));
    }

    // Calculate shipping cost
    function calculateShipping(country, quantity) {
        if (!country || state.productType === 'course') return 0;
        
        let rate = SHIPPING_RATES.INT.price;
        
        if (country === 'AT') {
            rate = SHIPPING_RATES.AT.price;
        } else if (country === 'DE') {
            rate = SHIPPING_RATES.DE.price;
        } else if (EU_COUNTRIES.includes(country)) {
            rate = SHIPPING_RATES.EU.price;
        }

        return rate * quantity;
    }

    // Update pricing displays
    function updatePricing() {
        const shippingCost = calculateShipping(state.country, state.quantity);
        state.shippingCost = shippingCost;
        const subtotal = state.basePrice * state.quantity;
        const totalPrice = subtotal + shippingCost;

        // Update display elements
        const subtotalDisplay = document.getElementById('subtotal-price');
        const shippingDisplay = document.getElementById('shipping-cost');
        const totalDisplay = document.getElementById('total-price');
        
        if (subtotalDisplay) subtotalDisplay.textContent = subtotal.toFixed(2);
        if (shippingDisplay) shippingDisplay.textContent = shippingCost.toFixed(2);
        if (totalDisplay) totalDisplay.textContent = totalPrice.toFixed(2);

        // Update checkout button metadata
        const checkoutButton = document.querySelector('[data-ms-price\\:add]');
        if (checkoutButton) {
            const metadata = {
                shipping_country: state.country,
                shipping_cost: shippingCost,
                quantity: state.quantity,
                product_type: state.productType,
                requires_shipping: state.productType !== 'course',
                order_id: `order_${Date.now()}`
            };
            checkoutButton.dataset.msMetadata = JSON.stringify(metadata);
        }
    }

    // Handle checkout
    async function handleCheckout(e) {
        console.log('Checkout initiated');
        const button = e.currentTarget;
        
        try {
            if (state.productType !== 'course') {
                e.preventDefault();
                console.log('Processing physical product checkout');
                
                const priceId = button.dataset.msPriceAdd;
                console.log('Price ID:', priceId);
                
                const orderId = `order_${Date.now()}`;
                const baseAmount = state.basePrice * state.quantity;

                // First call the shipping function to get shipping rates
                try {
                    const shippingResponse = await fetch('/.netlify/functions/process-shipping', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            orderId: orderId,
                            baseAmount: baseAmount,
                            quantity: state.quantity,
                            action: 'get_rates'
                        })
                    });

                    if (!shippingResponse.ok) {
                        throw new Error(`Shipping function error: ${await shippingResponse.text()}`);
                    }

                    const shippingData = await shippingResponse.json();
                    console.log('Shipping rates received:', shippingData);

                    // Create metadata with all necessary information
                    const metadata = {
                        quantity: state.quantity,
                        product_type: state.productType,
                        requires_shipping: true,
                        order_id: orderId,
                        base_amount: baseAmount
                    };

                    console.log('Opening checkout with metadata:', metadata);

                    const memberstack = await waitForMemberstack();
                    const result = await memberstack.openModal("CHECKOUT", {
                        priceId: priceId,
                        metadata: metadata,
                        quantity: state.quantity,
                        successUrl: `${window.location.origin}/order-confirmation?order_id=${orderId}`,
                        cancelUrl: window.location.href,
                        mode: "payment",
                        allowPromotionCodes: true,
                        billingAddressCollection: 'required',
                        shippingAddressCollection: {
                            allowedCountries: ['AT', 'DE', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']
                        },
                        shippingRates: shippingData.shippingRates
                    });

                    console.log('Checkout result:', result);

                    if (result.success) {
                        console.log('Checkout successful, processing shipping...');
                        
                        // Update shipping with final details
                        const finalShippingResponse = await fetch('/.netlify/functions/process-shipping', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                orderId: orderId,
                                customerId: result.data.customerId,
                                paymentIntentId: result.data.paymentIntentId,
                                baseAmount: baseAmount,
                                action: 'process_payment'
                            })
                        });

                        if (!finalShippingResponse.ok) {
                            console.error('Error processing final shipping:', await finalShippingResponse.text());
                        } else {
                            const finalShippingResult = await finalShippingResponse.json();
                            console.log('Final shipping processed:', finalShippingResult);
                        }
                    }
                } catch (error) {
                    console.error('Error processing shipping:', error);
                    alert('There was an issue processing shipping. Please try again.');
                }
            }
        } catch (error) {
            console.error('Checkout error:', error);
        }
    }

    // Initialize UI
    function initializeUI() {
        // Get product information
        const productElement = document.querySelector('[data-product-type]');
        if (productElement) {
            state.productType = productElement.dataset.productType;
            state.basePrice = parseFloat(productElement.dataset.basePrice || '0');
        }

        // Set up quantity selector
        const quantitySelect = document.getElementById('book-quantity');
        if (quantitySelect) {
            quantitySelect.addEventListener('change', (e) => {
                state.quantity = parseInt(e.target.value);
                updatePricing();
            });
        }

        // Set up country selector
        const countrySelect = document.getElementById('shipping-country');
        if (countrySelect) {
            countrySelect.addEventListener('change', (e) => {
                state.country = e.target.value;
                updatePricing();
            });
        }

        // Show/hide shipping section
        const shippingSection = document.querySelector('.shipping-section');
        if (shippingSection) {
            shippingSection.style.display = state.productType === 'course' ? 'none' : 'block';
        }

        // Populate countries
        populateCountryDropdown();

        // Add checkout button listeners
        const checkoutButtons = document.querySelectorAll('[data-ms-price\\:add]');
        checkoutButtons.forEach(button => {
            button.addEventListener('click', handleCheckout);
        });

        // Initial pricing update
        updatePricing();
    }

    // Initialize when DOM and Memberstack are ready
    async function init() {
        try {
            await waitForMemberstack();
            console.log('Memberstack 2.0 loaded');
            initializeUI();
        } catch (error) {
            console.error('Error initializing:', error);
        }
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
});
