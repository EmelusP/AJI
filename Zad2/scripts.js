"use strict"
let todoList = []; //declares a new array for Your todo list

/*
let initList = function() {
    let savedList = window.localStorage.getItem("todos");
    if (savedList != null)
        todoList = JSON.parse(savedList);
    else
    //code creating a default list with 2 items

    todoList.push(
        {
            title: "Learn JS",
            description: "Create a demo application for my TODO's",
            place: "445",
            category: '',
            dueDate: new Date(2024,10,16)
        },
        {
            title: "Lecture test",
            description: "Quick test from the first three lectures",
            place: "F6",
            category: '',
            dueDate: new Date(2024,10,17)
        }
    );
}
initList();
*/
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
        const validationSpan = inputTitle.nextElementSibling;

        inputTitle.addEventListener('input', () => {
            if (inputTitle.value && validationSpan) {
                validationSpan.style.display = 'none';
            }
        });
    }

    loadBin();
    setTimeout(updateTodoList, 1000);
};

async function getCategoryFromGroq(title, description) {
    const GROQ_API_KEY ="Kluczz";

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

        // Oczyszczanie odpowiedzi do jednego słowa
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
            window.localStorage.setItem("todos", JSON.stringify(todoList));
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
    html += '<table>';
    html += '<thead><tr>' +
        '<th scope="col">Tytuł</th>' +
        '<th scope="col">Opis</th>' +
        '<th scope="col">Miejsce</th>' +
        '<th scope="col">Termin</th>' +
        '<th scope="col">Kategoria</th>' +
        '<th scope="col" style="text-align: end;">Akcje</th>' +
        '</tr></thead><tbody>';

    const today = new Date();
    today.setHours(0,0,0,0);

    filtered.forEach((item) => {
        const originalIndex = todoList.indexOf(item);
        const dueDisp = item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "-";
        const cat = item.category && item.category !== '' ? item.category : '-';

        let badgeStyle = "padding: .25em .6em; font-size: .75em; font-weight: 700; border-radius: .375rem; color: #000; background-color: #ffc107;"; // Domyślny (warning)
        if (cat.toLowerCase() === 'uczelnia') {
            badgeStyle = "padding: .25em .6em; font-size: .75em; font-weight: 700; border-radius: .375rem; color: #fff; background-color: #0d6efd;"; // Primary
        } else if (cat.toLowerCase() === 'prywatne') {
            badgeStyle = "padding: .25em .6em; font-size: .75em; font-weight: 700; border-radius: .375rem; color: #fff; background-color: #198754;"; // Success
        }

        // Style inline dla wierszy (zamiast klas table-danger/warning)
        let rowStyle = '';
        if (item.dueDate) {
            const due = new Date(item.dueDate); due.setHours(0,0,0,0);
            const diff = (due - today) / (1000*60*60*24);
            if (diff < 0) rowStyle = 'background-color: #f8d7da;'; // danger
            else if (diff < 1) rowStyle = 'background-color: #fff3cd;'; // warning
        }

        html += `<tr style="${rowStyle}">` +
            `<td>${escapeHtml(item.title || '')}</td>` +
            `<td>${escapeHtml(item.description || '')}</td>` +
            `<td>${escapeHtml(item.place || '')}</td>` +
            `<td>${escapeHtml(dueDisp)}</td>` +
            `<td><span style="${badgeStyle}">${escapeHtml(cat)}</span></td>` +
            `<td style="text-align: end;"><button class="usun_btn" data-del="${originalIndex}">Usuń</button></td>` +
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
        empty.style.display = filtered.length === 0 ? 'block' : 'none';
    }
}

let deleteTodo = function(index) {
    todoList.splice(index,1);
    window.localStorage.setItem("todos", JSON.stringify(todoList));
    updateJSONbin();
    updateTodoList();
}

let addTodo = async function() {
    //get the elements in the form
    let inputTitle = document.getElementById("inputTitle");
    let inputDescription = document.getElementById("inputDescription");
    let inputPlace = document.getElementById("inputPlace");
    let inputDate = document.getElementById("inputDate");

    // Znajdź span walidacyjny
    const validationSpan = inputTitle.nextElementSibling;

    //get the values from the form
    let newTitle = inputTitle.value;
    let newDescription = inputDescription.value;
    let newPlace = inputPlace.value;
    let newDate = new Date(inputDate.value);

    // validate title
    if (!newTitle || newTitle.trim() === '') {
        if (validationSpan) validationSpan.style.display = 'block'; // Pokaż błąd
        inputTitle.focus();
        return;
    }
    if (validationSpan) validationSpan.style.display = 'none'; // Ukryj błąd

    // --- INTEGRACJA GROQ ---
    let newCategory = await getCategoryFromGroq(newTitle, newDescription);
    // -----------------------

    //create new item
    let newTodo = {
        title: newTitle,
        description: newDescription,
        place: newPlace,
        category: newCategory, // Użyj kategorii z Groq
        dueDate: newDate
    };
    //add item to the list
    todoList.push(newTodo);

    window.localStorage.setItem("todos", JSON.stringify(todoList));
    updateJSONbin();

    // clear form
    inputTitle.value = '';
    inputDescription.value = '';
    inputPlace.value = '';
    inputDate.value = '';

    updateTodoList(); // Odśwież listę po dodaniu
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
