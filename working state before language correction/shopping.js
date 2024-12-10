 // Shopping List Code for Webflow
document.addEventListener("DOMContentLoaded", (async () => {
    // Make sure $lbh is available
    if (typeof $lbh === 'undefined') {
        console.error('$lbh utilities not found! Make sure utils.js is loaded in the global head.');
        return;
    }

    console.log("Setting up shopping list page");
    const btn = $lbh.find("#btnClear");
    
    // Force fresh data load and clear any cache
    const loadShoppingList = async () => {
        let json = await $lbh.loadJson();
        console.log("Loaded shopping list data:", json);
        return json.shoppingList || [];
    };

    let shoppingList = await loadShoppingList();
    console.log("Initial shopping list:", shoppingList);

    if (!shoppingList || shoppingList.length === 0) {
        console.log("Keine Einträge");
        return;
    }

    console.log("Full shopping list data:", JSON.stringify(shoppingList, null, 2));

    const container = $lbh.find("#list");
    if (!container) {
        console.error("Could not find #list container!");
        return;
    }

    const template = $lbh.find("#receipe");
    if (!template) {
        console.error("Could not find #receipe template!");
        return;
    }

    let allIngredients = {};

    // Function to display a recipe
    const displayRecipe = (recipe) => {
        let receipe = template.content.cloneNode(true);
        const accordionButton = receipe.querySelector(".accordion");
        accordionButton.innerText = recipe.title;

        const deleteButton = document.createElement("button");
        deleteButton.innerText = "×";
        deleteButton.classList.add("delete-btn");
        deleteButton.addEventListener("click", async () => {
            container.removeChild(receipe);
            // Remove ingredients from the summed list
            if (recipe.ingredients) {
                recipe.ingredients.forEach(ingredient => {
                    if (allIngredients[ingredient.s]) {
                        allIngredients[ingredient.s].quantity -= ingredient.q;
                        if (allIngredients[ingredient.s].quantity <= 0) {
                            delete allIngredients[ingredient.s];
                        }
                    }
                });
            }
            // Remove seasoning from the summed list
            if (recipe.seasoning) {
                recipe.seasoning.forEach(ingredient => {
                    if (allIngredients[ingredient.s]) {
                        allIngredients[ingredient.s].quantity -= ingredient.q;
                        if (allIngredients[ingredient.s].quantity <= 0) {
                            delete allIngredients[ingredient.s];
                        }
                    }
                });
            }
            updateIngredientList();

            // Update storage after removal
            let json = await $lbh.loadJson();
            json.shoppingList = json.shoppingList.filter(item => item.title !== recipe.title);
            await $lbh.updateJson(json);
        });
        accordionButton.appendChild(deleteButton);

        accordionButton.addEventListener("click", function () {
            this.classList.toggle("active");
            const panel = this.nextElementSibling;
            if (panel) {
                panel.style.display = panel.style.display === "block" ? "none" : "block";
            }
        });

        const ulItems = receipe.querySelector("#ulItems");
        if (!ulItems) {
            console.error("Could not find #ulItems in template for recipe:", recipe.title);
            return;
        }

        // Add recipe ingredients
        if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
            recipe.ingredients.forEach((ingredient) => {
                const li = document.createElement("li");
                li.innerText = `${$lbh.formatQuantity(ingredient.q)} ${ingredient.s}`;
                ulItems.appendChild(li);

                // Add to total ingredients
                if (allIngredients[ingredient.s]) {
                    allIngredients[ingredient.s].quantity += ingredient.q;
                } else {
                    allIngredients[ingredient.s] = {
                        quantity: ingredient.q,
                        name: ingredient.s
                    };
                }
            });
        }

        // Add seasoning ingredients with header
        if (recipe.seasoning && Array.isArray(recipe.seasoning)) {
            console.log("Adding seasonings for recipe:", recipe.title);
            console.log("Seasonings:", JSON.stringify(recipe.seasoning, null, 2));
            
            if (recipe.seasoning.length > 0) {
                const seasoningHeader = document.createElement("li");
                seasoningHeader.innerHTML = "<strong>Gewürze:</strong>";
                seasoningHeader.style.marginTop = "10px";
                ulItems.appendChild(seasoningHeader);

                recipe.seasoning.forEach((ingredient) => {
                    console.log("Adding seasoning:", ingredient);
                    const li = document.createElement("li");
                    li.innerText = ingredient.s;
                    li.style.paddingLeft = "20px";
                    ulItems.appendChild(li);

                    // Add to total ingredients
                    const key = `${ingredient.s} (Gewürz)`;
                    if (allIngredients[key]) {
                        allIngredients[key].quantity += ingredient.q;
                    } else {
                        allIngredients[key] = {
                            quantity: ingredient.q,
                            name: key
                        };
                    }
                });
            }
        }

        container.appendChild(receipe);
    };

    // Create accordion items for each recipe
    shoppingList.forEach((recipe) => {
        console.log("Processing recipe:", recipe.title);
        displayRecipe(recipe);
    });

    // Function to update the all ingredients list
    const updateIngredientList = () => {
        const ingredientList = $lbh.find("#allIngredients");
        if (!ingredientList) {
            console.error("Could not find #allIngredients container!");
            return;
        }

        ingredientList.innerHTML = ""; // Clear existing list
        console.log("All ingredients before rendering:", allIngredients);
        
        // Sort ingredients: regular ingredients first, then seasonings
        const sortedIngredients = Object.entries(allIngredients)
            .sort(([keyA], [keyB]) => {
                const isSeasoningA = keyA.includes("(Gewürz)");
                const isSeasoningB = keyB.includes("(Gewürz)");
                if (isSeasoningA === isSeasoningB) return keyA.localeCompare(keyB);
                return isSeasoningA ? 1 : -1;
            });

        let currentSection = null;
        sortedIngredients.forEach(([key, {name, quantity}]) => {
            const isSeasoning = key.includes("(Gewürz)");
            
            // Add section header if needed
            if (isSeasoning && currentSection !== "seasoning") {
                currentSection = "seasoning";
                const header = document.createElement("li");
                header.innerHTML = "<strong>Gewürze:</strong>";
                header.style.marginTop = "15px";
                header.style.marginBottom = "5px";
                ingredientList.appendChild(header);
            }

            const li = document.createElement("li");
            li.innerText = isSeasoning ? name.replace(" (Gewürz)", "") : `${$lbh.formatQuantity(quantity)} ${name}`;
            if (isSeasoning) {
                li.style.paddingLeft = "20px";
            }
            
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.addEventListener("change", (e) => {
                li.classList.toggle("crossed", e.target.checked);
            });
            li.prepend(checkbox);
            ingredientList.appendChild(li);
        });
    };

    updateIngredientList();

    // Event listener for the clear button
    if (btn) {
        btn.addEventListener("click", async () => {
            btn.disabled = true;
            btn.classList.add("btn-saving");
            let json = await $lbh.loadJson();
            delete json.shoppingList;
            await $lbh.updateJson(json);
            btn.classList.remove("btn-saving");
            btn.classList.add("btn-saved");
            container.innerHTML = ""; // Clear the accordion container
            const ingredientList = document.getElementById('ingredientList');
            if (ingredientList) {
                ingredientList.innerHTML = ""; // Clear the ingredient list
            }
        });
    }
}));