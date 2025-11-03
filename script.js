/* MyExpense - script.js
   - LocalStorage-based expense tracker
   - Charts (Chart.js)
   - Export to Excel (SheetJS) and PDF (jsPDF + html2canvas)
*/

(() => {
  // DOM elements
  const expenseForm = document.getElementById('expenseForm');
  const dateEl = document.getElementById('date');
  const categoryEl = document.getElementById('category');
  const descriptionEl = document.getElementById('description');
  const amountEl = document.getElementById('amount');
  const addBtn = document.getElementById('addBtn');
  const updateBtn = document.getElementById('updateBtn');
  const cancelEdit = document.getElementById('cancelEdit');

  const expensesTbody = document.getElementById('expensesTbody');
  const totalAmountEl = document.getElementById('totalAmount');

  const filterMonth = document.getElementById('filterMonth');
  const filterCategory = document.getElementById('filterCategory');
  const clearFiltersBtn = document.getElementById('clearFilters');

  const navDashboard = document.getElementById('nav-dashboard');
  const navAnalytics = document.getElementById('nav-analytics');
  const dashboardPage = document.getElementById('dashboard');
  const analyticsPage = document.getElementById('analytics');

  const themeToggle = document.getElementById('themeToggle');
  const exportExcelBtn = document.getElementById('exportExcel');
  const exportPDFBtn = document.getElementById('exportPDF');

  // Charts
  let categoryChart = null;
  let monthlyChart = null;

  // State
  let expenses = []; // array of {id,date,category,description,amount}
  let editId = null;

  // Storage keys
  const STORAGE_KEY = 'myexpense_data_v1';
  const THEME_KEY = 'myexpense_theme_v1';

  // Sample data to preload (if no data exists)
  const SAMPLE = [
    { id: genId(), date: isoDateDaysAgo(3), category: 'Food', description: 'Lunch', amount: 220.5 },
    { id: genId(), date: isoDateDaysAgo(1), category: 'Travel', description: 'Auto fare', amount: 60.0 },
    { id: genId(), date: isoDateDaysAgo(12), category: 'Bills', description: 'Electricity', amount: 1250.0 },
    { id: genId(), date: isoDateDaysAgo(20), category: 'Shopping', description: 'T-shirt', amount: 799.0 },
    { id: genId(), date: isoDateDaysAgo(8), category: 'Food', description: 'Groceries', amount: 640.75 },
  ];

  // --- Initialization ---
  init();

  function init(){
    loadTheme();
    loadData();
    bindEvents();
    render();
  }

  function bindEvents(){
    expenseForm.addEventListener('submit', onFormSubmit);
    clearFiltersBtn.addEventListener('click', onClearFilters);
    filterMonth.addEventListener('change', render);
    filterCategory.addEventListener('change', render);
    navDashboard.addEventListener('click', (e) => { e.preventDefault(); showPage('dashboard'); });
    navAnalytics.addEventListener('click', (e) => { e.preventDefault(); showPage('analytics'); });
    cancelEdit.addEventListener('click', cancelEditing);
    themeToggle.addEventListener('click', toggleTheme);
    exportExcelBtn.addEventListener('click', exportExcel);
    exportPDFBtn.addEventListener('click', exportPDF);
    // window resize to update charts
    window.addEventListener('resize', () => {
      if(categoryChart) categoryChart.resize();
      if(monthlyChart) monthlyChart.resize();
    });
  }

  function loadTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if(saved === 'dark') document.documentElement.classList.add('dark');
    updateThemeIcon();
  }
  function toggleTheme(){
    document.documentElement.classList.toggle('dark');
    const now = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, now);
    updateThemeIcon();
  }
  function updateThemeIcon(){
    const dark = document.documentElement.classList.contains('dark');
    themeToggle.textContent = dark ? '🌙' : '🌗';
  }

  function loadData(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      try {
        expenses = JSON.parse(raw);
      } catch {
        expenses = SAMPLE.slice();
      }
    } else {
      // first time: populate sample
      expenses = SAMPLE.slice();
      saveData();
    }
  }
  function saveData(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }

  // --- Form handlers ---
  function onFormSubmit(e){
    e.preventDefault();
    const date = dateEl.value;
    const category = categoryEl.value;
    const description = descriptionEl.value.trim();
    const amount = parseFloat(amountEl.value);

    if(!date || !category || isNaN(amount)) {
      alert('Please provide valid date, category and amount.');
      return;
    }

    if(editId){
      // update
      const idx = expenses.findIndex(x => x.id === editId);
      if(idx >= 0){
        expenses[idx].date = date;
        expenses[idx].category = category;
        expenses[idx].description = description;
        expenses[idx].amount = amount;
        editId = null;
      }
      addBtn.classList.remove('hidden');
      updateBtn.classList.add('hidden');
      cancelEdit.classList.add('hidden');
    } else {
      // add new
      const record = { id: genId(), date, category, description, amount };
      expenses.push(record);
    }

    expenseForm.reset();
    saveData();
    render();
  }

  function startEditing(id){
    const rec = expenses.find(x => x.id === id);
    if(!rec) return;
    editId = id;
    dateEl.value = rec.date;
    categoryEl.value = rec.category;
    descriptionEl.value = rec.description;
    amountEl.value = rec.amount;
    addBtn.classList.add('hidden');
    updateBtn.classList.remove('hidden');
    cancelEdit.classList.remove('hidden');

    // switch to dashboard (in case on analytics)
    showPage('dashboard');
  }

  function cancelEditing(){
    editId = null;
    expenseForm.reset();
    addBtn.classList.remove('hidden');
    updateBtn.classList.add('hidden');
    cancelEdit.classList.add('hidden');
  }

  // --- CRUD ---
  function deleteExpense(id){
    if(!confirm('Delete this expense?')) return;
    expenses = expenses.filter(x => x.id !== id);
    saveData();
    render();
  }

  // --- Rendering ---
  function render(){
    // Apply filters
    const month = filterMonth.value; // "YYYY-MM"
    const categoryFilter = filterCategory.value;

    let filtered = expenses.slice();

    if(month){
      filtered = filtered.filter(e => e.date.startsWith(month));
    }
    if(categoryFilter){
      filtered = filtered.filter(e => e.category === categoryFilter);
    }

    // Sort by date desc
    filtered.sort((a,b) => (b.date.localeCompare(a.date)));

    // Render table rows
    expensesTbody.innerHTML = '';
    let total = 0;
    filtered.forEach(rec => {
      total += Number(rec.amount);
      const tr = document.createElement('tr');

      const tdDate = document.createElement('td');
      tdDate.textContent = rec.date;

      const tdCat = document.createElement('td');
      tdCat.textContent = rec.category;

      const tdDesc = document.createElement('td');
      tdDesc.textContent = rec.description;

      const tdAmt = document.createElement('td');
      tdAmt.className = 'right';
      tdAmt.textContent = formatCurrency(rec.amount);

      const tdActions = document.createElement('td');
      tdActions.className = 'actions';
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => startEditing(rec.id));

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'btn-danger';
      delBtn.addEventListener('click', () => deleteExpense(rec.id));

      tdActions.appendChild(editBtn);
      tdActions.appendChild(delBtn);

      tr.appendChild(tdDate);
      tr.appendChild(tdCat);
      tr.appendChild(tdDesc);
      tr.appendChild(tdAmt);
      tr.appendChild(tdActions);

      expensesTbody.appendChild(tr);
    });

    totalAmountEl.textContent = `₹${Number(total).toFixed(2)}`;

    // Update charts (analytics should reflect all data, not only current filtered)
    updateCharts();

    // If user is on analytics page, ensure charts redraw
    if(analyticsPage.classList.contains('active-page')) {
      setTimeout(() => {
        if(categoryChart) categoryChart.update();
        if(monthlyChart) monthlyChart.update();
      }, 150);
    }
  }

  // --- Charts ---
  function updateCharts(){
    // Category breakdown from all expenses
    const cats = {};
    expenses.forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + Number(e.amount);
    });
    const labels = Object.keys(cats);
    const data = labels.map(l => Number(cats[l].toFixed(2)));

    // Monthly trend - group by YYYY-MM
    const months = {};
    expenses.forEach(e => {
      const m = e.date.slice(0,7);
      months[m] = (months[m] || 0) + Number(e.amount);
    });
    const monthLabels = Object.keys(months).sort();
    const monthData = monthLabels.map(m => Number(months[m].toFixed(2)));

    // Category Chart (pie/doughnut)
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    if(categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          // Chart.js will auto assign colors
          hoverOffset: 6,
          borderWidth: 0.5
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        maintainAspectRatio: false,
      }
    });

    // Monthly Chart (line)
    const ctxMon = document.getElementById('monthlyChart').getContext('2d');
    if(monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(ctxMon, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Total expenses',
          data: monthData,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          borderWidth: 2
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true }
        },
        maintainAspectRatio: false,
      }
    });
  }

  // --- Utilities ---
  function formatCurrency(n){
    const v = Number(n).toFixed(2);
    return `₹${v}`;
  }

  function genId(){
    return 'e_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }

  function isoDateDaysAgo(days){
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0,10);
  }

  // Show page (dashboard / analytics)
  function showPage(name){
    if(name === 'dashboard'){
      dashboardPage.classList.add('active-page');
      analyticsPage.classList.remove('active-page');
      navDashboard.classList.add('active');
      navAnalytics.classList.remove('active');
      // scroll to top of main content area
      window.scrollTo({ top: 80, behavior: 'smooth' });
    } else if(name === 'analytics'){
      dashboardPage.classList.remove('active-page');
      analyticsPage.classList.add('active-page');
      navDashboard.classList.remove('active');
      navAnalytics.classList.add('active');
      setTimeout(() => {
        if(categoryChart) categoryChart.update();
        if(monthlyChart) monthlyChart.update();
      }, 120);
      window.scrollTo({ top: 80, behavior: 'smooth' });
    }
  }

  // --- Filters ---
  function onClearFilters(){
    filterMonth.value = '';
    filterCategory.value = '';
    render();
  }

  // --- Export: Excel ---
  function exportExcel(){
    // We'll export the currently visible table rows (applies filters)
    const rows = [];
    const header = ['Date','Category','Description','Amount'];
    rows.push(header);

    // gather displayed rows (filtered)
    const month = filterMonth.value;
    const categoryFilter = filterCategory.value;

    const filtered = expenses.filter(e => {
      if(month && !e.date.startsWith(month)) return false;
      if(categoryFilter && e.category !== categoryFilter) return false;
      return true;
    });

    filtered.forEach(r => {
      rows.push([r.date, r.category, r.description, r.amount]);
    });

    // create sheet
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `MyExpense_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Export: PDF ---
  async function exportPDF(){
    // We'll capture the tableWrap if on dashboard; if on analytics capture charts section
    let target;
    if(dashboardPage.classList.contains('active-page')){
      target = document.getElementById('tableWrap');
    } else {
      // analytics
      target = document.querySelector('.charts-grid');
    }
    if(!target) return;

    // Use html2canvas then jspdf
    const canvas = await html2canvas(target, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`MyExpense_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  // Initialize first render & charts
  render();

})();
