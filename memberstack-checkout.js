// Memberstack 2.0 Checkout Handler
document.addEventListener('DOMContentLoaded', async () => {
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

    // Get Memberstack instance
    const memberstack = window.$memberstackDom;
    if (!memberstack) {
        console.error('Memberstack not found');
        return;
    }

    let state = {
        productType: '',
        quantity: 1,
        country: '',
        basePrice: 0,
        shippingCost: 0
    };

    // Populate country dropdown with shipping options
    function populateCountryDropdown() {
        const countrySelect = document.getElementById('shipping-country');
        if (!countrySelect) return;

        // Clear existing options
        countrySelect.innerHTML = '';

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Country';
        countrySelect.appendChild(defaultOption);

        // Add Austria as first option
        const atOption = document.createElement('option');
        atOption.value = 'AT';
        atOption.textContent = SHIPPING_RATES.AT.label;
        countrySelect.appendChild(atOption);

        // Add Germany as second option
        const deOption = document.createElement('option');
        deOption.value = 'DE';
        deOption.textContent = SHIPPING_RATES.DE.label;
        countrySelect.appendChild(deOption);

        // Add other EU countries
        EU_COUNTRIES.forEach(country => {
            if (country !== 'AT' && country !== 'DE') {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = `${country} (€${SHIPPING_RATES.EU.price})`;
                countrySelect.appendChild(option);
            }
        });

        // Add International option at the end
        const intOption = document.createElement('option');
        intOption.value = 'INT';
        intOption.textContent = SHIPPING_RATES.INT.label;
        countrySelect.appendChild(intOption);
    }

    // Initialize UI elements
    function initializeUI() {
        const productElement = document.querySelector('[data-product-type]');
        if (productElement) {
            state.productType = productElement.dataset.productType;
            state.basePrice = parseFloat(productElement.dataset.basePrice || '0');
        }

        // Set up quantity selector for standalone book
        const quantitySelect = document.getElementById('book-quantity');
        if (quantitySelect && state.productType === 'book') {
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

        // Hide quantity selector for bundle
        if (state.productType === 'bundle' && quantitySelect) {
            quantitySelect.style.display = 'none';
        }

        // Show/hide shipping section based on product type
        const shippingSection = document.querySelector('.shipping-section');
        if (shippingSection) {
            shippingSection.style.display = state.productType === 'course' ? 'none' : 'block';
        }

        // Populate country dropdown
        populateCountryDropdown();
    }

    // Calculate shipping based on country and quantity
    function calculateShipping(country, quantity) {
        if (!country || state.productType === 'course') return 0;
        
        let rate = SHIPPING_RATES.INT.price; // Default to international
        
        if (country === 'AT') {
            rate = SHIPPING_RATES.AT.price;
        } else if (country === 'DE') {
            rate = SHIPPING_RATES.DE.price;
        } else if (EU_COUNTRIES.includes(country)) {
            rate = SHIPPING_RATES.EU.price;
        }

        // Bundle always has quantity of 1
        if (state.productType === 'bundle') {
            return rate;
        }

        return rate * quantity;
    }

    // Update pricing displays
    async function updatePricing() {
        const shippingCost = calculateShipping(state.country, state.quantity);
        state.shippingCost = shippingCost;
        const subtotal = state.basePrice * state.quantity;
        const totalPrice = subtotal + shippingCost;

        // Update display elements
        const subtotalDisplay = document.getElementById('subtotal-price');
        const shippingDisplay = document.getElementById('shipping-cost');
        const totalDisplay = document.getElementById('total-price');
        
        if (subtotalDisplay) {
            subtotalDisplay.textContent = `€${subtotal.toFixed(2)}`;
        }
        if (shippingDisplay) {
            shippingDisplay.textContent = `€${shippingCost.toFixed(2)}`;
        }
        if (totalDisplay) {
            totalDisplay.textContent = `€${totalPrice.toFixed(2)}`;
        }

        // Store the updated state in data attributes for the checkout button
        const checkoutButton = document.querySelector('[data-ms-price\\:add]');
        if (checkoutButton) {
            const metadata = {
                shipping_country: state.country,
                shipping_cost: shippingCost,
                quantity: state.quantity,
                product_type: state.productType,
                requires_shipping: state.productType !== 'course',
                order_id: `order_${Date.now()}` // Add unique order ID
            };
            
            checkoutButton.dataset.msMetadata = JSON.stringify(metadata);
        }
    }

    // Handle checkout button click
    async function handleCheckout(e) {
        const button = e.currentTarget;
        
        if (!state.country && state.productType !== 'course') {
            alert('Please select a shipping country');
            e.preventDefault();
            return;
        }

        try {
            if (state.productType !== 'course') {
                e.preventDefault();
                
                const priceId = button.dataset.msPriceAdd;
                const metadata = JSON.parse(button.dataset.msMetadata || '{}');
                
                // Create the checkout configuration for Memberstack 2.0
                const checkoutConfig = {
                    mode: "payment",
                    priceId: priceId,
                    metadata: metadata
                };

                if (state.productType === 'book' && state.quantity > 1) {
                    checkoutConfig.quantity = state.quantity;
                }

                try {
                    const checkout = await memberstack.openCheckout(checkoutConfig);
                    
                    // After successful checkout, trigger shipping charge via Netlify function
                    if (checkout.success && metadata.requires_shipping) {
                        try {
                            const response = await fetch('/.netlify/functions/process-shipping', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    orderId: metadata.order_id,
                                    shippingCost: metadata.shipping_cost,
                                    country: metadata.shipping_country,
                                    customerId: checkout.customer.id,
                                    paymentIntentId: checkout.paymentIntent.id
                                })
                            });

                            if (!response.ok) {
                                throw new Error('Shipping processing failed');
                            }
                        } catch (error) {
                            console.error('Error processing shipping:', error);
                            alert('Your order was successful, but there was an issue processing shipping. Our team will contact you.');
                        }
                    }
                } catch (error) {
                    console.error('Checkout error:', error);
                    alert('There was an error processing your checkout. Please try again.');
                }
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    // Initialize
    initializeUI();

    // Add checkout button listener
    const checkoutButtons = document.querySelectorAll('[data-ms-price\\:add]');
    checkoutButtons.forEach(button => {
        button.addEventListener('click', handleCheckout);
    });

    // Initial pricing update
    updatePricing();
});
