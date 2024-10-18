let csvData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 10;

document.getElementById('csvFileInput').addEventListener('change', handleFileUpload);
document.getElementById('applyFiltersBtn').addEventListener('click', handleAdvancedFilter);
document.getElementById('downloadFilteredDataBtn').addEventListener('click', downloadFilteredData);
document.getElementById('uploadNewFileBtn').addEventListener('click', resetAndUploadNew);

function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        parseCSV(text);
        filteredData = [...csvData];
        generateTable(filteredData);
        createFilterInputs();
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('dataSection').classList.remove('hidden');
        renderPaginationControls(filteredData);
        showMessage('Data uploaded successfully!', 'success');
    };
    reader.readAsText(file);
}

function showMessage(message, type) {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.className = `message ${type}`;
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 3000);
}

function parseCSV(text) {
    const lines = text.split("\n");
    const headers = lines[0].split(",").map(header => header.trim());
    csvData = lines.slice(1).map(line => {
        const values = line.split(",");
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] ? values[index].trim() : "";
            return obj;
        }, {});
    });
}

function createFilterInputs() {
    const filterInputsContainer = document.getElementById('filterInputs');
    filterInputsContainer.innerHTML = '';

    const headers = Object.keys(csvData[0] || {});
    headers.forEach(header => {
        const sanitizedHeader = header.replace(/[^a-zA-Z0-9]/g, '_');
        const div = document.createElement('div');
        div.className = 'filter-input';
        
        const conditionSelect = document.createElement('select');
        conditionSelect.id = `condition_${sanitizedHeader}`;
        conditionSelect.innerHTML = `
            <option value="equals">Equals</option>
            <option value="contains">Contains</option>
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
        `;
        
        const input = document.createElement('input');
        input.placeholder = `Filter by ${header}`;
        input.dataset.column = header;
        input.classList.add('filterInput');
        
        div.appendChild(conditionSelect);
        div.appendChild(input);
        filterInputsContainer.appendChild(div);
    });

    document.querySelectorAll('.filterInput').forEach(input => {
        input.addEventListener('input', handleAdvancedFilter);
    });
}

function applyFilters(filters) {
    filteredData = csvData.filter(row => {
        return Object.keys(filters).every(column => {
            const value = row[column];
            const filter = filters[column];
            if (filter.condition === 'equals') {
                return value.toLowerCase() === filter.value.toLowerCase();
            } else if (filter.condition === 'contains') {
                return value.toLowerCase().includes(filter.value.toLowerCase());
            } else if (filter.condition === 'greater_than') {
                return parseFloat(value) > parseFloat(filter.value);
            } else if (filter.condition === 'less_than') {
                return parseFloat(value) < parseFloat(filter.value);
            }
            return true;
        });
    });
    currentPage = 1;
    generateTable(filteredData);
    renderPaginationControls(filteredData);
}

function handleAdvancedFilter() {
    const filters = {};
    document.querySelectorAll('.filterInput').forEach(input => {
        const column = input.dataset.column;
        const condition = document.querySelector(`#condition_${column.replace(/[^a-zA-Z0-9]/g, '_')}`).value;
        if (input.value.trim()) {
            filters[column] = {
                value: input.value.trim(),
                condition: condition
            };
        }
    });
    applyFilters(filters);
}

function generateTable(data) {
    const dataTable = document.getElementById('dataTable');
    dataTable.innerHTML = '';

    if (data.length === 0) {
        dataTable.innerHTML = '<tr><td colspan="100%">No data found</td></tr>';
        return;
    }

    const headers = Object.keys(data[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    dataTable.appendChild(headerRow);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = data.slice(startIndex, endIndex);

    pageData.forEach(row => {
        const rowElement = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header];
            rowElement.appendChild(td);
        });
        dataTable.appendChild(rowElement);
    });
}

function renderPaginationControls(data) {
    const paginationControls = document.getElementById('paginationControls');
    const currentPageLabel = document.getElementById('currentPageLabel');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    const totalPages = Math.ceil(data.length / itemsPerPage);

    if (totalPages <= 1) {
        paginationControls.style.display = 'none';
        return;
    }

    paginationControls.style.display = 'flex';
    currentPageLabel.textContent = `Page ${currentPage} of ${totalPages}`;

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    prevPageBtn.onclick = function () {
        if (currentPage > 1) {
            currentPage--;
            generateTable(data);
            renderPaginationControls(data);
        }
    };

    nextPageBtn.onclick = function () {
        if (currentPage < totalPages) {
            currentPage++;
            generateTable(data);
            renderPaginationControls(data);
        }
    };
}

function downloadFilteredData() {
    const dataToDownload = filteredData.length > 0 ? filteredData : csvData;
    const headers = Object.keys(dataToDownload[0]);
    const csvRows = [headers.join(',')];

    dataToDownload.forEach(row => {
        const values = headers.map(header => {
            const escapedValue = String(row[header]).replace(/"/g, '""');
            return `"${escapedValue}"`;
        });
        csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, 'filtered_data.csv');
    } else {
        link.href = URL.createObjectURL(blob);
        link.download = 'filtered_data.csv';
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    showMessage('Data downloaded successfully!', 'success');
}

function resetAndUploadNew() {
    // Reset all data and UI elements
    csvData = [];
    filteredData = [];
    currentPage = 1;
    
    // Clear the file input
    document.getElementById('csvFileInput').value = '';
    
    // Hide data section and show upload section
    document.getElementById('dataSection').classList.add('hidden');
    document.getElementById('uploadSection').classList.remove('hidden');
    
    // Clear the table
    document.getElementById('dataTable').innerHTML = '';
    
    // Clear filter inputs
    document.getElementById('filterInputs').innerHTML = '';
    
    // Hide pagination controls
    document.getElementById('paginationControls').style.display = 'none';
    
    showMessage('Ready to upload a new file!', 'success');
}

// Initial setup
document.getElementById('dataSection').classList.add('hidden');