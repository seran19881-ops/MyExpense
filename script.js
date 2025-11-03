/* MyExpense - script.js
   Works across index.html and analytics.html
   - LocalStorage-based transactions (Income & Expense)
   - Chart.js (on analytics.html)
   - Export to Excel (SheetJS) and PDF (jsPDF + html2canvas)
   - Theme toggle synced via localStorage
*/

(() => {
  // Storage keys
  const STORAGE_KEY = 'myexpense_transactions_v2';
  const THEME_KEY = 'myexpense_theme_v2';

  // Shared state
  let transactions = [];
  let editId = null;

  // DOM references (only if present)
  const transactionForm = document.getElementById('transactionForm');
  const typeEl = document.getElementById('type');
  const dateEl = document.getElementById('date');
  const categoryEl = document.getElementById('category');
  const descriptionEl = document.getElementById('description');
  const amountEl = document.getElementById('amount');
  const addBtn = document.getElementById('addBtn');
  const updateBtn = document.getElementById('updateBtn');
  const cancelEdit = document.getElementById('cancelEdit');

  const transactionsTbody = document.getElementById('transactionsTbody');
  const totalsAmountEl = document.getElementById('totalsAmount');
  const totalIncomeEl = document.getElementById('totalIncome');
  const totalExpenseEl = document.getElementById('totalExpense');
  const balanceEl = document.getElementById('balance');

  const filterMonth = document.getElementById('filterMonth');
  const filterType = document.getElementById('filterType');
  const filterCategory = document.getElementById('filterCategory');
  const clearFiltersBtn = document.getElementById('clearFilters');

  const exportExcelBtns = document.querySelectorAll('#exportExcel');
  const exportPDFBtns = document.querySelectorAll('#exportPDF');

  const themeToggleBtns = document.querySelectorAll('#themeToggle');

  // Charts (analytics page)
  let categoryChart = null;
  let monthlyComparisonChart = null;

  // Sample data (if empty)
  const SAMPLE = [
    { id: genId(), type: 'Income', date: isoDateDaysAgo(25), category: 'Salary', description: 'Monthly salary', amount: 35000 },
    { id: genId(), type: 'Expense', date: isoDateDaysAgo(24), category: 'Food', description: 'Groceries', amount: 1200.25 },
    { id: genId(), type: 'Expense', date: isoDateDaysAgo(20), category: 'Travel', description: 'Train ticket', amount: 230 },
    { id: genId(), type: 'Expense', date: isoDateDaysAgo(12), category: 'Bills', description: 'Electricity', amount: 1600 },
    { id: genId(), type: 'Income', date: isoDateDaysAgo(8), category: 'Other', description: 'Freelance', amount: 5000 },
  ];

  // Initialize on load
  document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadData();
    bindEvents();
    renderAll();
  });

  // ------------------ Data & Theme ------------------
  function loadData(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      try {
        transactions = JSON.parse(raw);
      } catch {
        transactions = SAMPLE.slice();
      }
    } else {
      transactions = SAMPLE.slice();
      saveData();
    }
  }
  function saveData(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }

  function loadTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    if(saved === 'dark') document.documentElement.classList.add('dark');
    updateThemeIcons();
  }
  function toggleTheme(){
    document.documentElement.classList.toggle('dark');
    const now = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, now);
    updateThemeIcons();
  }
  function updateThemeIcons(){
    const dark = document.documentElement.classList.contains('dark');
    themeToggleBtns.forEach(btn => { btn.textContent = dark ? '🌙' : '🌗'; });
  }

  // ------------------ Bind events ------------------
  function bindEvents(){
    if(transactionForm){
      transactionForm.addEventListener('submit', onFormSubmit);
      cancelEdit && cancelEdit.addEventListener('click', cancelEditing);
      filterMonth && filterMonth.addEventListener('change', renderTransactions);
      filterType && filterType.addEventListener('change', renderTransactions);
      filterCategory && filterCategory.addEventListener('change', renderTransactions);
      clearFiltersBtn && clearFiltersBtn.addEventListener('click', onClearFilters);
    }

    // Exports (may be on either page)
    exportExcelBtns.forEach(btn => btn.addEventListener('click', exportExcel));
    exportPDFBtns.forEach(btn => btn.addEventListener('click', exportPDF));

    // Theme toggle
    themeToggleBtns.forEach(btn => btn.addEventListener('click', toggleTheme));

    // Resize charts on window resize
    window.addEventListener('resize', () => {
      if(categoryChart) categoryChart.resize();
      if(monthlyComparisonChart) monthlyComparisonChart.resize();
    });
  }

  // ------------------ Form handlers ------------------
  function onFormSubmit(e){
    e.preventDefault();
    const type = typeEl.value;
    const date = dateEl.value;
    const category = categoryEl.value;
    const description = descriptionEl.value.trim();
    const amount = parseFloat(amountEl.value);

    if(!date || !type || isNaN(amount)){
      alert('Please provide valid Type, Date and Amount.');
      return;
    }

    if(editId){
      const idx = transactions.findIndex(t => t.id === editId);
      if(idx >= 0){
        transactions[idx] = { id: editId, type, date, category, description, amount };
      }
      editId = null;
      addBtn.classList.remove('hidden');
      updateBtn.classList.add('hidden');
      cancelEdit.classList.add('hidden');
    } else {
      transactions.push({ id: genId(), type, date, category, description, amount });
    }

    transactionForm.reset();
    saveData();
    renderAll();
  }

  function startEditing(id){
    const rec = transactions.find(t => t.id === id);
    if(!rec) return;
    editId = id;
    if(typeEl) typeEl.value = rec.type;
    if(dateEl) dateEl.value = rec.date;
    if(categoryEl) categoryEl.value = rec.category;
    if(descriptionEl) descriptionEl.value = rec.description;
    if(amountEl) amountEl.value = rec.amount;
    addBtn.classList.add('hidden');
    updateBtn.classList.remove('hidden');
    cancelEdit.classList.remove('hidden');
    // Scroll to form
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }

  function cancelEditing(){
    editId = null;
    transactionForm.reset();
    addBtn.classList.remove('hidden');
    updateBtn.classList.add('hidden');
    cancelEdit.classList.add('hidden');
  }

  function deleteTransaction(id){
    if(!confirm('Delete this transaction?')) return;
    transactions = transactions.filter(t => t.id !== id);
    saveData();
    renderAll();
  }

  // ------------------ Rendering ------------------
  function renderAll(){
    renderTransactions();
    renderSummary();
    // If analytics page is loaded, draw charts
    if(document.getElementById('categoryChart')) {
      renderAnalyticsCharts();
    }
  }

  function renderTransactions(){
    if(!transactionsTbody) return;
    const month = filterMonth && filterMonth.value;
    const typeF = filterType && filterType.value;
    const catF = filterCategory && filterCategory.value;

    let filtered = transactions.slice();
    if(month){
      filtered = filtered.filter(t => t.date.startsWith(month));
    }
    if(typeF){
      filtered = filtered.filter(t => t.type === typeF);
    }
    if(catF){
      filtered = filtered.filter(t => t.category === catF);
    }

    // sort desc
    filtered.sort((a,b) => b.date.localeCompare(a.date));

    transactionsTbody.innerHTML = '';
    let total = 0;
    filtered.forEach(t => {
      total += Number(t.amount);
      const tr = document.createElement('tr');
      tr.className = t.type === 'Income' ? 'row-income' : 'row-expense';

      const tdDate = document.createElement('td'); tdDate.textContent = t.date;
      const tdType = document.createElement('td'); tdType.textContent = t.type;
      const tdCat = document.createElement('td'); tdCat.textContent = t.category;
      const tdDesc = document.createElement('td'); tdDesc.textContent = t.description;
      const tdAmt = document.createElement('td'); tdAmt.className = 'right'; tdAmt.textContent = formatCurrency(t.amount);

      const tdActions = document.createElement('td');
      tdActions.className = 'actions';
      const editBtn = document.createElement('button'); editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => startEditing(t.id));
      const delBtn = document.createElement('button'); delBtn.textContent = 'Delete'; delBtn.className = 'btn-danger';
      delBtn.addEventListener('click', () => deleteTransaction(t.id));
      tdActions.appendChild(editBtn); tdActions.appendChild(delBtn);

      tr.appendChild(tdDate);
      tr.appendChild(tdType);
      tr.appendChild(tdCat);
      tr.appendChild(tdDesc);
      tr.appendChild(tdAmt);
      tr.appendChild(tdActions);

      transactionsTbody.appendChild(tr);
    });

    totalsAmountEl && (totalsAmountEl.textContent = `₹${Number(total).toFixed(2)}`);
  }

  function renderSummary(){
    const income = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + Number(t.amount), 0);
    const balance = income - expense;

    totalIncomeEl && (totalIncomeEl.textContent = `₹${Number(income).toFixed(2)}`);
    totalExpenseEl && (totalExpenseEl.textContent = `₹${Number(expense).toFixed(2)}`);
    balanceEl && (balanceEl.textContent = `₹${Number(balance).toFixed(2)}`);
  }

  // ------------------ Analytics (charts) ------------------
  function renderAnalyticsCharts(){
    // Category-wise Expense (pie)
    const expenseByCategory = {};
    transactions.filter(t => t.type === 'Expense').forEach(t => {
      expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + Number(t.amount);
    });
    const catLabels = Object.keys(expenseByCategory);
    const catData = catLabels.map(l => Number(expenseByCategory[l].toFixed(2)));

    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    if(categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctxCat, {
      type: 'doughnut',
      data: { labels: catLabels, datasets: [{ data: catData, hoverOffset:6 }] },
      options: { plugins:{ legend:{ position:'bottom' } }, maintainAspectRatio:false }
    });

    // Monthly Income vs Expense (bar)
    // Collect months from transactions
    const monthsSet = new Set();
    transactions.forEach(t => monthsSet.add(t.date.slice(0,7)));
    const months = Array.from(monthsSet).sort();

    const incomeByMonth = {};
    const expenseByMonth = {};
    months.forEach(m => { incomeByMonth[m] = 0; expenseByMonth[m] = 0; });

    transactions.forEach(t => {
      const m = t.date.slice(0,7);
      if(t.type === 'Income') incomeByMonth[m] = (incomeByMonth[m] || 0) + Number(t.amount);
      else expenseByMonth[m] = (expenseByMonth[m] || 0) + Number(t.amount);
    });

    const monthLabels = months;
    const incomeData = monthLabels.map(m => Number((incomeByMonth[m] || 0).toFixed(2)));
    const expenseData = monthLabels.map(m => Number((expenseByMonth[m] || 0).toFixed(2)));

    const ctxComp = document.getElementById('monthlyComparisonChart').getContext('2d');
    if(monthlyComparisonChart) monthlyComparisonChart.destroy();
    monthlyComparisonChart = new Chart(ctxComp, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          { label: 'Income', data: incomeData, stack: 'stack1' },
          { label: 'Expense', data: expenseData, stack: 'stack1' }
        ]
      },
      options: {
        plugins:{ legend:{ position:'bottom' } },
        maintainAspectRatio:false,
        scales: { y: { beginAtZero:true } }
      }
    });
  }

  // ------------------ Filters ------------------
  function onClearFilters(){
    if(filterMonth) filterMonth.value = '';
    if(filterType) filterType.value = '';
    if(filterCategory) filterCategory.value = '';
    renderAll();
  }

  // ------------------ Export: Excel ------------------
  function exportExcel(){
    // Export filtered transactions (if on dashboard) else export all
    const isDashboard = !!document.getElementById('transactionsTbody');
    let rows = [['Date','Type','Category','Description','Amount']];

    if(isDashboard){
      // apply same filters as table
      const month = filterMonth && filterMonth.value;
      const typeF = filterType && filterType.value;
      const catF = filterCategory && filterCategory.value;
      const filtered = transactions.filter(t => {
        if(month && !t.date.startsWith(month)) return false
