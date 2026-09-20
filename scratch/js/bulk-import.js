/**
 * FINANCEVAULT - BULK DATA IMPORT & DATA ENTRY ENGINE
 * Supports Excel (.xlsx, .xls), CSV (.csv), and JSON (.json) files.
 * Features automatic column detection, intelligent mapping, data validation,
 * duplicate handling, transactional batching, and reactive store updates.
 */

(function () {
  'use strict';

  // Canonical Field Dictionaries with Synonyms
  const FIELD_DICTIONARIES = {
    customers: [
      { key: 'name', label: 'Customer / Client Name', required: true, synonyms: ['name', 'customer name', 'client name', 'customer', 'full name', 'fullname', 'party', 'client', 'borrower'] },
      { key: 'rollNumber', label: 'Roll Number / Code', required: false, synonyms: ['roll number', 'roll no', 'roll', 'roll_no', 'rollno', 'account no', 'acc no', 'customer code', 'client code'] },
      { key: 'id', label: 'Customer ID', required: false, synonyms: ['customer id', 'cust id', 'client id', 'id', 'uid', 'customer_id'] },
      { key: 'phone', label: 'Phone / Mobile', required: false, synonyms: ['phone', 'mobile', 'contact', 'contact number', 'mobile number', 'cell', 'tel', 'phone number'] },
      { key: 'relativeName', label: 'Father / Guardian Name', required: false, synonyms: ['father name', 'father', 'guardian', 'relative name', 's/o', 'd/o', 'w/o', 'guardian name', 'parent'] },
      { key: 'email', label: 'Email Address', required: false, synonyms: ['email', 'e-mail', 'mail', 'email address'] },
      { key: 'address', label: 'Address / Location', required: false, synonyms: ['address', 'location', 'city', 'place', 'residence', 'area'] },
      { key: 'sector', label: 'Sector / Branch', required: false, synonyms: ['sector', 'sector name', 'branch', 'zone', 'sector id', 'division'] },
      { key: 'loanLimit', label: 'Credit / Loan Limit', required: false, type: 'number', synonyms: ['loan limit', 'limit', 'credit limit', 'max loan', 'sanction limit'] },
      { key: 'status', label: 'Status', required: false, synonyms: ['status', 'state', 'condition'] }
    ],
    loans: [
      { key: 'customerRef', label: 'Customer Roll No or ID', required: true, synonyms: ['customer roll', 'roll number', 'roll no', 'roll', 'customer id', 'cust id', 'client id', 'customer', 'customer name'] },
      { key: 'id', label: 'Loan Reference ID', required: false, synonyms: ['loan id', 'loan ref', 'ref id', 'loan_no', 'loan no', 'agreement no', 'loan number'] },
      { key: 'amount', label: 'Loan Principal Amount', required: true, type: 'number', synonyms: ['loan amount', 'principal', 'amount', 'disbursed amount', 'sanctioned amount', 'loan value'] },
      { key: 'interestRate', label: 'Interest Rate (% p.a.)', required: false, type: 'number', synonyms: ['interest rate', 'interest', 'roi', 'rate', 'interest %', 'annual rate'] },
      { key: 'tenureMonths', label: 'Tenure (Months)', required: false, type: 'number', synonyms: ['tenure', 'tenure months', 'duration', 'months', 'period', 'term', 'tenure (m)'] },
      { key: 'disbursementDate', label: 'Disbursement Date', required: false, synonyms: ['loan date', 'disbursement date', 'disbursed date', 'date', 'issue date', 'start date'] },
      { key: 'paymentMethod', label: 'Disbursement Method', required: false, synonyms: ['payment method', 'method', 'disbursement method', 'mode', 'payout method'] },
      { key: 'notes', label: 'Notes / Purpose', required: false, synonyms: ['notes', 'remarks', 'purpose', 'description', 'comment'] },
      { key: 'status', label: 'Loan Status', required: false, synonyms: ['status', 'loan status'] }
    ],
    payments: [
      { key: 'customerRef', label: 'Customer Roll No or ID', required: false, synonyms: ['customer roll', 'roll number', 'roll no', 'customer id', 'cust id', 'customer'] },
      { key: 'loanId', label: 'Loan Reference ID', required: true, synonyms: ['loan id', 'loan ref', 'loan_no', 'loan number', 'ref id'] },
      { key: 'amount', label: 'Payment Amount', required: true, type: 'number', synonyms: ['payment amount', 'amount', 'paid amount', 'collected amount', 'installment', 'collection'] },
      { key: 'date', label: 'Payment Date', required: false, synonyms: ['payment date', 'date', 'collection date', 'txn date', 'receipt date'] },
      { key: 'method', label: 'Payment Method', required: false, synonyms: ['payment method', 'method', 'mode', 'payment mode'] },
      { key: 'reference', label: 'Reference / UTR ID', required: false, synonyms: ['reference', 'ref', 'transaction id', 'txn id', 'utr', 'utr number', 'cheque no'] },
      { key: 'notes', label: 'Notes / Remarks', required: false, synonyms: ['notes', 'remarks', 'description', 'comment'] }
    ],
    expenses: [
      { key: 'id', label: 'Expense ID', required: false, synonyms: ['expense id', 'voucher id', 'id', 'ref'] },
      { key: 'category', label: 'Category', required: true, synonyms: ['category', 'expense type', 'type', 'head', 'expense category'] },
      { key: 'description', label: 'Description', required: true, synonyms: ['description', 'desc', 'details', 'item', 'purpose', 'title'] },
      { key: 'amount', label: 'Expense Amount', required: true, type: 'number', synonyms: ['amount', 'expense amount', 'cost', 'total', 'bill amount'] },
      { key: 'date', label: 'Expense Date', required: false, synonyms: ['date', 'expense date', 'bill date'] },
      { key: 'method', label: 'Payment Method', required: false, synonyms: ['payment method', 'method', 'mode', 'paid via'] },
      { key: 'notes', label: 'Notes', required: false, synonyms: ['notes', 'remarks', 'memo'] }
    ]
  };

  class BulkImportManager {
    constructor() {
      this.currentCategory = 'auto'; // 'auto' | 'customers' | 'loans' | 'payments' | 'expenses'
      this.duplicateStrategy = 'skip'; // 'skip' | 'update' | 'import_new'
      this.parsedData = null; // { rawHeaders: [], rows: [], detectedCategory: '' }
      this.mappedFields = {}; // { rawHeader: canonicalKey }
      this.validationResults = null; // { valid: [], warnings: [], errors: [], duplicates: [] }
      this.isProcessing = false;
    }

    /* ============================================================
       MODAL CONTROLLERS
       ============================================================ */
    openImportModal() {
      this.resetState();
      this.showStep(1);
      if (window.app && typeof window.app.openModal === 'function') {
        window.app.openModal('bulk-import-modal');
      } else {
        const m = document.getElementById('bulk-import-modal');
        if (m) m.classList.add('active');
      }
    }

    closeImportModal() {
      if (this.isProcessing) {
        if (!confirm('An import is currently processing. Are you sure you want to cancel?')) return;
      }
      if (window.app && typeof window.app.closeModal === 'function') {
        window.app.closeModal('bulk-import-modal');
      } else {
        const m = document.getElementById('bulk-import-modal');
        if (m) m.classList.remove('active');
      }
      this.resetState();
    }

    openTemplateModal() {
      if (window.app && typeof window.app.openModal === 'function') {
        window.app.openModal('import-template-modal');
      } else {
        const m = document.getElementById('import-template-modal');
        if (m) m.classList.add('active');
      }
    }

    closeTemplateModal() {
      if (window.app && typeof window.app.closeModal === 'function') {
        window.app.closeModal('import-template-modal');
      } else {
        const m = document.getElementById('import-template-modal');
        if (m) m.classList.remove('active');
      }
    }

    resetState() {
      this.parsedData = null;
      this.mappedFields = {};
      this.validationResults = null;
      this.isProcessing = false;
      const fileInput = document.getElementById('bulk-file-input');
      if (fileInput) fileInput.value = '';
      const prog = document.getElementById('import-progress-bar');
      if (prog) prog.style.width = '0%';
    }

    showStep(stepNum) {
      for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`import-step-${i}`);
        if (el) el.style.display = i === stepNum ? 'block' : 'none';
      }
      // Step indicator pills
      document.querySelectorAll('.import-step-pill').forEach(pill => {
        const s = Number(pill.dataset.step);
        pill.classList.toggle('active', s === stepNum);
        pill.classList.toggle('completed', s < stepNum);
      });

      // Footer buttons
      const backBtn = document.getElementById('import-back-btn');
      const confirmBtn = document.getElementById('import-confirm-btn');
      const doneBtn = document.getElementById('import-done-btn');
      if (backBtn) backBtn.style.display = stepNum === 2 ? 'inline-flex' : 'none';
      if (confirmBtn) confirmBtn.style.display = stepNum === 2 ? 'inline-flex' : 'none';
      if (doneBtn) doneBtn.style.display = stepNum === 4 ? 'inline-flex' : 'none';
    }

    /* ============================================================
       FILE PARSING
       ============================================================ */
    handleFileDrop(e) {
      e.preventDefault();
      const dropZone = document.getElementById('import-drop-zone');
      if (dropZone) dropZone.classList.remove('drag-over');
      const files = e.dataTransfer ? e.dataTransfer.files : null;
      if (files && files.length > 0) {
        this.processFile(files[0]);
      }
    }

    handleFileSelect(e) {
      const files = e.target.files;
      if (files && files.length > 0) {
        this.processFile(files[0]);
      }
    }

    processFile(file) {
      if (!file) return;
      const name = file.name || '';
      const ext = name.split('.').pop().toLowerCase();

      if (!['csv', 'xlsx', 'xls', 'json'].includes(ext)) {
        if (window.app) window.app.showToast('Unsupported format. Please upload .xlsx, .xls, .csv, or .json', 'error');
        return;
      }

      const statusEl = document.getElementById('file-upload-status');
      if (statusEl) {
        statusEl.innerHTML = `<strong>Reading ${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB)...`;
      }

      if (ext === 'json') {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            this.handleJsonData(data, file.name);
          } catch (err) {
            if (window.app) window.app.showToast('Invalid JSON file: ' + err.message, 'error');
          }
        };
        reader.readAsText(file);
      } else if (ext === 'csv') {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const text = evt.target.result;
            this.handleCsvData(text, file.name);
          } catch (err) {
            if (window.app) window.app.showToast('Failed to read CSV: ' + err.message, 'error');
          }
        };
        reader.readAsText(file);
      } else if (ext === 'xlsx' || ext === 'xls') {
        if (typeof XLSX === 'undefined') {
          if (window.app) window.app.showToast('Excel parser (SheetJS) is loading. Please try again in a moment or upload as CSV.', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            this.handleExcelData(workbook, file.name);
          } catch (err) {
            if (window.app) window.app.showToast('Failed to parse Excel file: ' + err.message, 'error');
          }
        };
        reader.readAsArrayBuffer(file);
      }
    }

    handleCsvData(text, fileName) {
      const rows = this.parseCsvText(text);
      if (!rows || rows.length < 2) {
        if (window.app) window.app.showToast('CSV file is empty or has no data rows.', 'error');
        return;
      }
      const rawHeaders = rows[0].map(h => String(h || '').trim());
      const dataRows = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0 || (row.length === 1 && !row[0])) continue;
        const obj = {};
        rawHeaders.forEach((h, colIdx) => {
          obj[h] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
        });
        dataRows.push(obj);
      }
      this.prepareParsedData(rawHeaders, dataRows, fileName);
    }

    handleExcelData(workbook, fileName) {
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
      if (!json || json.length === 0) {
        if (window.app) window.app.showToast('Excel sheet is empty.', 'error');
        return;
      }
      const rawHeaders = Object.keys(json[0]);
      this.prepareParsedData(rawHeaders, json, fileName);
    }

    handleJsonData(data, fileName) {
      // If object with { customers: [], loans: [], ... }
      if (!Array.isArray(data) && typeof data === 'object') {
        const categories = ['customers', 'loans', 'payments', 'expenses'];
        for (const cat of categories) {
          if (Array.isArray(data[cat]) && data[cat].length > 0) {
            const rawHeaders = Object.keys(data[cat][0]);
            this.prepareParsedData(rawHeaders, data[cat], fileName, cat);
            return;
          }
        }
        if (window.app) window.app.showToast('No recognizable arrays found in JSON.', 'error');
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        const rawHeaders = Object.keys(data[0]);
        this.prepareParsedData(rawHeaders, data, fileName);
      } else {
        if (window.app) window.app.showToast('JSON array is empty.', 'error');
      }
    }

    parseCsvText(text) {
      // Auto-detect delimiter: comma, semicolon, or tab
      const firstLine = text.split('\n')[0] || '';
      let delim = ',';
      if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) delim = ';';
      else if ((firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length) delim = '\t';

      const lines = [];
      let row = [];
      let inQuotes = false;
      let field = '';

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            field += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delim && !inQuotes) {
          row.push(field);
          field = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
          if (char === '\r' && nextChar === '\n') i++;
          row.push(field);
          lines.push(row);
          row = [];
          field = '';
        } else {
          field += char;
        }
      }
      if (field || row.length > 0) {
        row.push(field);
        lines.push(row);
      }
      return lines;
    }

    /* ============================================================
       CATEGORY DETECTION & AUTOMATIC COLUMN MAPPING
       ============================================================ */
    prepareParsedData(rawHeaders, dataRows, fileName, forcedCategory = null) {
      const detectedCat = forcedCategory || this.detectCategory(rawHeaders);
      this.currentCategory = detectedCat;
      this.parsedData = {
        fileName,
        rawHeaders,
        rows: dataRows,
        category: detectedCat
      };

      // Perform automatic column mapping
      this.mappedFields = this.autoMapColumns(rawHeaders, detectedCat);

      // Validate data
      this.validateAllRows();

      // Render Step 2: Mapping & Preview
      this.renderMappingAndPreview();
      this.showStep(2);
    }

    detectCategory(rawHeaders) {
      const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const scores = { customers: 0, loans: 0, payments: 0, expenses: 0 };

      // Check customer clues
      if (normalizedHeaders.some(h => ['customername', 'clientname', 'fathername', 'rollno', 'rollnumber', 'borrower'].includes(h))) scores.customers += 6;
      if (normalizedHeaders.some(h => ['loanlimit', 'creditlimit', 'address', 'dob', 'guardian'].includes(h))) scores.customers += 3;
      if (normalizedHeaders.some(h => ['sector', 'branch', 'relative'].includes(h))) scores.customers += 2;

      // Check loan clues
      if (normalizedHeaders.some(h => ['loanamount', 'principal', 'sanctionedamount', 'loanvalue'].includes(h))) scores.loans += 7;
      if (normalizedHeaders.some(h => ['interestrate', 'interest', 'roi', 'tenure', 'tenuremonths', 'disbursementdate'].includes(h))) scores.loans += 4;
      if (normalizedHeaders.some(h => ['loanid', 'loanref'].includes(h))) scores.loans += 2;

      // Check payment clues
      if (normalizedHeaders.some(h => ['paymentamount', 'paidamount', 'collectedamount', 'installment', 'collection'].includes(h))) scores.payments += 8;
      if (normalizedHeaders.some(h => ['receiptdate', 'paymentdate', 'collectiondate'].includes(h))) scores.payments += 5;
      if (normalizedHeaders.some(h => ['reference', 'utr', 'referenceid', 'utrnumber', 'chequeno'].includes(h))) scores.payments += 4;

      // Check expense clues
      if (normalizedHeaders.some(h => ['expenseid', 'voucherid', 'expensetype'].includes(h))) scores.expenses += 7;
      if (normalizedHeaders.some(h => ['category', 'billamount', 'cost'].includes(h))) scores.expenses += 4;
      if (normalizedHeaders.some(h => ['description', 'item', 'purpose'].includes(h)) && !normalizedHeaders.includes('customername')) scores.expenses += 3;

      let bestCat = 'customers';
      let maxScore = -1;
      for (const [cat, sc] of Object.entries(scores)) {
        if (sc > maxScore) {
          maxScore = sc;
          bestCat = cat;
        }
      }
      return bestCat;
    }

    autoMapColumns(rawHeaders, category) {
      const dictionary = FIELD_DICTIONARIES[category] || [];
      const mapping = {};

      rawHeaders.forEach(rawHeader => {
        const norm = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
        let matchedKey = '';

        // Pass 1: Exact matches on key or synonyms (Highest priority)
        for (const field of dictionary) {
          if (norm === field.key.toLowerCase().replace(/[^a-z0-9]/g, '')) {
            matchedKey = field.key;
            break;
          }
          const exactSyn = field.synonyms.some(syn => {
            return norm === syn.toLowerCase().replace(/[^a-z0-9]/g, '');
          });
          if (exactSyn) {
            matchedKey = field.key;
            break;
          }
        }

        // Pass 2: Containment for descriptive variations (Fallback)
        if (!matchedKey) {
          for (const field of dictionary) {
            const partialSyn = field.synonyms.some(syn => {
              const normSyn = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normSyn.length < 4) return false;
              return norm.startsWith(normSyn) || normSyn.startsWith(norm);
            });
            if (partialSyn) {
              matchedKey = field.key;
              break;
            }
          }
        }

        mapping[rawHeader] = matchedKey;
      });

      return mapping;
    }

    /* ============================================================
       DATA VALIDATION ENGINE
       ============================================================ */
    validateAllRows() {
      if (!this.parsedData) return;
      const { rows, category } = this.parsedData;
      const store = window.financeStore;
      const existingCustomers = store ? store.data.customers || [] : [];
      const existingLoans = store ? store.data.loans || [] : [];

      const valid = [];
      const warnings = [];
      const errors = [];
      const duplicates = [];

      // Pre-index existing roll numbers, customer IDs, loan IDs
      const existingRollMap = new Set(existingCustomers.map(c => (c.rollNumber || '').replace(/^#/, '').toUpperCase()));
      const existingCustIdMap = new Set(existingCustomers.map(c => c.id));
      const existingLoanIdMap = new Set(existingLoans.map(l => l.id));

      rows.forEach((rawRow, idx) => {
        const rowNum = idx + 1;
        const rowErrors = [];
        const rowWarnings = [];

        // Build normalized item using current column mapping
        const item = {};
        for (const [rawHeader, canonicalKey] of Object.entries(this.mappedFields)) {
          if (canonicalKey) {
            item[canonicalKey] = rawRow[rawHeader];
          }
        }

        // Category-Specific Validations
        if (category === 'customers') {
          const name = String(item.name || '').trim();
          if (!name) {
            rowErrors.push('Customer Name is required');
          }

          const roll = String(item.rollNumber || '').replace(/^#/, '').trim().toUpperCase();
          if (roll && existingRollMap.has(roll)) {
            duplicates.push(rowNum);
            rowWarnings.push(`Existing customer with Roll #${roll}`);
          }

          const limit = item.loanLimit !== undefined && item.loanLimit !== '' ? Number(item.loanLimit) : null;
          if (limit !== null && (isNaN(limit) || limit < 0)) {
            rowErrors.push('Credit limit must be a positive number');
          }
        } else if (category === 'loans') {
          const custRef = String(item.customerRef || '').replace(/^#/, '').trim().toUpperCase();
          if (!custRef) {
            rowErrors.push('Customer reference (Roll No or ID) is required');
          } else {
            const foundCust = existingCustomers.find(c =>
              c.id === custRef ||
              (c.rollNumber && c.rollNumber.replace(/^#/, '').toUpperCase() === custRef) ||
              (c.name && c.name.toUpperCase() === custRef)
            );
            if (!foundCust) {
              rowWarnings.push(`Customer "${custRef}" not found in current books; will create placeholder`);
            }
          }

          const amount = Number(item.amount);
          if (isNaN(amount) || amount <= 0) {
            rowErrors.push('Loan amount must be greater than zero');
          }

          const loanId = String(item.id || '').trim();
          if (loanId && existingLoanIdMap.has(loanId)) {
            duplicates.push(rowNum);
            rowWarnings.push(`Loan ID "${loanId}" already exists`);
          }
        } else if (category === 'payments') {
          const amount = Number(item.amount);
          if (isNaN(amount) || amount <= 0) {
            rowErrors.push('Payment amount must be greater than zero');
          }

          const loanId = String(item.loanId || '').trim();
          if (!loanId) {
            rowErrors.push('Loan Reference ID is required');
          } else {
            const loan = existingLoans.find(l => l.id === loanId);
            if (!loan) {
              rowErrors.push(`Referenced Loan "${loanId}" not found in database`);
            } else {
              const out = Math.max(0, Number(loan.outstandingAmount || 0));
              if (amount > out) {
                rowErrors.push(`Payment amount (${amount}) exceeds loan outstanding (${out})`);
              }
            }
          }
        } else if (category === 'expenses') {
          const cat = String(item.category || '').trim();
          if (!cat) rowErrors.push('Category is required');

          const desc = String(item.description || '').trim();
          if (!desc) rowErrors.push('Description is required');

          const amount = Number(item.amount);
          if (isNaN(amount) || amount <= 0) {
            rowErrors.push('Expense amount must be greater than zero');
          }
        }

        const resultObj = {
          rowNum,
          rawRow,
          mappedItem: item,
          errors: rowErrors,
          warnings: rowWarnings,
          isValid: rowErrors.length === 0,
          isDuplicate: duplicates.includes(rowNum)
        };

        if (rowErrors.length > 0) {
          errors.push(resultObj);
        } else if (rowWarnings.length > 0) {
          warnings.push(resultObj);
          valid.push(resultObj);
        } else {
          valid.push(resultObj);
        }
      });

      this.validationResults = {
        total: rows.length,
        valid,
        warnings,
        errors,
        duplicates
      };
    }

    /* ============================================================
       UI RENDERING: STEP 2 (MAPPING & PREVIEW)
       ============================================================ */
    renderMappingAndPreview() {
      if (!this.parsedData || !this.validationResults) return;
      const { fileName, rawHeaders, rows, category } = this.parsedData;
      const { total, valid, warnings, errors, duplicates } = this.validationResults;

      // 1. Meta Badges
      const metaEl = document.getElementById('import-file-meta');
      if (metaEl) {
        metaEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <span class="status-pill status-active" style="text-transform:uppercase;font-weight:800;">${category}</span>
            <span style="font-weight:800;color:var(--navy-900);">${fileName}</span>
            <span style="color:var(--text-muted);font-size:0.8rem;">(${total.toLocaleString()} rows detected)</span>
          </div>
        `;
      }

      // 2. Validation Stats Strip
      const statsEl = document.getElementById('import-validation-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="import-stat-chip import-stat-total">
            <span class="import-stat-val">${total.toLocaleString()}</span>
            <span class="import-stat-lbl">Total Rows</span>
          </div>
          <div class="import-stat-chip import-stat-valid">
            <span class="import-stat-val">${valid.length.toLocaleString()}</span>
            <span class="import-stat-lbl">Ready to Import</span>
          </div>
          <div class="import-stat-chip import-stat-warn">
            <span class="import-stat-val">${warnings.length.toLocaleString()}</span>
            <span class="import-stat-lbl">Warnings / Dupes</span>
          </div>
          <div class="import-stat-chip import-stat-error">
            <span class="import-stat-val">${errors.length.toLocaleString()}</span>
            <span class="import-stat-lbl">Invalid Rows</span>
          </div>
        `;
      }

      // 3. Category Selector Dropdown
      const catSelect = document.getElementById('import-category-select');
      if (catSelect) {
        catSelect.value = category;
        catSelect.onchange = (e) => {
          this.currentCategory = e.target.value;
          this.parsedData.category = e.target.value;
          this.mappedFields = this.autoMapColumns(this.parsedData.rawHeaders, e.target.value);
          this.validateAllRows();
          this.renderMappingAndPreview();
        };
      }

      // 4. Duplicate Strategy Selector
      const dupSelect = document.getElementById('import-duplicate-select');
      if (dupSelect) {
        dupSelect.value = this.duplicateStrategy;
        dupSelect.onchange = (e) => {
          this.duplicateStrategy = e.target.value;
        };
      }

      // 5. Column Mapping Dropdowns Table
      const mappingTableBody = document.getElementById('import-mapping-tbody');
      if (mappingTableBody) {
        const dictionary = FIELD_DICTIONARIES[category] || [];
        mappingTableBody.innerHTML = rawHeaders.map(rawHeader => {
          const currentTarget = this.mappedFields[rawHeader] || '';
          const sampleVal = rows[0] ? rows[0][rawHeader] : '';

          const optionsHtml = [
            '<option value="">-- Ignore Column --</option>',
            ...dictionary.map(f => `
              <option value="${f.key}" ${currentTarget === f.key ? 'selected' : ''}>
                ${f.label} ${f.required ? '*' : ''}
              </option>
            `)
          ].join('');

          return `
            <tr>
              <td style="font-weight:700;color:var(--navy-900);font-family:var(--font-mono);font-size:0.85rem;">${rawHeader}</td>
              <td style="font-size:0.8rem;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                "${sampleVal || '—'}"
              </td>
              <td>
                <select class="form-input" style="padding:6px 10px;font-size:0.82rem;" onchange="window.bulkImportManager.onColumnRemap('${rawHeader.replace(/'/g, "\\'")}', this.value)">
                  ${optionsHtml}
                </select>
              </td>
            </tr>
          `;
        }).join('');
      }

      // 6. Preview Table (first 10 rows)
      this.renderPreviewTable();

      // 7. Error List Accordion
      const errBox = document.getElementById('import-error-list-container');
      if (errBox) {
        if (errors.length === 0) {
          errBox.innerHTML = `
            <div style="padding:12px 16px;background:#F0FDF4;border-radius:8px;color:#166534;font-size:0.82rem;font-weight:700;display:flex;align-items:center;gap:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              All rows passed initial validation and are ready to import!
            </div>
          `;
        } else {
          const errRowsHtml = errors.slice(0, 10).map(err => `
            <div style="padding:8px 12px;background:#FEF2F2;border-left:3px solid #DC2626;border-radius:4px;margin-bottom:6px;font-size:0.8rem;">
              <strong>Row ${err.rowNum}:</strong> ${err.errors.join(' &bull; ')}
            </div>
          `).join('');

          errBox.innerHTML = `
            <div style="margin-bottom:8px;font-size:0.82rem;font-weight:800;color:#DC2626;">
              ${errors.length} rows contain validation errors (they will be skipped during import):
            </div>
            ${errRowsHtml}
            ${errors.length > 10 ? `<div style="font-size:0.75rem;color:var(--text-muted);font-style:italic;">...and ${errors.length - 10} more rows</div>` : ''}
          `;
        }
      }

      // 8. Confirm Button State
      const confirmBtn = document.getElementById('import-confirm-btn');
      if (confirmBtn) {
        confirmBtn.disabled = valid.length === 0;
        confirmBtn.innerHTML = `Confirm Import (${valid.length.toLocaleString()} records)`;
      }
    }

    onColumnRemap(rawHeader, newKey) {
      this.mappedFields[rawHeader] = newKey;
      this.validateAllRows();
      this.renderMappingAndPreview();
    }

    renderPreviewTable() {
      const thead = document.getElementById('import-preview-thead');
      const tbody = document.getElementById('import-preview-tbody');
      if (!thead || !tbody || !this.parsedData) return;

      const { rawHeaders, rows } = this.parsedData;
      const previewRows = rows.slice(0, 12);

      thead.innerHTML = `
        <tr>
          <th style="width:50px;">#</th>
          <th>Status</th>
          ${rawHeaders.map(h => {
            const mappedKey = this.mappedFields[h];
            return `<th>${h} ${mappedKey ? `<span style="font-size:0.65rem;color:var(--primary);display:block;">&rarr; ${mappedKey}</span>` : ''}</th>`;
          }).join('')}
        </tr>
      `;

      tbody.innerHTML = previewRows.map((row, idx) => {
        const rowNum = idx + 1;
        const isErr = this.validationResults.errors.some(e => e.rowNum === rowNum);
        const isWarn = this.validationResults.warnings.some(w => w.rowNum === rowNum);

        let statusBadge = '<span class="status-pill status-active" style="padding:2px 8px;font-size:0.7rem;">✓ Valid</span>';
        if (isErr) {
          statusBadge = '<span class="status-pill status-overdue" style="padding:2px 8px;font-size:0.7rem;">✕ Error</span>';
        } else if (isWarn) {
          statusBadge = '<span class="status-pill status-completed" style="padding:2px 8px;font-size:0.7rem;background:#FEF3C7;color:#92400E;">⚠ Warning</span>';
        }

        return `
          <tr style="${isErr ? 'background:rgba(254,242,242,0.5);' : ''}">
            <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">${rowNum}</td>
            <td>${statusBadge}</td>
            ${rawHeaders.map(h => `<td style="font-size:0.8rem;white-space:nowrap;">${row[h] !== undefined ? row[h] : ''}</td>`).join('')}
          </tr>
        `;
      }).join('');
    }

    /* ============================================================
       BATCH IMPORT EXECUTION
       ============================================================ */
    async executeImport() {
      if (!this.validationResults || this.validationResults.valid.length === 0) return;
      this.isProcessing = true;
      this.showStep(3);

      const itemsToImport = this.validationResults.valid;
      const total = itemsToImport.length;
      const store = window.financeStore;
      const category = this.parsedData.category;
      const strategy = this.duplicateStrategy;

      const progressFill = document.getElementById('import-progress-fill');
      const progressText = document.getElementById('import-progress-text');
      const progressSub = document.getElementById('import-progress-sub');

      let importedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const summaryErrors = [];

      const counts = {
        customers: 0,
        loans: 0,
        payments: 0,
        expenses: 0
      };

      const BATCH_SIZE = 50;
      const totalBatches = Math.ceil(total / BATCH_SIZE);

      for (let b = 0; b < totalBatches; b++) {
        const start = b * BATCH_SIZE;
        const chunk = itemsToImport.slice(start, start + BATCH_SIZE);

        // Process chunk
        for (const record of chunk) {
          const { rowNum, mappedItem } = record;
          try {
            if (category === 'customers') {
              const res = this._importCustomer(mappedItem, strategy, store);
              if (res === 'skipped') skippedCount++;
              else { importedCount++; counts.customers++; }
            } else if (category === 'loans') {
              const res = this._importLoan(mappedItem, strategy, store);
              if (res === 'skipped') skippedCount++;
              else { importedCount++; counts.loans++; }
            } else if (category === 'payments') {
              const res = this._importPayment(mappedItem, store);
              if (res === 'skipped') skippedCount++;
              else { importedCount++; counts.payments++; }
            } else if (category === 'expenses') {
              const res = this._importExpense(mappedItem, store);
              if (res === 'skipped') skippedCount++;
              else { importedCount++; counts.expenses++; }
            }
          } catch (err) {
            errorCount++;
            summaryErrors.push(`Row ${rowNum}: ${err.message}`);
          }
        }

        // Update progress UI
        const processed = Math.min(total, (b + 1) * BATCH_SIZE);
        const pct = Math.round((processed / total) * 100);
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `${pct}% (${processed.toLocaleString()} / ${total.toLocaleString()})`;
        if (progressSub) progressSub.textContent = `Batch ${b + 1} of ${totalBatches} completed...`;

        // Give breathing room to browser UI thread
        await new Promise(r => setTimeout(r, 16));
      }

      // Add pre-validation errors to summary count
      errorCount += this.validationResults.errors.length;
      this.validationResults.errors.forEach(e => {
        summaryErrors.push(`Row ${e.rowNum}: ${e.errors.join('; ')}`);
      });

      // Save & Notify Store
      store.saveData();
      store.notify();

      this.isProcessing = false;
      this.renderSummary({
        total: this.parsedData.rows.length,
        importedCount,
        skippedCount,
        errorCount,
        counts,
        errors: summaryErrors
      });
      this.showStep(4);
    }

    _importCustomer(item, strategy, store) {
      const customers = store.data.customers || [];
      const roll = (item.rollNumber || '').replace(/^#/, '').trim().toUpperCase();
      const existingIdx = roll
        ? customers.findIndex(c => (c.rollNumber || '').replace(/^#/, '').trim().toUpperCase() === roll)
        : -1;

      if (existingIdx !== -1) {
        if (strategy === 'skip') return 'skipped';
        if (strategy === 'update') {
          const target = customers[existingIdx];
          if (item.name) { target.name = item.name; target.fullName = item.name; }
          if (item.phone) target.phone = item.phone;
          if (item.email) target.email = item.email;
          if (item.address) target.address = item.address;
          if (item.relativeName) target.relativeName = item.relativeName;
          if (item.loanLimit) target.loanLimit = Number(item.loanLimit);
          return 'updated';
        }
      }

      // Generate unique customer ID
      const secId = (store.data.sectors && store.data.sectors[0]) ? store.data.sectors[0].id : 'SEC-001';
      const custId = item.id || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
      const assignedRoll = roll || (store.generateNextRollNumber ? store.generateNextRollNumber(secId) : `C${customers.length + 1}`);

      const newCustomer = {
        id: custId,
        customerId: custId,
        rollNumber: assignedRoll,
        fullName: item.name,
        name: item.name,
        relativeName: item.relativeName || '',
        phone: item.phone || '',
        email: item.email || '',
        address: item.address || '',
        sectorId: secId,
        loanLimit: item.loanLimit ? Number(item.loanLimit) : 25000,
        status: item.status || 'ACTIVE',
        createdAt: new Date().toISOString().split('T')[0],
        outstandingAmount: 0
      };

      customers.unshift(newCustomer);
      return 'created';
    }

    _importLoan(item, strategy, store) {
      const loans = store.data.loans || [];
      const customers = store.data.customers || [];
      const custRef = String(item.customerRef || '').replace(/^#/, '').trim().toUpperCase();

      let customer = customers.find(c =>
        c.id === custRef ||
        (c.rollNumber && c.rollNumber.replace(/^#/, '').toUpperCase() === custRef) ||
        (c.name && c.name.toUpperCase() === custRef)
      );

      // Create placeholder customer if none exists
      if (!customer) {
        customer = {
          id: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
          rollNumber: custRef,
          fullName: `Client ${custRef}`,
          name: `Client ${custRef}`,
          phone: '',
          sectorId: (store.data.sectors && store.data.sectors[0]) ? store.data.sectors[0].id : 'SEC-001',
          loanLimit: 50000,
          status: 'ACTIVE',
          createdAt: new Date().toISOString().split('T')[0],
          outstandingAmount: 0
        };
        customers.unshift(customer);
      }

      const loanId = item.id || `LN-${Math.floor(10000 + Math.random() * 90000)}`;
      const existingIdx = loans.findIndex(l => l.id === loanId);
      if (existingIdx !== -1) {
        if (strategy === 'skip') return 'skipped';
        if (strategy === 'update') {
          loans[existingIdx].amount = Number(item.amount || loans[existingIdx].amount);
          loans[existingIdx].notes = item.notes || loans[existingIdx].notes;
          return 'updated';
        }
      }

      const amount = Number(item.amount);
      const newLoan = {
        id: loanId,
        customerId: customer.id,
        customerName: customer.fullName || customer.name,
        sectorId: customer.sectorId,
        amount,
        paidAmount: 0,
        outstandingAmount: amount,
        creditBalance: 0,
        interestRate: item.interestRate ? Number(item.interestRate) : 12,
        tenureMonths: item.tenureMonths ? Number(item.tenureMonths) : 12,
        disbursementDate: item.disbursementDate || new Date().toISOString().split('T')[0],
        paymentMethod: item.paymentMethod || 'Bank Transfer',
        notes: item.notes || 'Bulk imported loan disbursement',
        status: 'ACTIVE'
      };

      loans.unshift(newLoan);

      // Recalculate customer's outstanding amount
      customer.outstandingAmount = (customer.outstandingAmount || 0) + amount;
      customer.status = 'ACTIVE';
      if (!customer.loanId) customer.loanId = loanId;

      return 'created';
    }

    _importPayment(item, store) {
      const loan = (store.data.loans || []).find(l => l.id === item.loanId);
      if (!loan) throw new Error(`Loan ${item.loanId} not found`);

      const amount = Number(item.amount);
      const date = item.date || new Date().toISOString().split('T')[0];
      const method = item.method || 'Cash';
      const reference = item.reference || '';
      const notes = item.notes || 'Bulk imported payment';

      // Use safe store payment method
      return store.recordClientPayment({
        customerId: loan.customerId,
        loanId: loan.id,
        amount,
        date,
        method,
        reference,
        notes
      });
    }

    _importExpense(item, store) {
      return store.addExpense({
        category: item.category || 'Operations',
        description: item.description || 'Imported expense',
        amount: Number(item.amount),
        date: item.date || new Date().toISOString().split('T')[0],
        method: item.method || 'Cash',
        notes: item.notes || ''
      });
    }

    /* ============================================================
       UI RENDERING: STEP 4 (SUMMARY)
       ============================================================ */
    renderSummary(summary) {
      const cont = document.getElementById('import-summary-container');
      if (!cont) return;

      const { total, importedCount, skippedCount, errorCount, counts, errors } = summary;

      cont.innerHTML = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:60px;height:60px;border-radius:50%;background:#DCFCE7;color:#16A34A;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h3 style="font-size:1.35rem;font-weight:900;color:var(--navy-900);margin:0 0 4px 0;">Import Completed Successfully</h3>
          <p style="font-size:0.85rem;color:var(--text-muted);margin:0;">Your microfi books, calculations and Transaction History are now fully updated.</p>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px;margin-bottom:24px;">
          <div class="card" style="padding:14px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:900;color:#059669;font-family:var(--font-mono);">${importedCount.toLocaleString()}</div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-top:2px;">Successfully Imported</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:900;color:#EA580C;font-family:var(--font-mono);">${skippedCount.toLocaleString()}</div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-top:2px;">Duplicates Skipped</div>
          </div>
          <div class="card" style="padding:14px;text-align:center;">
            <div style="font-size:1.4rem;font-weight:900;color:${errorCount > 0 ? '#DC2626' : 'var(--navy-700)'};font-family:var(--font-mono);">${errorCount.toLocaleString()}</div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-top:2px;">Errors / Invalid</div>
          </div>
        </div>

        <div style="background:#F8FAFC;border:1px solid var(--border-color);border-radius:12px;padding:14px 18px;margin-bottom:20px;">
          <div style="font-size:0.8rem;font-weight:800;color:var(--navy-800);margin-bottom:8px;">Breakdown by Entity:</div>
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:0.85rem;">
            <span>Customers: <strong>${counts.customers}</strong></span>
            <span>Loans: <strong>${counts.loans}</strong></span>
            <span>Payments: <strong>${counts.payments}</strong></span>
            <span>Expenses: <strong>${counts.expenses}</strong></span>
          </div>
        </div>

        ${errors.length > 0 ? `
          <div style="margin-bottom:20px;">
            <div style="font-size:0.82rem;font-weight:800;color:#DC2626;margin-bottom:6px;">Detailed Error Log (${errors.length}):</div>
            <div style="max-height:140px;overflow-y:auto;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px;font-size:0.78rem;">
              ${errors.map(err => `<div>&bull; ${err}</div>`).join('')}
            </div>
          </div>
        ` : ''}
      `;
    }

    /* ============================================================
       DOWNLOADABLE SAMPLE TEMPLATES
       ============================================================ */
    downloadTemplate(type) {
      const templates = {
        customers: {
          filename: 'microfi_Customers_Template.csv',
          content: 'Customer Name,Roll Number,Phone,Email,Father Name,Address,Sector,Loan Limit,Status\n' +
                   'Anand Sharma,V01,+91 98410 11223,anand@example.com,Ramesh Sharma,42 Bazaar Street,VILUPPURAM,25000,ACTIVE\n' +
                   'Priya Ramesh,C01,+91 97890 55443,priya@example.com,K. Ramesh,15 Anna Salai,CHENNAI CENTRAL,30000,ACTIVE\n' +
                   'Karthik Raja,CBE01,+91 94432 88990,karthik@example.com,Subramanian,8 Gandhi Road,COIMBATORE NORTH,20000,COMPLETED\n'
        },
        loans: {
          filename: 'microfi_Loans_Template.csv',
          content: 'Customer Roll,Loan ID,Loan Amount,Interest Rate,Tenure Months,Loan Date,Payment Method,Notes,Status\n' +
                   'V01,LN-2026-001,10000,12,12,2026-02-05,Bank Transfer,Retail expansion,ACTIVE\n' +
                   'C01,LN-2026-002,15000,14,18,2026-02-12,UPI,Inventory purchase,ACTIVE\n' +
                   'CBE01,LN-2026-003,8000,10,6,2026-01-20,Cash,Agri pump repair,ACTIVE\n'
        },
        payments: {
          filename: 'microfi_Payments_Template.csv',
          content: 'Customer Roll,Loan ID,Payment Amount,Payment Date,Payment Method,Reference ID,Notes\n' +
                   'V01,VPM-01-001-LOAN-001,2000,2026-03-10,UPI,UTR99881122,Part collection installment\n' +
                   'C01,CHE-01-001-LOAN-001,5000,2026-03-12,Bank Transfer,IMPS88776655,Monthly EMI received\n'
        },
        expenses: {
          filename: 'microfi_Expenses_Template.csv',
          content: 'Expense ID,Category,Description,Amount,Date,Payment Method,Notes\n' +
                   'EXP-801,Transport,Field recovery staff petrol,600,2026-03-02,UPI,Monthly fuel allowance\n' +
                   'EXP-802,Office,Stationery & printing registers,400,2026-03-04,Cash,Receipt 4412\n' +
                   'EXP-803,Utilities,Internet connectivity fee,1200,2026-03-08,Bank Transfer,Broadband bill\n'
        },
        json_complete: {
          filename: 'microfi_Complete_Template.json',
          content: JSON.stringify({
            customers: [
              { name: 'Senthil Kumar', rollNumber: 'V02', phone: '+91 98840 12345', relativeName: 'M. Kumar', loanLimit: 30000, address: 'Viluppuram', status: 'ACTIVE' }
            ],
            loans: [
              { customerRef: 'V02', id: 'LN-VPM-002', amount: 20000, interestRate: 12, tenureMonths: 12, disbursementDate: '2026-03-01', paymentMethod: 'Bank Transfer', notes: 'Shop inventory' }
            ],
            payments: [
              { loanId: 'LN-VPM-002', amount: 5000, date: '2026-03-15', method: 'UPI', reference: 'UTR445566', notes: 'First installment' }
            ],
            expenses: [
              { category: 'Audit', description: 'Legal and ledger verification', amount: 1500, date: '2026-03-10', method: 'Cash' }
            ]
          }, null, 2)
        }
      };

      const target = templates[type];
      if (!target) return;

      const blob = new Blob([target.content], { type: target.filename.endsWith('.json') ? 'application/json' : 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', target.filename);
      document.body.appendChild(link);
      if (typeof link.click === 'function') {
        link.click();
      }
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      URL.revokeObjectURL(url);

      if (window.app) window.app.showToast(`Template "${target.filename}" downloaded!`, 'success');
    }
  }

  // Global single instance
  window.bulkImportManager = new BulkImportManager();
})();
