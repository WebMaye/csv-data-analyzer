let csvData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 10;
let headers = [];
let hiddenColumns = [];
let chart = null;
let currentSortColumn = null;
let currentSortDirection = 'asc';

document.addEventListener('DOMContentLoaded', function() {
    // Event listeners
    document.getElementById('csvFileInput').addEventListener('change', handleFileUpload);
    document.getElementById('downloadFilteredDataBtn').addEventListener('click', downloadFilteredData);
    document.getElementById('uploadNewFileBtn').addEventListener('click', resetAndUploadNew);
    document.getElementById('globalSearch').addEventListener('input', handleGlobalSearch);
    document.getElementById('toggleColumnsBtn').addEventListener('click', toggleColumnList);

    // Initialize any other necessary components
    addExportButton();
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        parseCSV(text);
        filteredData = [...csvData];
        generateTable(filteredData);
        createFilterInputs();
        createColumnToggleList();
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('dataSection').classList.remove('hidden');
        renderPaginationControls();
        initializeChart();
        showMessage('Data uploaded successfully!', 'success');
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split("\n");
    headers = lines[0].split(",").map(header => header.trim());
    csvData = lines.slice(1).map(line => {
        const values = line.split(",");
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] ? values[index].trim() : "";
            return obj;
        }, {});
    });
}

// Debounce function
function debounce(func, delay) {
    let debounceTimer;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(context, args), delay);
    }
}


function createFilterInputs() {
    const filterInputsContainer = document.getElementById('filterInputs');
    filterInputsContainer.innerHTML = '';

    headers.forEach(header => {
        const div = document.createElement('div');
        div.className = 'filter-input';
        
        const conditionSelect = document.createElement('select');
        conditionSelect.id = `condition_${header.replace(/[^a-zA-Z0-9]/g, '_')}`;
        conditionSelect.innerHTML = `
            <option value="">Select condition</option>
            <option value="equals">Equals</option>
            <option value="contains">Contains</option>
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
        `;
        
        const input = document.createElement('input');
        input.placeholder = `Filter by ${header}`;
        input.dataset.column = header;
        input.classList.add('filterInput');
        input.disabled = true; // Disable input by default
        
        conditionSelect.addEventListener('change', (e) => {
            input.disabled = e.target.value === '';
            if (e.target.value === 'greater_than' || e.target.value === 'less_than') {
                if (!isNumericColumn(header)) {
                    showMessage(`Warning: "${header}" may not be a numeric column.`, 'warning');
                }
            }
            updateFilterVisualFeedback(div, e.target.value !== '' || input.value !== '');
            handleAdvancedFilter(); // Apply filter immediately when condition changes
        });
        
        input.addEventListener('input', (e) => {
            updateFilterVisualFeedback(div, e.target.value !== '' || conditionSelect.value !== '');
            handleAdvancedFilter(); // Apply filter immediately when input changes
        });
        
        div.appendChild(conditionSelect);
        div.appendChild(input);
        filterInputsContainer.appendChild(div);
    });
}

// Debounced version of handleAdvancedFilter
const debouncedHandleAdvancedFilter = debounce(handleAdvancedFilter, 300);

function isNumericColumn(header) {
    return csvData.every(row => !isNaN(parseFloat(row[header])) && isFinite(row[header]));
}

function updateFilterVisualFeedback(filterDiv, isActive) {
    if (isActive) {
        filterDiv.classList.add('active-filter');
    } else {
        filterDiv.classList.remove('active-filter');
    }
}

function handleAdvancedFilter() {
    const filters = {};
    document.querySelectorAll('.filterInput').forEach(input => {
        const column = input.dataset.column;
        const conditionSelect = document.querySelector(`#condition_${column.replace(/[^a-zA-Z0-9]/g, '_')}`);
        const condition = conditionSelect.value;
        if (input.value.trim() && condition) {
            filters[column] = {
                value: input.value.trim(),
                condition: condition
            };
        }
    });
    applyFilters(filters);
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
    renderPaginationControls();
    updateChart();
}

