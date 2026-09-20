/**
 * FINANCEVAULT - FINANCIAL CALCULATOR SUITE
 * Process-based financial calculations: Cash Reconciliation, EMI, Savings, and Investment SIP.
 */

class FinanceCalculatorSuite {
  constructor() {
    this.denominations = [500, 200, 100, 50, 20, 10, 5, 2, 1];
    this.cashCounts = {
      500: 0,
      200: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
      2: 0,
      1: 0
    };
  }

  // ==========================================
  // 1. CASH RECONCILIATION
  // ==========================================
  initCashReconciliation() {
    this.renderDenominationRows();
    this.bindReconEvents();
    this.calculateReconciliation();
  }

  renderDenominationRows() {
    const tbody = document.getElementById('denomination-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.denominations.map(denom => `
      <tr class="denom-row">
        <td class="denom-cell">
          <span class="denom-pill">₹ ${denom}</span>
        </td>
        <td class="denom-cell" style="text-align: center; color: #94A3B8; font-weight: 700;">×</td>
        <td class="denom-cell" style="text-align: center;">
          <input 
            type="number" 
            min="0" 
            id="denom-input-${denom}" 
            class="denom-input" 
            value="${this.cashCounts[denom]}" 
            placeholder="0"
            data-denom="${denom}"
          />
        </td>
        <td class="denom-cell" id="denom-total-${denom}">
          ₹ 0
        </td>
      </tr>
    `).join('');
  }

  bindReconEvents() {
    const inputs = document.querySelectorAll('.denom-input');
    inputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const denom = Number(e.target.dataset.denom);
        const qty = Math.max(0, parseInt(e.target.value) || 0);
        this.cashCounts[denom] = qty;
        
        // Update denomination total
        const rowTotal = denom * qty;
        const totalElem = document.getElementById(`denom-total-${denom}`);
        if (totalElem) {
          totalElem.textContent = window.financeStore.formatCurrency(rowTotal);
        }

        this.calculateReconciliation();
      });
    });

    // Inflow & Outflow inputs
    const reconInputs = [
      'recon-initial-fund',
      'recon-inflow-sales', 'recon-inflow-collections', 'recon-inflow-other', 'recon-inflow-additional',
      'recon-outflow-purchases', 'recon-outflow-transport', 'recon-outflow-food', 'recon-outflow-bills', 'recon-outflow-other'
    ];

    reconInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.calculateReconciliation());
      }
    });

    // Auto sync with system initial fund if requested
    const syncBtn = document.getElementById('recon-sync-system-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        const initFund = window.financeStore.data.initialFund;
        const collections = window.financeStore.getTotalCollected();
        const expenses = window.financeStore.getTotalExpenses();

        const initFundInput = document.getElementById('recon-initial-fund');
        const collectionsInput = document.getElementById('recon-inflow-collections');
        const expensesInput = document.getElementById('recon-outflow-other');

        if (initFundInput) initFundInput.value = initFund;
        if (collectionsInput) collectionsInput.value = collections;
        if (expensesInput) expensesInput.value = expenses;

        this.calculateReconciliation();
        if (window.app) window.app.showToast('Reconciliation synced with Live Dashboard!', 'success');
      });
    }

    // Reset button
    const resetBtn = document.getElementById('recon-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.denominations.forEach(d => {
          this.cashCounts[d] = 0;
          const input = document.getElementById(`denom-input-${d}`);
          if (input) input.value = 0;
          const totalElem = document.getElementById(`denom-total-${d}`);
          if (totalElem) totalElem.textContent = '₹ 0';
        });
        this.calculateReconciliation();
        if (window.app) window.app.showToast('Denominations reset to zero', 'info');
      });
    }
  }

  calculateReconciliation() {
    const getVal = (id) => Number(document.getElementById(id)?.value || 0);

    const initialFund = getVal('recon-initial-fund');

    // Inflows
    const sales = getVal('recon-inflow-sales');
    const collections = getVal('recon-inflow-collections');
    const otherInflow = getVal('recon-inflow-other');
    const additionalCash = getVal('recon-inflow-additional');
    const totalInflow = sales + collections + otherInflow + additionalCash;

    // Outflows
    const purchases = getVal('recon-outflow-purchases');
    const transport = getVal('recon-outflow-transport');
    const food = getVal('recon-outflow-food');
    const bills = getVal('recon-outflow-bills');
    const otherOutflow = getVal('recon-outflow-other');
    const totalOutflow = purchases + transport + food + bills + otherOutflow;

    // Expected Cash = Initial + Inflow - Outflow
    const expectedCash = initialFund + totalInflow - totalOutflow;

    // Actual Physical Cash from denomination count
    let actualCash = 0;
    this.denominations.forEach(denom => {
      actualCash += denom * (this.cashCounts[denom] || 0);
    });

    const difference = actualCash - expectedCash;

    // Update UI Elements
    const totalInflowEl = document.getElementById('recon-total-inflow');
    const totalOutflowEl = document.getElementById('recon-total-outflow');
    const expectedCashEl = document.getElementById('recon-expected-cash');
    const actualCashEl = document.getElementById('recon-actual-cash');
    const diffAmountEl = document.getElementById('recon-diff-amount');
    const statusCard = document.getElementById('recon-status-card');
    const statusBadge = document.getElementById('recon-status-badge');
    const statusMessage = document.getElementById('recon-status-message') || document.getElementById('status-message');

    if (totalInflowEl) totalInflowEl.textContent = window.financeStore.formatCurrency(totalInflow);
    if (totalOutflowEl) totalOutflowEl.textContent = window.financeStore.formatCurrency(totalOutflow);
    if (expectedCashEl) expectedCashEl.textContent = window.financeStore.formatCurrency(expectedCash);
    if (actualCashEl) actualCashEl.textContent = window.financeStore.formatCurrency(actualCash);

    if (statusCard && statusBadge && diffAmountEl && statusMessage) {
      statusCard.className = 'recon-status-card';

      if (Math.abs(difference) < 0.01) {
        statusCard.classList.add('recon-matched');
        statusBadge.textContent = '✓ CASH MATCHED';
        diffAmountEl.textContent = '₹ 0.00';
        statusMessage.textContent = 'Physical cash count perfectly matches expected book cash!';
      } else if (difference < 0) {
        statusCard.classList.add('recon-shortage');
        statusBadge.textContent = '⚠ CASH SHORTAGE';
        diffAmountEl.textContent = '- ' + window.financeStore.formatCurrency(Math.abs(difference));
        statusMessage.textContent = `Deficit of ${window.financeStore.formatCurrency(Math.abs(difference))} detected between drawer and ledger.`;
      } else {
        statusCard.classList.add('recon-excess');
        statusBadge.textContent = '★ CASH EXCESS';
        diffAmountEl.textContent = '+ ' + window.financeStore.formatCurrency(difference);
        statusMessage.textContent = `Surplus of ${window.financeStore.formatCurrency(difference)} recorded in cash drawer.`;
      }
    }
  }

  // ==========================================
  // 2. LOAN / EMI CALCULATOR
  // ==========================================
  initEmiCalculator() {
    const loanAmountInput = document.getElementById('emi-loan-amount');
    const loanAmountSlider = document.getElementById('emi-loan-amount-slider');
    const interestInput = document.getElementById('emi-interest');
    const interestSlider = document.getElementById('emi-interest-slider');
    const tenureInput = document.getElementById('emi-tenure');
    const tenureSlider = document.getElementById('emi-tenure-slider');
    const feeInput = document.getElementById('emi-fee');

    const syncSlider = (input, slider) => {
      if (!input || !slider) return;
      slider.addEventListener('input', (e) => {
        input.value = e.target.value;
        this.calculateEmi();
      });
      input.addEventListener('input', (e) => {
        slider.value = e.target.value;
        this.calculateEmi();
      });
    };

    syncSlider(loanAmountInput, loanAmountSlider);
    syncSlider(interestInput, interestSlider);
    syncSlider(tenureInput, tenureSlider);

    if (feeInput) {
      feeInput.addEventListener('input', () => this.calculateEmi());
    }

    this.calculateEmi();
  }

  calculateEmi() {
    const P = Number(document.getElementById('emi-loan-amount')?.value || 100000);
    const annualRate = Number(document.getElementById('emi-interest')?.value || 12);
    const N = Number(document.getElementById('emi-tenure')?.value || 12); // months
    const feePercent = Number(document.getElementById('emi-fee')?.value || 1);

    const r = (annualRate / 12) / 100; // monthly rate
    let emi = 0;
    
    if (r > 0) {
      emi = (P * r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);
    } else {
      emi = P / N;
    }

    const totalPayable = emi * N;
    const totalInterest = totalPayable - P;
    const processingFee = (P * feePercent) / 100;

    // Display
    const emiEl = document.getElementById('emi-monthly-result');
    const interestEl = document.getElementById('emi-interest-result');
    const totalEl = document.getElementById('emi-total-result');
    const feeEl = document.getElementById('emi-fee-result');

    if (emiEl) emiEl.textContent = window.financeStore.formatCurrency(Math.round(emi));
    if (interestEl) interestEl.textContent = window.financeStore.formatCurrency(Math.round(totalInterest));
    if (totalEl) totalEl.textContent = window.financeStore.formatCurrency(Math.round(totalPayable));
    if (feeEl) feeEl.textContent = window.financeStore.formatCurrency(Math.round(processingFee));
  }

  // ==========================================
  // 3. SAVINGS GOAL CALCULATOR
  // ==========================================
  initSavingsCalculator() {
    const incomeInput = document.getElementById('sav-income');
    const expenseInput = document.getElementById('sav-expense');
    const targetInput = document.getElementById('sav-target');

    [incomeInput, expenseInput, targetInput].forEach(el => {
      if (el) el.addEventListener('input', () => this.calculateSavings());
    });

    this.calculateSavings();
  }

  calculateSavings() {
    const income = Number(document.getElementById('sav-income')?.value || 50000);
    const expense = Number(document.getElementById('sav-expense')?.value || 30000);
    const target = Number(document.getElementById('sav-target')?.value || 200000);

    const monthlySavings = Math.max(0, income - expense);
    const monthsToGoal = monthlySavings > 0 ? Math.ceil(target / monthlySavings) : 0;
    const savingsRate = income > 0 ? ((monthlySavings / income) * 100).toFixed(1) : 0;

    const monthlyEl = document.getElementById('sav-monthly-result');
    const monthsEl = document.getElementById('sav-time-result');
    const rateEl = document.getElementById('sav-rate-result');

    if (monthlyEl) monthlyEl.textContent = window.financeStore.formatCurrency(monthlySavings);
    if (monthsEl) monthsEl.textContent = monthsToGoal > 0 ? `${monthsToGoal} Months (${(monthsToGoal / 12).toFixed(1)} Yrs)` : 'N/A';
    if (rateEl) rateEl.textContent = `${savingsRate}% of Income`;
  }

  // ==========================================
  // 4. INVESTMENT / SIP CALCULATOR
  // ==========================================
  initInvestmentCalculator() {
    const initialInput = document.getElementById('inv-initial');
    const sipInput = document.getElementById('inv-monthly');
    const rateInput = document.getElementById('inv-return');
    const yearsInput = document.getElementById('inv-years');

    [initialInput, sipInput, rateInput, yearsInput].forEach(el => {
      if (el) el.addEventListener('input', () => this.calculateInvestment());
    });

    this.calculateInvestment();
  }

  calculateInvestment() {
    const P = Number(document.getElementById('inv-initial')?.value || 10000);
    const PMT = Number(document.getElementById('inv-monthly')?.value || 5000);
    const annualRate = Number(document.getElementById('inv-return')?.value || 12);
    const years = Number(document.getElementById('inv-years')?.value || 5);

    const n = years * 12; // Total months
    const i = (annualRate / 100) / 12; // Monthly rate

    // Future Value of Initial Lumpsum
    const fvLumpsum = P * Math.pow(1 + i, n);

    // Future Value of SIP: PMT * [ ((1 + i)^n - 1) / i ] * (1 + i)
    let fvSIP = 0;
    if (i > 0) {
      fvSIP = PMT * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    } else {
      fvSIP = PMT * n;
    }

    const finalAmount = fvLumpsum + fvSIP;
    const totalInvested = P + (PMT * n);
    const totalReturns = Math.max(0, finalAmount - totalInvested);

    const investedEl = document.getElementById('inv-invested-result');
    const returnsEl = document.getElementById('inv-returns-result');
    const totalEl = document.getElementById('inv-total-result');

    if (investedEl) investedEl.textContent = window.financeStore.formatCurrency(Math.round(totalInvested));
    if (returnsEl) returnsEl.textContent = window.financeStore.formatCurrency(Math.round(totalReturns));
    if (totalEl) totalEl.textContent = window.financeStore.formatCurrency(Math.round(finalAmount));
  }
}

// Instantiate
window.financeCalculatorSuite = new FinanceCalculatorSuite();
