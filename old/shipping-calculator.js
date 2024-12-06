// Shipping Calculator for Webflow + Memberstack + Stripe
document.addEventListener('DOMContentLoaded', async () => {
    // Shipping rates configuration
    const SHIPPING_RATES = {
        AT: 5,  // Austria
        EU: 10, // Europe
        INT: 15 // International
    };

    // EU countries for shipping calculation
    const EU_COUNTRIES = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];

    // Product configurations
    const PRODUCTS = {
        'course': { type: 'digital', price: null }, // Price will be set from Stripe
        'book': { type: 'physical', price: null },  // Price will be set from Stripe
        'bundle': { type: 'mixed', price: null }    // Price will be set from Stripe
    };

    let selectedCountry = '';
    let quantity = 1;
    let currentProduct = '';

    // Initialize elements
    function initializeElements() {
        // Country selector
        const countrySelect = document.getElementById('shipping-country');
        if (countrySelect) {
            countrySelect.addEventListener('change', updateShipping);
        }

        // Quantity selector (only for standalone book product)
        const quantitySelect = document.getElementById('book-quantity');
        if (quantitySelect) {
            quantitySelect.addEventListener('change', updateShipping);
            // Hide quantity selector for bundle product
            if (currentProduct === 'bundle') {
                quantitySelect.style.display = 'none';
            }
        }

        // Initialize product type
        const productElement = document.querySelector('[data-product-type]');
        if (productElement) {
            currentProduct = productElement.dataset.productType;
        }
    }

    // Calculate shipping cost
    function calculateShipping(country, quantity = 1) {
        if (!country) return 0;
        
        // Digital products have no shipping
        if (currentProduct === 'course') return 0;

        let rate = SHIPPING_RATES.INT; // Default to international
        
        if (country === 'AT') {
            rate = SHIPPING_RATES.AT;
        } else if (EU_COUNTRIES.includes(country)) {
            rate = SHIPPING_RATES.EU;
        }

        // For bundle, quantity is always 1
        if (currentProduct === 'bundle') {
            return rate;
        }

        return rate * quantity;
    }

    // Update shipping display and total
    async function updateShipping() {
        const countrySelect = document.getElementById('shipping-country');
        const quantitySelect = document.getElementById('book-quantity');
        const shippingDisplay = document.getElementById('shipping-cost');
        const totalDisplay = document.getElementById('total-price');

        if (!countrySelect || !shippingDisplay || !totalDisplay) return;

        selectedCountry = countrySelect.value;
        quantity = quantitySelect ? parseInt(quantitySelect.value) : 1;

        // Get base price from Stripe element
        const priceElement = document.querySelector('[data-stripe-price]');
        const basePrice = priceElement ? parseFloat(priceElement.dataset.stripePrice) : 0;

        const shippingCost = calculateShipping(selectedCountry, quantity);
        const total = (basePrice * quantity) + shippingCost;

        // Update displays
        shippingDisplay.textContent = `€${shippingCost.toFixed(2)}`;
        totalDisplay.textContent = `€${total.toFixed(2)}`;

        // Update hidden fields for Stripe
        const shippingField = document.querySelector('input[name="shipping_cost"]');
        const totalField = document.querySelector('input[name="total_amount"]');
        const quantityField = document.querySelector('input[name="quantity"]');

        if (shippingField) shippingField.value = shippingCost;
        if (totalField) totalField.value = total;
        if (quantityField) quantityField.value = quantity;
    }

    // Initialize
    initializeElements();
    updateShipping();
});