function resetFilters() {
    document.querySelectorAll('.filterInput').forEach(input => {
        input.value = '';
    });
    document.querySelectorAll('select[id^="condition_"]').forEach(select => {
        select.selectedIndex = 0;
    });
    filteredData = [...csvData];
    currentPage = 1;
    generateTable(filteredData);
    renderPaginationControls();
    updateChart();
}

function handleGlobalSearch() {
    const searchTerm = document.getElementById('globalSearch').value.toLowerCase();
    filteredData = csvData.filter(row => {
        return Object.values(row).some(value => 
            value.toString().toLowerCase().includes(searchTerm)
        );
    });
    currentPage = 1;
    generateTable(filteredData);
    renderPaginationControls();
    updateChart();
}

function generateTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.innerHTML = '';

    if (data.length === 0) {
        tableContainer.innerHTML = '<p>No data found</p>';
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    headers.forEach((header, index) => {
        if (!hiddenColumns.includes(header)) {
            const th = document.createElement('th');
            th.textContent = header;
            th.addEventListener('click', () => sortTable(header));
            
            // Add sort indicator
            if (header === currentSortColumn) {
                const indicator = currentSortDirection === 'asc' ? '▲' : '▼';
                th.textContent += ` ${indicator}`;
            }
            
            // Add resizable handle
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            resizer.addEventListener('mousedown', initResize(th));
            th.appendChild(resizer);
            
            headerRow.appendChild(th);
        }
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = data.slice(startIndex, endIndex);

    pageData.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            if (!hiddenColumns.includes(header)) {
                const td = document.createElement('td');
                td.textContent = row[header];
                td.contentEditable = true;
                td.addEventListener('blur', () => updateCellValue(row, header, td.textContent));
                tr.appendChild(td);
            }
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
}

function initResize(th) {
    let startX, startWidth;

    function startDragging(e) {
        startX = e.clientX;
        startWidth = parseInt(document.defaultView.getComputedStyle(th).width, 10);
        document.documentElement.addEventListener('mousemove', doDrag, false);
        document.documentElement.addEventListener('mouseup', stopDragging, false);
    }

    function doDrag(e) {
        th.style.width = (startWidth + e.clientX - startX) + 'px';
    }

    function stopDragging(e) {
        document.documentElement.removeEventListener('mousemove', doDrag, false);
        document.documentElement.removeEventListener('mouseup', stopDragging, false);
    }

    return startDragging;
}

function sortTable(column) {
    if (currentSortColumn === column) {
        // If clicking the same column, reverse the sort direction
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // If clicking a new column, set it as the current sort column and default to ascending
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    filteredData.sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];

        // Convert to numbers if possible for numeric sorting
        if (!isNaN(valueA) && !isNaN(valueB)) {
            valueA = Number(valueA);
            valueB = Number(valueB);
        }

        if (valueA < valueB) return currentSortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    generateTable(filteredData);
    renderPaginationControls();
}

function updateCellValue(row, header, newValue) {
    row[header] = newValue;
    updateChart();
}

function renderPaginationControls() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const currentPageLabel = document.getElementById('currentPageLabel');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    currentPageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    prevPageBtn.onclick = function () {
        if (currentPage > 1) {
            currentPage--;
            generateTable(filteredData);
            renderPaginationControls();
        }
    };

    nextPageBtn.onclick = function () {
        if (currentPage < totalPages) {
            currentPage++;
            generateTable(filteredData);
            renderPaginationControls();
        }
    };
}

function downloadFilteredData() {
    const format = document.getElementById('exportFormat').value;
    const dataToDownload = filteredData.length > 0 ? filteredData : csvData;
    
    if (format === 'csv') {
        downloadCSV(dataToDownload);
    } else if (format === 'xlsx') {
        downloadXLSX(dataToDownload);
    } else if (format === 'json') {
        downloadJSON(dataToDownload);
    }
    
    showMessage(`Data downloaded successfully as ${format.toUpperCase()}!`, 'success');
}

function downloadCSV(data) {
    const csvRows = [headers.join(',')];
    data.forEach(row => {
        const values = headers.map(header => {
            const escapedValue = String(row[header]).replace(/"/g, '""');
            return `"${escapedValue}"`;
        });
        csvRows.push(values.join(','));
    });
    const csvString = csvRows.join('\n');
    downloadFile(csvString, 'filtered_data.csv', 'text/csv;charset=utf-8;');
}

function downloadXLSX(data) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtered Data");
    XLSX.writeFile(wb, "filtered_data.xlsx");
}

function downloadJSON(data) {
    const jsonString = JSON.stringify(data, null, 2);
    downloadFile(jsonString, 'filtered_data.json', 'application/json');
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, fileName);
    } else {
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
    }
}

