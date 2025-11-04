"use strict"
let todoList = []; //declares a new array for Your todo list

window.onload = function() {
    // attach live filters
    const search = document.getElementById("inputSearch");
    const from = document.getElementById("inputDateFrom");
    const to = document.getElementById("inputDateTo");
    [search, from, to].forEach(el => {
        if (el) el.addEventListener("input", updateTodoList);
    });

    // basic live validation for title
    const inputTitle = document.getElementById("inputTitle");
    if (inputTitle) {
        const validationMsg = document.getElementById('titleValidation');

        inputTitle.addEventListener('input', () => {
            if (inputTitle.value && validationMsg) {
                validationMsg.classList.add('d-none');
                validationMsg.style.display = 'none';
            }
        });
    }

    loadBin();
    setTimeout(updateTodoList, 1000);
};

async function getCategoryFromGroq(title, description) {
    const GROQ_API_KEY ="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";

    const systemPrompt = `Jesteś ekspertem od kategoryzacji zadań. Twoim zadaniem jest przypisanie JEDNEGO słowa jako kategorii dla zadania na podstawie tytułu i opisu.

Użyj krótkich, trafnych kategorii, np. 'Uczelnia', 'Praca', 'Dom', 'Hobby', 'Zakupy', 'Prywatne', 'Sport'.

Zawsze odpowiedz tylko tym jednym słowem (kategorią), np. 'Uczelnia' lub 'Zakupy'.
Nie dodawaj żadnych wyjaśnień, kropek ani cudzysłowów.`;

    const userPrompt = `Tytuł zadania: ${title}\nOpis zadania: ${description}`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model:  "llama-3.1-8b-instant",
                temperature: 0.2,
                max_tokens: 15,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            console.error("Błąd API Groq:", response.status, await response.text());
            return "Inne";
        }

        const data = await response.json();
        let category = data.choices?.[0]?.message?.content?.trim() ?? "Inne2";

        category = category.split(/\s+/)[0].replace(/["'.]/g, "");
        if (category.length > 0) {
            category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
        }

        return category || "Inne";
    } catch (error) {
        console.error("Błąd podczas łączenia z API Groq:", error);
        return "Inne";
    }
}


let loadBin = function() {
    let req = new XMLHttpRequest();
    req.onreadystatechange = () => {
        if (req.readyState === XMLHttpRequest.DONE && req.status === 200) {
            let response = JSON.parse(req.responseText);
            todoList = response.record;
            updateTodoList();
        }
    };
    req.open("GET", "https://api.jsonbin.io/v3/b/68e2a4daae596e708f071480/latest", true);
    req.setRequestHeader("X-Master-Key", "$2a$10$qDu.55uYPK8IU.HuvtMPgeuxcQD9weet5H5rE4bPz8BS2HfpS7U0m");
    req.send();
}

