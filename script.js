import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const db = window.db;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("transactionForm");
  const tbody = document.getElementById("transactionsTbody");
  const totalIncome = document.getElementById("totalIncome");
  const totalExpense = document.getElementById("totalExpense");
  const balance = document.getElementById("balance");

  async function loadTransactions() {
    tbody.innerHTML = "";
    let incomeSum = 0, expenseSum = 0;
    const q = query(collection(db, "transactions"), orderBy("date", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
      const t = docSnap.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${t.date}</td>
        <td>${t.type}</td>
        <td>${t.category}</td>
        <td>${t.description || "-"}</td>
        <td>₹${Number(t.amount).toFixed(2)}</td>
        <td><button data-id="${docSnap.id}" class="delete">🗑️</button></td>
      `;
      tbody.appendChild(row);
      if (t.type === "Income") incomeSum += Number(t.amount);
      else expenseSum += Number(t.amount);
    });

    totalIncome.textContent = `₹${incomeSum.toFixed(2)}`;
    totalExpense.textContent = `₹${expenseSum.toFixed(2)}`;
    balance.textContent = `₹${(incomeSum - expenseSum).toFixed(2)}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.getElementById("type").value;
    const date = document.getElementById("date").value;
    const category = document.getElementById("category").value;
    const description = document.getElementById("description").value;
    const amount = parseFloat(document.getElementById("amount").value);

    if (!date || !amount) return alert("Please fill required fields");

    await addDoc(collection(db, "transactions"), { type, date, category, description, amount });
    form.reset();
    loadTransactions();
  });

  tbody.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete")) {
      const id = e.target.dataset.id;
      if (confirm("Delete this transaction?")) {
        await deleteDoc(doc(db, "transactions", id));
        loadTransactions();
      }
    }
  });

  loadTransactions();
});