function resetAndUploadNew() {
    csvData = [];
    filteredData = [];
    currentPage = 1;
    headers = [];
    hiddenColumns = [];
    document.getElementById('csvFileInput').value = '';
    document.getElementById('dataSection').classList.add('hidden');
    document.getElementById('uploadSection').classList.remove('hidden');
    document.getElementById('tableContainer').innerHTML = '';
    document.getElementById('filterInputs').innerHTML = '';
    document.getElementById('columnList').innerHTML = '';
    document.getElementById('globalSearch').value = '';
    if (chart) {
        chart.destroy();
        chart = null;
    }
    showMessage('Ready to upload a new file!', 'success');
}

function createColumnToggleList() {
    const columnList = document.getElementById('columnList');
    columnList.innerHTML = '';
    headers.forEach(header => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !hiddenColumns.includes(header);
        checkbox.addEventListener('change', () => toggleColumn(header));
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(header));
        columnList.appendChild(label);
    });
}

function toggleColumnList() {
    const columnList = document.getElementById('columnList');
    columnList.classList.toggle('hidden');
}

function toggleColumn(header) {
    const index = hiddenColumns.indexOf(header);
    if (index > -1) {
        hiddenColumns.splice(index, 1);
    } else {
        hiddenColumns.push(header);
    }
    generateTable(filteredData);
    updateChart();
}

// Advanced charting system
function initializeChart() {
    const ctx = document.getElementById('dataChart').getContext('2d');
    const numericColumns = headers.filter(header => isNumericColumn(header));

    if (numericColumns.length < 2) {
        document.getElementById('chartContainer').style.display = 'none';
        return;
    }

    const chartControls = document.createElement('div');
    chartControls.className = 'chart-controls';
    
    const xAxisSelect = createAxisSelect('X-Axis', numericColumns);
    const yAxisSelect = createAxisSelect('Y-Axis', numericColumns);
    
    chartControls.appendChild(xAxisSelect);
    chartControls.appendChild(yAxisSelect);
    
    document.getElementById('chartContainer').insertBefore(chartControls, document.getElementById('dataChart'));

    chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Data Points',
                data: [],
                backgroundColor: 'rgba(75, 192, 192, 0.6)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: '' } },
                y: { title: { display: true, text: '' } }
            }
        }
    });

    xAxisSelect.addEventListener('change', updateChart);
    yAxisSelect.addEventListener('change', updateChart);
    updateChart();
}

function createAxisSelect(label, options) {
    const container = document.createElement('div');
    container.className = 'axis-select';
    
    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    
    const select = document.createElement('select');
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
    
    container.appendChild(labelElement);
    container.appendChild(select);
    return container;
}