let updateTodoList = function() {
    const tableContainer = document.getElementById("tabela_zadan");
    if (!tableContainer) return;

    const filterText = (document.getElementById("inputSearch")?.value || "").toLowerCase();
    const fromStr = document.getElementById("inputDateFrom")?.value || "";
    const toStr = document.getElementById("inputDateTo")?.value || "";
    const fromDate = fromStr ? new Date(fromStr) : null;
    const toDate = toStr ? new Date(toStr) : null;

    if(fromDate) fromDate.setHours(0,0,0,0);
    if(toDate) toDate.setHours(23,59,59,999);

    const filtered = todoList.filter(item => {
        const t = (item.title || "").toLowerCase();
        const d = (item.description || "").toLowerCase();
        const matchesText = !filterText || t.includes(filterText) || d.includes(filterText);

        const due = item.dueDate ? new Date(item.dueDate) : null;
        if(due) due.setHours(0,0,0,0);

        const matchesFrom = !fromDate || (due && due >= fromDate);
        const matchesTo = !toDate || (due && due <= toDate);
        return matchesText && matchesFrom && matchesTo;
    });

    let html = "";
    html += '<table class="table table-striped table-bordered align-middle">';
    html += '<thead class="table-light"><tr>' +
        '<th scope="col">Tytuł</th>' +
        '<th scope="col">Opis</th>' +
        '<th scope="col">Miejsce</th>' +
        '<th scope="col">Termin</th>' +
        '<th scope="col">Kategoria</th>' +
        '<th scope="col" class="text-end">Akcje</th>' +
        '</tr></thead><tbody>';

    const today = new Date();
    today.setHours(0,0,0,0);

    filtered.forEach((item) => {
        const originalIndex = todoList.indexOf(item);
        const dueDisp = item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "-";
        const cat = item.category && item.category !== '' ? item.category : '-';

        const badgeClass = `badge ${categoryBadgeClass(cat)}`;
        // Fallback inline for badge (Bootstrap CSS not available)
        let badgeStyle = "padding:.25em .6em;font-size:.75em;font-weight:700;border-radius:.375rem;";
        const catLower = (cat || '').toString().toLowerCase();
        if (catLower === 'uczelnia') badgeStyle += 'color:#fff;background-color:#0d6efd;';
        else if (catLower === 'prywatne') badgeStyle += 'color:#fff;background-color:#198754;';
        else badgeStyle += 'color:#000;background-color:#ffc107;';

        // Row classes (Bootstrap) + fallback inline
        let rowClass = '';
        let rowStyle = '';
        if (item.dueDate) {
            const due = new Date(item.dueDate); due.setHours(0,0,0,0);
            const diff = (due - today) / (1000*60*60*24);
            if (diff < 0) { rowClass = 'table-danger'; rowStyle = 'background-color:#f8d7da;'; }
            else if (diff < 1) { rowClass = 'table-warning'; rowStyle = 'background-color:#fff3cd;'; }
        }

        html += `<tr class="${rowClass}" style="${rowStyle}">` +
            `<td>${escapeHtml(item.title || '')}</td>` +
            `<td>${escapeHtml(item.description || '')}</td>` +
            `<td>${escapeHtml(item.place || '')}</td>` +
            `<td>${escapeHtml(dueDisp)}</td>` +
            `<td><span class="${badgeClass}" style="${badgeStyle}">${escapeHtml(cat)}</span></td>` +
            `<td class="text-end" style="text-align:end;"><button class="btn btn-danger btn-sm" style="background:#dc3545;color:#fff;border:none;padding:.35rem .6rem;border-radius:.375rem;" data-del="${originalIndex}">Usuń</button></td>` +
            '</tr>';
    });
    html += '</tbody></table>';

    tableContainer.innerHTML = html;

    // attach delete handlers
    tableContainer.querySelectorAll('button[data-del]').forEach(btn => {
        btn.addEventListener('click', () => {
            const i = parseInt(btn.getAttribute('data-del'));
            if (!isNaN(i)) deleteTodo(i);
        });
    });

    // update summary and empty state
    const summary = document.getElementById('podsumowanie');
    if (summary) summary.textContent = `Wyświetlono ${filtered.length} z ${todoList.length}`;

    const empty = document.getElementById('pusta_lista');
    if (empty) {
        if (filtered.length === 0) empty.classList.remove('d-none');
        else empty.classList.add('d-none');
    }
}

let deleteTodo = function(index) {
    todoList.splice(index,1);
    updateJSONbin();
    updateTodoList();
}

let addTodo = async function() {
    //get the elements in the form
    let inputTitle = document.getElementById("inputTitle");
    let inputDescription = document.getElementById("inputDescription");
    let inputPlace = document.getElementById("inputPlace");
    let inputDate = document.getElementById("inputDate");

    // Find validation element
    const validationMsg = document.getElementById('titleValidation');

    //get the values from the form
    let newTitle = inputTitle.value;
    let newDescription = inputDescription.value;
    let newPlace = inputPlace.value;
    let newDate = new Date(inputDate.value);

    // validate title
    if (!newTitle || newTitle.trim() === '') {
        if (validationMsg) { validationMsg.classList.remove('d-none'); validationMsg.style.display = 'block'; }
        inputTitle.focus();
        return;
    }
    if (validationMsg) { validationMsg.classList.add('d-none'); validationMsg.style.display = 'none'; }

    //intrgration with groq
    let newCategory = await getCategoryFromGroq(newTitle, newDescription);

    //create new item
    let newTodo = {
        title: newTitle,
        description: newDescription,
        place: newPlace,
        category: newCategory,
        dueDate: newDate
    };
    //add item to the list
    todoList.push(newTodo);

    updateJSONbin();

    // clear form
    inputTitle.value = '';
    inputDescription.value = '';
    inputPlace.value = '';
    inputDate.value = '';

    updateTodoList();
}
// Provide Polish alias used by onsubmit handler in index.html
function dodajZadanie() {
    return addTodo();
}

let updateJSONbin = function() {
    let req = new XMLHttpRequest();
    req.open("PUT", "https://api.jsonbin.io/v3/b/68e2a4daae596e708f071480", true);
    req.setRequestHeader("Content-Type", "application/json");
    req.setRequestHeader("X-Master-Key", "$2a$10$qDu.55uYPK8IU.HuvtMPgeuxcQD9weet5H5rE4bPz8BS2HfpS7U0m");
    req.send(JSON.stringify(todoList));
};

// util: simple HTML escape for table cells
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function categoryBadgeClass(cat) {
    const c = (cat || '').toString().toLowerCase();
    if (c === 'uczelnia') return 'text-bg-primary';
    if (c === 'prywatne') return 'text-bg-success';
    return 'text-bg-warning';
}
