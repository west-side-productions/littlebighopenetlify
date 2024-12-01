"use strict";

document.addEventListener("DOMContentLoaded", (async () => {
    console.log("Setting up shopping list page");
    const btn = $lbh.find("#btnClear");
    let json = await $lbh.loadJson();
    let shoppingList = json.shoppingList;

    if (!shoppingList) {
        console.log("Keine Einträge");
        return;
    }

    const container = $lbh.find("#list");
    const template = $lbh.find("#receipe");
    let allIngredients = {};

    // Create accordion items for each recipe
    shoppingList.forEach((recipe) => {
        let receipe = template.content.cloneNode(true);
        const accordionButton = receipe.querySelector(".accordion");
        accordionButton.innerText = recipe.title;

        const deleteButton = document.createElement("button");
        deleteButton.innerText = "×";
        deleteButton.classList.add("delete-btn");
        deleteButton.addEventListener("click", () => {
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
        });
        accordionButton.appendChild(deleteButton);

        accordionButton.addEventListener("click", function () {
            this.classList.toggle("active");
            const panel = this.nextElementSibling;
            panel.style.display = panel.style.display === "block" ? "none" : "block";
        });

        const ulItems = receipe.querySelector("#ulItems");

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

        // Add seasoning ingredients
        if (recipe.seasoning && Array.isArray(recipe.seasoning)) {
            const seasoningHeader = document.createElement("li");
            seasoningHeader.innerHTML = "<strong>Gewürze:</strong>";
            ulItems.appendChild(seasoningHeader);

            recipe.seasoning.forEach((ingredient) => {
                const li = document.createElement("li");
                li.innerText = ingredient.s;
                li.style.paddingLeft = "20px";
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

        container.appendChild(receipe);
    });

    // Function to update the all ingredients list
    const updateIngredientList = () => {
        const ingredientList = $lbh.find("#allIngredients");
        ingredientList.innerHTML = ""; // Clear existing list
        Object.values(allIngredients).forEach(({ name, quantity }) => {
            const li = document.createElement("li");
            li.innerText = `${$lbh.formatQuantity(quantity)} ${name}`;
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
    btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.classList.add("btn-saving");
        let json = await $lbh.loadJson();
        delete json.shoppingList;
        await $lbh.updateJson(json);
        btn.classList.remove("btn-saving");
        btn.classList.add("btn-saved");
        container.innerHTML = ""; // Clear the accordion container
        document.getElementById('ingredientList').innerHTML = ""; // Clear the ingredient list
    });
}));