function updateChart() {
    if (!chart) return;

    const xAxisSelect = document.querySelector('.chart-controls select:first-child');
    const yAxisSelect = document.querySelector('.chart-controls select:last-child');
    
    const xAxis = xAxisSelect.value;
    const yAxis = yAxisSelect.value;

    const chartData = filteredData.map(row => ({
        x: parseFloat(row[xAxis]),
        y: parseFloat(row[yAxis])
    }));

    chart.data.datasets[0].data = chartData;
    chart.options.scales.x.title.text = xAxis;
    chart.options.scales.y.title.text = yAxis;
    chart.update();
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

// Export current view as a shareable link
function exportCurrentView() {
    const currentState = {
        filters: getActiveFilters(),
        hiddenColumns: hiddenColumns,
        sorting: getCurrentSorting(),
        chart: getChartState()
    };
    
    const stateString = JSON.stringify(currentState);
    const encodedState = btoa(stateString);
    
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('state', encodedState);
    
    const shareableLink = currentUrl.toString();
    
    // Create a temporary input to copy the link
    const tempInput = document.createElement('input');
    tempInput.value = shareableLink;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    
    showMessage('Shareable link copied to clipboard!', 'success');
}

function getActiveFilters() {
    const filters = {};
    document.querySelectorAll('.filterInput').forEach(input => {
        const column = input.dataset.column;
        const conditionSelect = document.querySelector(`#condition_${column.replace(/[^a-zA-Z0-9]/g, '_')}`);
        const condition = conditionSelect.value;
        if (input.value.trim() && condition) {
            filters[column] = {
                value: input.value.trim(),
                condition: condition
            };
        }
    });
    return filters;
}

function getCurrentSorting() {
    // Implement this based on your current sorting mechanism
    // For example, you might store the current sorting column and direction
    return {
        column: currentSortColumn,
        direction: currentSortDirection
    };
}

function getChartState() {
    if (!chart) return null;
    
    const xAxisSelect = document.querySelector('.chart-controls select:first-child');
    const yAxisSelect = document.querySelector('.chart-controls select:last-child');
    
    return {
        xAxis: xAxisSelect.value,
        yAxis: yAxisSelect.value
    };
}

// Function to apply state from a shareable link
function applySharedState() {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedState = urlParams.get('state');
    
    if (encodedState) {
        try {
            const stateString = atob(encodedState);
            const state = JSON.parse(stateString);
            
            // Apply filters
            applyFilters(state.filters);
            
            // Apply hidden columns
            hiddenColumns = state.hiddenColumns;
            updateColumnVisibility();
            
            // Apply sorting
            if (state.sorting) {
                currentSortColumn = state.sorting.column;
                currentSortDirection = state.sorting.direction;
                if (currentSortColumn) {
                    sortTable(currentSortColumn);
                }
            }
            
            // Apply chart state
            if (state.chart && chart) {
                const xAxisSelect = document.querySelector('.chart-controls select:first-child');
                const yAxisSelect = document.querySelector('.chart-controls select:last-child');
                xAxisSelect.value = state.chart.xAxis;
                yAxisSelect.value = state.chart.yAxis;
                updateChart();
            }
            
            showMessage('Shared view applied successfully!', 'success');
        } catch (error) {
            showMessage('Error applying shared state.', 'error');
            console.error('Error applying shared state:', error);
        }
    }
}

// Call this function when the page loads
window.addEventListener('load', applySharedState);

// Add an export button to the UI
function addExportButton() {
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Create Shareable Link';
    exportButton.id = 'createShareableLinkBtn';
    exportButton.addEventListener('click', exportCurrentView);
    
    const filterActions = document.querySelector('.filter-actions');
    filterActions.appendChild(exportButton);
}

function addChartExportButton() {
    const chartExportButton = document.createElement('button');
    chartExportButton.textContent = 'Export Chart';
    chartExportButton.id = 'exportChartBtn';
    chartExportButton.addEventListener('click', exportChartView);
    
    const chartContainer = document.getElementById('chartContainer');
    chartContainer.insertBefore(chartExportButton, chartContainer.firstChild);
}

// Call this function after creating the initial UI
addExportButton();

addChartExportButton();

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('globalSearch').focus();
    } else if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault();
        document.getElementById('nextPageBtn').click();
    } else if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        document.getElementById('prevPageBtn').click();
    }
});

// Data validation for CSV upload
function validateCSV(csvString) {
    const lines = csvString.split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row.');
    }

    const headerCount = lines[0].split(',').length;
    for (let i = 1; i < lines.length; i++) {
        const columnCount = lines[i].split(',').length;
        if (columnCount !== headerCount) {
            throw new Error(`Row ${i + 1} has ${columnCount} columns, but the header has ${headerCount} columns.`);
        }
    }
}

// Update file upload handler to include validation
function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        parseCSV(text);
        filteredData = [...csvData];
        generateTable(filteredData);
        createFilterInputs();
        createColumnToggleList();
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('dataSection').classList.remove('hidden');
        renderPaginationControls();
        initializeChart();
        showMessage('Data uploaded successfully!', 'success');
    };
    reader.readAsText(file);
}