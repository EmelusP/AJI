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
        inputTitle.addEventListener('input', () => {
            if (inputTitle.value && inputTitle.classList.contains('is-invalid')) {
                inputTitle.classList.remove('is-invalid');
            }
        });
    }

    loadBin();
    setTimeout(updateTodoList, 1000);
};

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
    const tableContainer = document.getElementById("todoTableView");
    if (!tableContainer) return;

    const filterText = (document.getElementById("inputSearch")?.value || "").toLowerCase();
    const fromStr = document.getElementById("inputDateFrom")?.value || "";
    const toStr = document.getElementById("inputDateTo")?.value || "";
    const fromDate = fromStr ? new Date(fromStr) : null;
    const toDate = toStr ? new Date(toStr) : null;

    const filtered = todoList.filter(item => {
        const t = (item.title || "").toLowerCase();
        const d = (item.description || "").toLowerCase();
        const matchesText = !filterText || t.includes(filterText) || d.includes(filterText);

        const due = item.dueDate ? new Date(item.dueDate) : null;
        const matchesFrom = !fromDate || (due && due >= fromDate);
        const matchesTo = !toDate || (due && due <= toDate);
        return matchesText && matchesFrom && matchesTo;
    });

    // Build table HTML
    let html = "";
    html += '<table class="table table-striped table-hover table-bordered align-middle table-sm">';
    html += '<thead class="table-light"><tr>' +
            '<th scope="col">Title</th>' +
            '<th scope="col">Description</th>' +
            '<th scope="col">Place</th>' +
            '<th scope="col">Due date</th>' +
            '<th scope="col">Category</th>' +
            '<th scope="col" class="text-end">Actions</th>' +
            '</tr></thead><tbody>';
    const today = new Date();
    today.setHours(0,0,0,0);
    filtered.forEach((item) => {
        // find original index for delete action
        const originalIndex = todoList.indexOf(item);
        const dueDisp = item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "-";
        const cat = item.category && item.category !== '' ? item.category : '-';
        const badge = categoryBadgeClass(cat);
        let rowClass = '';
        if (item.dueDate) {
            const due = new Date(item.dueDate); due.setHours(0,0,0,0);
            const diff = (due - today) / (1000*60*60*24);
            if (diff < 0) rowClass = 'table-danger';
            else if (diff <= 1) rowClass = 'table-warning';
        }
        html += `<tr class="${rowClass}">` +
                `<td>${escapeHtml(item.title || '')}</td>` +
                `<td>${escapeHtml(item.description || '')}</td>` +
                `<td>${escapeHtml(item.place || '')}</td>` +
                `<td>${escapeHtml(dueDisp)}</td>` +
                `<td><span class="badge ${badge}">${escapeHtml(cat)}</span></td>` +
                `<td class="text-end"><button class="btn btn-sm btn-danger" data-del="${originalIndex}">Delete</button></td>` +
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
    const summary = document.getElementById('summary');
    if (summary) summary.textContent = `Shown ${filtered.length} of ${todoList.length}`;
    const empty = document.getElementById('emptyState');
    if (empty) empty.classList.toggle('d-none', filtered.length !== 0);
}

setInterval(updateTodoList, 1000);

let deleteTodo = function(index) {
    todoList.splice(index,1);
    window.localStorage.setItem("todos", JSON.stringify(todoList));
    updateJSONbin();
}

let addTodo = async function() {
    //get the elements in the form
    let inputTitle = document.getElementById("inputTitle");
    let inputDescription = document.getElementById("inputDescription");
    let inputPlace = document.getElementById("inputPlace");
    let inputDate = document.getElementById("inputDate");
    //get the values from the form
    let newTitle = inputTitle.value;
    let newDescription = inputDescription.value;
    let newPlace = inputPlace.value;
    let newDate = new Date(inputDate.value);
    // validate title
    if (!newTitle || newTitle.trim() === '') {
        inputTitle.classList.add('is-invalid');
        inputTitle.focus();
        return;
    }
    // step 8 disabled: no auto-categorization
    let newCategory = '';
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

    window.localStorage.setItem("todos", JSON.stringify(todoList));
    updateJSONbin();

    // clear form
    inputTitle.value = '';
    inputDescription.value = '';
    inputPlace.value = '';
    inputDate.value = '';
    inputTitle.classList.remove('is-invalid');
    updateTodoList();
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
