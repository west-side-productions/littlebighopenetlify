"use strict";

document.addEventListener("DOMContentLoaded", (async () => {
    console.log("Setting up recipe page");
    const h1 = $lbh.find("#hTitle");
    const ingredientsDiv = $lbh.find("#rtIngredients");
    const selPersons = $lbh.find("#selPersons");
    const btnAddList = $lbh.find("#btnAddList");
    
    let perPerson = {
        title: h1.innerText,
        ingredients: [],
        seasoning: []
    };

    // Parse all ingredient lists
    let allUls = ingredientsDiv.querySelectorAll("ul");
    allUls.forEach(ul => {
        let lis = ul.querySelectorAll("li");
        lis.forEach((li => {
            const re = /(\d+[,.]?\d*)?([¼½])?(.+)/;
            const res = re.exec(li.innerText);
            const obj = {};
            let nr = res[1];
            if (nr) {
                nr = nr.replaceAll(",", ".");
            }
            let fract = res[2];
            const str = res[3].replaceAll(" ", " ");
            if (nr) {
                nr = Number(nr);
            }
            if (fract) {
                fract = fract == "½" ? .5 : .25;
            }
            obj["s"] = str;
            if (nr && fract) {
                obj["q"] = (nr + fract) / 2;
            } else if (nr) {
                obj["q"] = nr / 2;
            } else if (fract) {
                obj["q"] = fract / 2;
            }
            perPerson.ingredients.push(obj);
        }));
    });

    // Add seasoning items
    const seasoningDiv = document.getElementById('seasoning');
    if (seasoningDiv) {
        const seasoningUl = seasoningDiv.querySelector('ul');
        if (seasoningUl) {
            seasoningUl.querySelectorAll('li').forEach(li => {
                perPerson.seasoning.push({
                    q: 1,
                    s: li.textContent.trim()
                });
            });
        }
    }

    console.log("perPerson", perPerson);

    async function saveShoppingList(recipe) {
        try {
            console.log("Saving recipe:", recipe);
            const json = await $lbh.loadJson();
            if (!json) {
                json = {};
            }
            if (!json.shoppingList) {
                json.shoppingList = [];
            }
            json.shoppingList.push(recipe);
            await $lbh.updateJson(json);
            console.log("Successfully saved recipe");
            
            // Redirect to shopping list with cache busting
            const timestamp = Date.now();
            window.location.href = '/einkaufsliste?t=' + timestamp;
        } catch (error) {
            console.error("Error saving recipe:", error);
            alert("Fehler beim Speichern des Rezepts. Bitte versuchen Sie es erneut.");
        }
    }

    selPersons.addEventListener("change", (e => {
        const personen = Number(e.srcElement.value);
        // Clear all ul elements
        allUls.forEach(ul => {
            ul.innerHTML = "";
        });
        
        // Update quantities in all lists
        perPerson.ingredients.forEach((i => {
            const li = document.createElement("li");
            li.innerText = `${$lbh.formatQuantity(i.q * personen)}${i.s}`;
            // Add to the first ul
            allUls[0].appendChild(li);
        }));
    }));

    btnAddList.addEventListener("click", (async e => {
        let btn = e.srcElement;
        btn.disabled = true;
        btn.classList.add("btn-saving");
        let item = {
            title: perPerson.title,
            ingredients: perPerson.ingredients.map((i => ({
                s: i.s,
                q: i.q * Number(selPersons.value)
            }))),
            seasoning: perPerson.seasoning
        };
        console.log("adding to list", item);
        await saveShoppingList(item);
        btn.classList.remove("btn-saving");
        btn.classList.add("btn-saved");
    }));
}));
