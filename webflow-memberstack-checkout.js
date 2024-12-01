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

    // Wait for Memberstack to be ready
    await waitForMemberstack();
    console.log('Memberstack ready');

    // Initialize UI elements
    function initializeUI() {
        console.log('initializeUI called');
        
        // Get product type and base price
        const productElement = document.querySelector('[data-product-type]');
        console.log('Product element:', productElement);
        
        if (productElement) {
            state.productType = productElement.dataset.productType;
            state.basePrice = parseFloat(productElement.dataset.basePrice || '0');
            console.log('Product type:', state.productType);
            console.log('Base price:', state.basePrice);
        }

        // Set up country selector
        const countrySelect = document.getElementById('shipping-country');
        console.log('Setting up country selector:', countrySelect);
        
        if (countrySelect) {
            console.log('Found country select element');
            populateCountryDropdown(countrySelect);
            countrySelect.addEventListener('change', (e) => {
                state.country = e.target.value;
                updatePricing();
            });
        } else {
            console.error('Country select element not found');
        }

        // Set up quantity selector for standalone book
        const quantitySelect = document.getElementById('book-quantity');
        console.log('Setting up quantity selector:', quantitySelect);
        
        if (quantitySelect && state.productType === 'book') {
            quantitySelect.addEventListener('change', (e) => {
                state.quantity = parseInt(e.target.value);
                updatePricing();
            });
        }

        // Hide quantity selector for bundle
        if (state.productType === 'bundle' && quantitySelect) {
            quantitySelect.style.display = 'none';
        }

        // Show/hide shipping section based on product type
        const shippingSection = document.querySelector('.shipping-section');
        console.log('Setting up shipping section:', shippingSection);
        
        if (shippingSection) {
            shippingSection.style.display = state.productType === 'course' ? 'none' : 'block';
        }
    }

    // Populate country dropdown
    function populateCountryDropdown(countrySelect) {
        console.log('Populating country dropdown');
        
        // Clear existing options
        countrySelect.innerHTML = '<option value="">Select Country</option>';

        try {
            // Add Austria first
            const atOption = document.createElement('option');
            atOption.value = 'AT';
            atOption.textContent = SHIPPING_RATES.AT.label;
            countrySelect.appendChild(atOption);
            console.log('Added AT option');

            // Add Germany second
            const deOption = document.createElement('option');
            deOption.value = 'DE';
            deOption.textContent = SHIPPING_RATES.DE.label;
            countrySelect.appendChild(deOption);
            console.log('Added DE option');

            // Add other EU countries
            const euOptgroup = document.createElement('optgroup');
            euOptgroup.label = 'Other EU Countries';
            EU_COUNTRIES.forEach(country => {
                if (country !== 'AT' && country !== 'DE') {
                    const option = document.createElement('option');
                    option.value = country;
                    option.textContent = `${country} (€${SHIPPING_RATES.EU.price})`;
                    euOptgroup.appendChild(option);
                }
            });
            countrySelect.appendChild(euOptgroup);
            console.log('Added EU countries');

            // Add International option
            const intOption = document.createElement('option');
            intOption.value = 'INT';
            intOption.textContent = SHIPPING_RATES.INT.label;
            countrySelect.appendChild(intOption);
            console.log('Added INT option');

        } catch (error) {
            console.error('Error populating dropdown:', error);
        }
    }

    // Calculate shipping cost
    function calculateShipping(country, quantity) {
        console.log('Calculating shipping cost');
        
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
        console.log('Updating pricing');
        
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

        // Update Memberstack checkout button metadata
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

    // Handle checkout button click
    async function handleCheckout(e) {
        console.log('Handling checkout');
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
                const orderId = `order_${Date.now()}`;
                const metadata = {
                    shipping_country: state.country,
                    shipping_cost: state.shippingCost,
                    quantity: state.quantity,
                    product_type: state.productType,
                    requires_shipping: state.productType !== 'course',
                    order_id: orderId,
                    total_amount: (state.basePrice * state.quantity) + state.shippingCost
                };

                console.log('Checkout metadata:', metadata);

                try {
                    // Open Memberstack checkout
                    const result = await window.memberstackDom.openModal({
                        type: "CHECKOUT",
                        priceId: priceId,
                        metadata: metadata,
                        quantity: state.quantity,
                        successUrl: window.location.origin + "/order-confirmation?order_id=" + orderId,
                        cancelUrl: window.location.href
                    });
                    
                    console.log('Checkout result:', result);

                    if (result.success && metadata.requires_shipping) {
                        try {
                            // Process shipping charge
                            const response = await fetch('/.netlify/functions/process-shipping', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    orderId: metadata.order_id,
                                    shippingCost: metadata.shipping_cost,
                                    country: metadata.shipping_country,
                                    customerId: result.data.customerId,
                                    paymentIntentId: result.data.paymentIntentId,
                                    totalAmount: metadata.total_amount
                                })
                            });

                            if (!response.ok) {
                                throw new Error('Shipping processing failed');
                            }

                            const shippingResult = await response.json();
                            console.log('Shipping processed:', shippingResult);

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

    // Wait for Memberstack function
    function waitForMemberstack() {
        console.log('Waiting for Memberstack');
        
        return new Promise((resolve) => {
            if (window.memberstackDom) {
                resolve(window.memberstackDom);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                if (window.memberstackDom) {
                    obs.disconnect();
                    resolve(window.memberstackDom);
                }
            });

            observer.observe(document, {
                childList: true,
                subtree: true
            });
        });
    }

    // Initialize
    initializeUI();

    // Add checkout button listener
    const checkoutButtons = document.querySelectorAll('[data-ms-price\\:add]');
    console.log('Adding checkout button listeners');
    
    checkoutButtons.forEach(button => {
        button.addEventListener('click', handleCheckout);
    });

    // Initial pricing update
    updatePricing();
});
