/**
 * microfi - CENTRAL REACTIVE STATE STORE & DATABASE ENGINE
 * Manages data models, reactive subscribers, dynamic financial math, LocalStorage & IndexedDB persistence.
 */

const STORAGE_KEY = 'MICROFI_FINANCIAL_DATA_V2';
const LEGACY_STORAGE_KEY = 'FINANCEVAULT_DATA_V1';
const USER_KEY    = 'MICROFI_USER_V1';

class FinanceStore {
  constructor() {
    this.subscribers  = [];
    this.db           = null;
    this.currentUser  = this.loadUser() || {
      name: 'Deepan Kumar',
      email: 'deepan@microfi.io',
      phone: '+91 98765 43210',
      role: 'Chief Financial Officer',
      currency: '₹',
      avatar: 'DK',
      isLoggedIn: true
    };

    this.data = this.loadData() || this.getDefaultSeedData();
    this._migrateData(); // Purge any stale/legacy fake records in-place
    this._initIndexedDB(); // Initialize browser transactional IndexedDB database
  }

  /* ============================================================
     INDEXEDDB DATABASE ENGINE
     ============================================================ */
  _initIndexedDB() {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    try {
      const req = indexedDB.open('microfi_db', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('financial_store')) {
          db.createObjectStore('financial_store', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        // Verify or sync latest persistent state
        const tx = this.db.transaction('financial_store', 'readonly');
        const store = tx.objectStore('financial_store');
        const getReq = store.get('app_state');
        getReq.onsuccess = () => {
          if (getReq.result && getReq.result.data) {
            // Check if IndexedDB has more recent transactions
            if (!this.data || (this.data.payments.length === 0 && getReq.result.data.payments && getReq.result.data.payments.length > 0)) {
              this.data = getReq.result.data;
              this._migrateData();
              this.notify();
            }
          }
          this._saveToIndexedDB();
        };
      };
      req.onerror = (err) => {
        console.warn('IndexedDB unavailable, using localStorage fallback', err);
      };
    } catch (e) {
      console.warn('IndexedDB initialization failed', e);
    }
  }

  _saveToIndexedDB() {
    if (!this.db) return;
    try {
      const tx = this.db.transaction('financial_store', 'readwrite');
      const store = tx.objectStore('financial_store');
      store.put({ id: 'app_state', data: this.data, timestamp: Date.now() });
    } catch (err) {
      console.warn('IndexedDB write error:', err);
    }
  }

  /* ============================================================
     MIGRATION — runs on every load to purge fake legacy seed transactions
     ============================================================ */
  _migrateData() {
    if (!this.data) {
      this.data = this.getDefaultSeedData();
      this.saveData();
      return;
    }

    if (!Array.isArray(this.data.payments)) this.data.payments = [];
    if (!Array.isArray(this.data.loans)) this.data.loans = [];
    if (!Array.isArray(this.data.expenses)) this.data.expenses = [];
    if (!Array.isArray(this.data.customers)) this.data.customers = [];
    if (!Array.isArray(this.data.sectors)) this.data.sectors = [];

    // Purge fake sample seed transactions so all cards calculate purely from real user data
    const legacySampleLoanIds = ['VPM-01-001-LOAN-001', 'CHE-01-001-LOAN-001', 'CBE-01-001-LOAN-001'];
    const legacySamplePayIds  = ['VPM-01-001-LOAN-001-PAY-001', 'CBE-01-001-LOAN-001-PAY-001'];
    const legacySampleExpIds  = ['EXP-901', 'EXP-902'];

    const hadSampleLoans = this.data.loans.some(l => legacySampleLoanIds.includes(l.id));
    const hadSamplePays  = this.data.payments.some(p => legacySamplePayIds.includes(p.id) || legacySampleLoanIds.includes(p.loanId));
    const hadSampleExps  = this.data.expenses.some(e => legacySampleExpIds.includes(e.id));
    const hadDefaultFund = Number(this.data.initialFund) === 10000;

    if (hadSampleLoans || hadSamplePays || hadSampleExps || hadDefaultFund) {
      this.data.loans    = this.data.loans.filter(l => !legacySampleLoanIds.includes(l.id));
      this.data.payments = this.data.payments.filter(p => !legacySamplePayIds.includes(p.id) && !legacySampleLoanIds.includes(p.loanId));
      this.data.expenses = this.data.expenses.filter(e => !legacySampleExpIds.includes(e.id));

      if (hadDefaultFund) {
        this.data.initialFund = 0;
      }
      this.saveData();
    }

    if (this.data.sectors.length === 0) {
      this.data.sectors = [
        { id: 'SEC-001', name: 'VILUPPURAM',       code: 'VPM-01', createdAt: '2026-01-10' },
        { id: 'SEC-002', name: 'CHENNAI CENTRAL',  code: 'CHE-01', createdAt: '2026-01-15' },
        { id: 'SEC-003', name: 'COIMBATORE NORTH', code: 'CBE-01', createdAt: '2026-02-01' },
        { id: 'SEC-004', name: 'AGRICULTURE',      code: 'AGR-01', createdAt: '2026-02-15' }
      ];
    }

    /* Build name→id lookup so we can re-key old CUST-XXX references */
    const nameToId = {};
    (this.data.customers || []).forEach(c => {
      const n = c.fullName || c.name || '';
      if (n) nameToId[n] = c.id;
    });

    /* Fix loans */
    (this.data.loans || []).forEach(loan => {
      if (loan.customerId && loan.customerId.startsWith('CUST-')) {
        const fixed = loan.customerName ? nameToId[loan.customerName] : null;
        if (fixed) loan.customerId = fixed;
      }
      if (loan.paidAmount === undefined) loan.paidAmount = 0;
      if (loan.outstandingAmount === undefined) loan.outstandingAmount = Number(loan.amount || 0);
      loan.outstandingAmount = Math.max(0, Number(loan.outstandingAmount || 0));
      if (loan.creditBalance === undefined) loan.creditBalance = 0;
      loan.status = loan.outstandingAmount === 0 ? 'PAID' : 'ACTIVE';
    });

    /* Fix payments */
    (this.data.payments || []).forEach(p => {
      if (p.customerId && p.customerId.startsWith('CUST-')) {
        const fixed = p.customerName ? nameToId[p.customerName] : null;
        if (fixed) p.customerId = fixed;
      }
      if (!p.customerName && p.customerId) {
        const c = (this.data.customers || []).find(cust => cust.id === p.customerId);
        if (c) p.customerName = c.fullName || c.name;
      }
      if (!p.type) p.type = 'COLLECTION';
      if (!p.status) p.status = 'COMPLETED';
      if (!p.method) p.method = 'Cash';
      if (!p.date) p.date = new Date().toISOString().split('T')[0];
    });

    /* Sync customer rollNumber, loanLimit, and outstandingAmount strictly from actual loans */
    const sectorRollCounts = {};
    (this.data.customers || []).forEach(c => {
      const sector = (this.data.sectors || []).find(s => s.id === c.sectorId) || this.data.sectors[0];
      const prefix = this.getSectorRollPrefix(sector);
      if (!c.rollNumber) {
        if (!sectorRollCounts[c.sectorId]) sectorRollCounts[c.sectorId] = 0;
        sectorRollCounts[c.sectorId]++;
        c.rollNumber = `${prefix}${String(sectorRollCounts[c.sectorId]).padStart(2, '0')}`;
      } else {
        c.rollNumber = c.rollNumber.replace(/^#/, '').trim().toUpperCase();
      }
      if (c.loanLimit === undefined || c.loanLimit === null || Number(c.loanLimit) <= 0) {
        c.loanLimit = 200000;
      }
      const loans = (this.data.loans || []).filter(l => l.customerId === c.id);
      if (loans.length > 0) {
        c.outstandingAmount = loans.reduce((s, l) => s + Math.max(0, Number(l.outstandingAmount || 0)), 0);
      } else {
        c.outstandingAmount = 0;
      }
      c.status = (c.outstandingAmount || 0) === 0 ? 'ACTIVE' : 'ACTIVE';
    });
  }

  /* ============================================================
     REACTIVE PUB-SUB
     ============================================================ */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => { this.subscribers = this.subscribers.filter(cb => cb !== callback); };
  }

  notify() {
    this.saveData();
    this.subscribers.forEach(cb => {
      try { cb(this.data); } catch (err) { console.error('Store subscriber error:', err); }
    });
  }

  /* ============================================================
     PERSISTENCE (LocalStorage + IndexedDB Dual-Store)
     ============================================================ */
  loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) return JSON.parse(legacy);
      return null;
    } catch (e) {
      console.error('Error loading data', e);
      return null;
    }
  }

  saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Error saving data', e);
    }
    this._saveToIndexedDB();
  }

  loadUser() {
    try {
      const saved = localStorage.getItem(USER_KEY);
      if (saved) {
        const u = JSON.parse(saved);
        if (u && u.email === 'deepan@financevault.io') {
          u.email = 'deepan@microfi.io';
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        }
        return u;
      }
      return null;
    } catch (e) { return null; }
  }

  saveUser(user) {
    this.currentUser = { ...this.currentUser, ...user };
    try { localStorage.setItem(USER_KEY, JSON.stringify(this.currentUser)); } catch (e) {}
    this.notify();
  }

  /* ============================================================
     SEED DATA  (correct customer IDs & roll numbers from start)
     ============================================================ */
  getDefaultSeedData() {
    return {
      initialFund: 0,
      sectors: [
        { id: 'SEC-001', name: 'VILUPPURAM',       code: 'VPM-01', createdAt: '2026-01-10' },
        { id: 'SEC-002', name: 'CHENNAI CENTRAL',  code: 'CHE-01', createdAt: '2026-01-15' },
        { id: 'SEC-003', name: 'COIMBATORE NORTH', code: 'CBE-01', createdAt: '2026-02-01' },
        { id: 'SEC-004', name: 'AGRICULTURE',      code: 'AGR-01', createdAt: '2026-02-15' }
      ],
      customers: [
        {
          id: 'VPM-01-001', customerId: 'VPM-01-001', rollNumber: 'V01',
          fullName: 'Anand Sharma', name: 'Anand Sharma',
          relativeName: 'Ramesh Sharma',
          phone: '+91 98410 11223', email: 'anand@example.com',
          address: '42 Bazaar Street, Viluppuram',
          loanLimit: 25000, sectorId: 'SEC-001',
          loanId: null,
          loanAmount: 0, interestRate: 12,
          outstandingAmount: 0, status: 'ACTIVE', createdAt: '2026-02-05'
        },
        {
          id: 'CHE-01-001', customerId: 'CHE-01-001', rollNumber: 'C01',
          fullName: 'Priya Ramesh', name: 'Priya Ramesh',
          relativeName: 'K. Ramesh',
          phone: '+91 97890 55443', email: 'priya@example.com',
          address: '15 Anna Salai, Chennai',
          loanLimit: 30000, sectorId: 'SEC-002',
          loanId: null,
          loanAmount: 0, interestRate: 14,
          outstandingAmount: 0, status: 'ACTIVE', createdAt: '2026-02-12'
        },
        {
          id: 'CBE-01-001', customerId: 'CBE-01-001', rollNumber: 'CBE01',
          fullName: 'Karthik Raja', name: 'Karthik Raja',
          relativeName: 'Subramanian Raja',
          phone: '+91 94432 88990', email: 'karthik@example.com',
          address: '8 Gandhi Road, Coimbatore',
          loanLimit: 20000, sectorId: 'SEC-003',
          loanId: null,
          loanAmount: 0, interestRate: 10,
          outstandingAmount: 0, status: 'ACTIVE', createdAt: '2026-01-20'
        }
      ],
      loans: [],
      payments: [],
      expenses: [],
      audits: [
        {
          id: 'AUD-301', title: 'Monthly Cash Ledger Verification',
          docType: 'Invoice / Ledger', uploadDate: '2026-03-10',
          score: 96, status: 'VERIFIED',
          details: 'All receipts matched with bank passbook transactions.',
          findings: [
            { text: 'Transaction amount matches bank statement', status: 'VERIFIED' },
            { text: 'Customer & Loan ID verified with active database', status: 'VERIFIED' },
            { text: 'Zero duplicate entries detected', status: 'VERIFIED' }
          ]
        },
        {
          id: 'AUD-302', title: 'Office Rental & Utility Slip',
          docType: 'Receipt', uploadDate: '2026-03-12',
          score: 88, status: 'WARNING',
          details: 'Date timestamp differs by 2 days from ERP record.',
          findings: [
            { text: 'Expense voucher signed', status: 'VERIFIED' },
            { text: 'Minor date discrepancy (March 2 vs March 4)', status: 'WARNING' }
          ]
        }
      ]
    };
  }

  /* ============================================================
     AGGREGATE COMPUTATIONS
     ============================================================ */

  getTotalCollected() {
    return this.data.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  }

  getTotalDisbursed() {
    return this.data.loans.reduce((s, l) => s + Number(l.amount || 0), 0);
  }

  getTotalExpenses() {
    return this.data.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  }

  getClosingBalance() {
    return Number(this.data.initialFund || 0)
      + this.getTotalCollected()
      - this.getTotalDisbursed()
      - this.getTotalExpenses();
  }

  /* Outstanding = sum of all active loan outstanding amounts */
  getTotalExposure() {
    const loans = (this.data.loans || []).filter(l => l.status !== 'PAID');
    const loanTotal = loans.reduce((s, l) => s + Math.max(0, Number(l.outstandingAmount || 0)), 0);
    if (loanTotal > 0) return loanTotal;

    // Fallback to customer outstanding balances if any
    const custTotal = (this.data.customers || []).reduce((s, c) => s + Math.max(0, Number(c.outstandingAmount || 0)), 0);
    return Math.max(0, custTotal);
  }

  getTotalClients() { return (this.data.customers || []).length; }
  getTotalAreas()   { return (this.data.sectors || []).length; }

  /* Sector-specific Book Value */
  getSectorBookValue(sectorId) {
    const sector = (this.data.sectors || []).find(s => s.id === sectorId);
    if (!sector) return 0;

    // 1. Explicit override if present
    if (sector.bookValue !== undefined && sector.bookValue !== null && !isNaN(Number(sector.bookValue)) && Number(sector.bookValue) > 0) {
      return Number(sector.bookValue);
    }

    // 2. Computed from sector's active loans & clients
    const metrics = this.getSectorMetrics(sectorId);
    if (metrics.outstandingAmount > 0) {
      return metrics.outstandingAmount;
    }

    // 3. Fallback to customer direct outstanding balances
    const clients = (this.data.customers || []).filter(c => c.sectorId === sectorId);
    const custBalance = clients.reduce((sum, c) => sum + Math.max(0, Number(c.outstandingAmount || 0)), 0);
    if (custBalance > 0) return custBalance;

    return 0;
  }

  /* Dynamic Live Book Value: sum across all financial areas / sectors / routes */
  getLiveBookValue() {
    if (!this.data) return 0;
    const sectors = this.data.sectors || [];
    let totalBook = 0;

    sectors.forEach(sec => {
      totalBook += this.getSectorBookValue(sec.id);
    });

    // Also include any active loans not linked to known sectors (e.g. general / unassigned)
    const sectorIds = sectors.map(s => s.id);
    const orphanLoans = (this.data.loans || []).filter(l => {
      const cust = (this.data.customers || []).find(c => c.id === l.customerId);
      const sId = l.sectorId || (cust ? cust.sectorId : null);
      return !sId || !sectorIds.includes(sId);
    });

    const orphanOutstanding = orphanLoans
      .filter(l => l.status !== 'PAID')
      .reduce((s, l) => s + Math.max(0, Number(l.outstandingAmount || 0)), 0);

    totalBook += orphanOutstanding;
    return Math.max(0, totalBook);
  }

  /* Sector-level metrics — computed from loans & payments (not stale customer cache) */
  getSectorMetrics(sectorId) {
    const clients            = (this.data.customers || []).filter(c => c.sectorId === sectorId);
    const clientIds          = clients.map(c => c.id);

    const sectorLoans        = (this.data.loans || []).filter(l => l.sectorId === sectorId || (l.customerId && clientIds.includes(l.customerId)));
    const totalLoanExposure  = sectorLoans.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalOutstanding   = sectorLoans.reduce((s, l) => s + Math.max(0, Number(l.outstandingAmount || 0)), 0);

    const sectorPmts         = (this.data.payments || []).filter(p => clientIds.includes(p.customerId));
    const collected          = sectorPmts.reduce((s, p) => s + Number(p.amount || 0), 0);

    return {
      clientCount:       clients.length,
      loanExposure:      totalLoanExposure,
      collectedAmount:   collected,
      outstandingAmount: totalOutstanding
    };
  }

  /* ============================================================
     ROLL NUMBER HELPERS (Requirement 1 & 2)
     ============================================================ */
  getSectorRollPrefix(sector) {
    if (!sector) return 'C';
    const name = (sector.name || '').toUpperCase().trim();
    if (name.startsWith('AGRI')) return 'A';
    if (name.startsWith('CHENNAI')) return 'C';
    if (name.startsWith('COIMBATORE')) return 'CBE';
    if (name.startsWith('VILUPPURAM')) return 'V';
    if (sector.code) {
      const codePart = sector.code.split('-')[0].trim().toUpperCase();
      if (codePart === 'AGR') return 'A';
      if (codePart === 'CHE') return 'C';
      if (codePart) return codePart;
    }
    return name.charAt(0) || 'C';
  }

  generateNextRollNumber(sectorId) {
    const sector = (this.data.sectors || []).find(s => s.id === sectorId) || this.data.sectors[0];
    const prefix = this.getSectorRollPrefix(sector);
    const customersInSector = (this.data.customers || []).filter(c => c.sectorId === sectorId);
    
    let maxNum = 0;
    customersInSector.forEach(c => {
      if (c.rollNumber) {
        const clean = c.rollNumber.replace(/^#/, '').toUpperCase();
        if (clean.startsWith(prefix)) {
          const numPart = parseInt(clean.slice(prefix.length), 10);
          if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
        }
      }
    });

    let nextNum = maxNum + 1;
    let candidate = `${prefix}${String(nextNum).padStart(2, '0')}`;
    while (customersInSector.some(c => (c.rollNumber || '').replace(/^#/, '').toUpperCase() === candidate)) {
      nextNum++;
      candidate = `${prefix}${String(nextNum).padStart(2, '0')}`;
    }
    return candidate;
  }

  findCustomerByRollNumber(rollNumber, sectorId = null) {
    if (!rollNumber) return null;
    const norm = rollNumber.toString().replace(/^#/, '').trim().toUpperCase();
    return (this.data.customers || []).find(c => {
      const cRoll = (c.rollNumber || '').replace(/^#/, '').trim().toUpperCase();
      const matchRoll = cRoll === norm;
      if (sectorId) {
        return matchRoll && c.sectorId === sectorId;
      }
      return matchRoll;
    });
  }

  /* ============================================================
     CUSTOMER-LEVEL HELPERS
     ============================================================ */
  getCustomerLoans(customerId) {
    return this.data.loans.filter(l => l.customerId === customerId);
  }

  getCustomerPayments(customerId) {
    return this.data.payments.filter(p => p.customerId === customerId);
  }

  getActiveLoan(customerId) {
    return this.data.loans.find(l => l.customerId === customerId && Number(l.outstandingAmount || 0) > 0);
  }

  getCustomerLoanLimit(customerId) {
    const c = this.data.customers.find(cust => cust.id === customerId);
    return c ? Number(c.loanLimit !== undefined ? c.loanLimit : 200000) : 200000;
  }

  getAvailableLoanLimit(customerId) {
    const activeLoan = this.getActiveLoan(customerId);
    if (activeLoan && Number(activeLoan.outstandingAmount || 0) > 0) {
      return 0;
    }
    return this.getCustomerLoanLimit(customerId);
  }

  getClientSummary(customerId) {
    const loans    = this.getCustomerLoans(customerId);
    const payments = this.getCustomerPayments(customerId);

    const totalLoan        = loans.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalPaid        = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalOutstanding = loans.reduce((s, l) => s + Math.max(0, Number(l.outstandingAmount || 0)), 0);
    const creditBalance    = loans.reduce((s, l) => s + Number(l.creditBalance || 0), 0);
    const customerLimit    = this.getCustomerLoanLimit(customerId);
    const activeLoan       = this.getActiveLoan(customerId);
    const availableForLoan = activeLoan ? 0 : customerLimit;

    return {
      totalLoan,
      totalPaid,
      totalOutstanding,
      creditBalance,
      customerLimit,
      availableForLoan,
      hasActiveLoan: Boolean(activeLoan),
      activeLoan
    };
  }

  /* ============================================================
     CRUD MUTATIONS
     ============================================================ */

  // 1. Initial Fund
  setInitialFund(amount) {
    this.data.initialFund = Math.max(0, Number(amount || 0));
    this.notify();
  }

  // 2. Sector
  addSector(name, code = '') {
    const id = 'SEC-' + Math.floor(100 + Math.random() * 900);
    const newSector = {
      id,
      name: name.trim().toUpperCase(),
      code: code ? code.trim().toUpperCase() : name.slice(0, 3).toUpperCase() + '-01',
      createdAt: new Date().toISOString().split('T')[0]
    };
    this.data.sectors.push(newSector);
    this.notify();
    return newSector;
  }

  deleteSector(sectorId) {
    this.data.sectors = this.data.sectors.filter(s => s.id !== sectorId);
    this.notify();
  }

  editSector(sectorId, name) {
    const sec = this.data.sectors.find(s => s.id === sectorId);
    if (sec) { sec.name = name.trim().toUpperCase(); this.notify(); }
  }

  // 3. Add Customer (with automatic sequential ascending Roll Number per sector)
  addCustomer(customerData) {
    const sector = this.data.sectors.find(s => s.id === customerData.sectorId) || this.data.sectors[0] || { id: 'SEC-001', code: 'GEN-01', name: 'GENERAL' };
    const code   = sector.code || (sector.name.slice(0, 3).toUpperCase() + '-01');

    const existing = this.data.customers.filter(c => c.sectorId === sector.id);
    let n = existing.length + 1;
    let custId = `${code}-${String(n).padStart(3, '0')}`;
    while (this.data.customers.some(c => c.id === custId)) { n++; custId = `${code}-${String(n).padStart(3, '0')}`; }

    // Sequential ascending Roll Number (e.g. #A01, #A02 for Agriculture, #C01 for Chennai)
    const rollNumber = customerData.rollNumber
      ? customerData.rollNumber.replace(/^#/, '').trim().toUpperCase()
      : this.generateNextRollNumber(sector.id);

    const newCust = {
      id: custId,
      customerId: custId,
      rollNumber,
      fullName:     (customerData.fullName || customerData.name || 'New Customer').trim(),
      name:         (customerData.fullName || customerData.name || 'New Customer').trim(),
      relativeName: (customerData.relativeName || '').trim(),
      phone:        (customerData.phone || '').trim(),
      email:        customerData.email ? customerData.email.trim() : '',
      address:      (customerData.address || '').trim(),
      loanLimit:    Math.max(0, Number(customerData.loanLimit !== undefined ? customerData.loanLimit : 200000)),
      sectorId:     sector.id,
      sectorName:   sector.name,
      loanId:       null,
      loanAmount:   0,
      outstandingAmount: 0,
      status:       'ACTIVE',
      createdAt:    customerData.createdAt || new Date().toISOString().split('T')[0]
    };

    this.data.customers.push(newCust);
    this.notify();
    return newCust;
  }

  // 4. Add Loan linked to an existing customer (client-details flow)
  addLoan(loanData) {
    const customer = this.data.customers.find(c => c.id === loanData.customerId);
    if (!customer) throw new Error('Customer not found. Cannot create loan.');

    // RULE: ONE ACTIVE LOAN PER CUSTOMER
    const activeLoan = this.getActiveLoan(customer.id);
    if (activeLoan && Number(activeLoan.outstandingAmount || 0) > 0) {
      throw new Error(`This customer has an active loan (${activeLoan.id}) with ${this.formatCurrency(activeLoan.outstandingAmount)} outstanding. Please collect the remaining amount before creating a new loan.`);
    }

    const amount = Number(loanData.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Loan amount must be greater than zero.');
    }

    // RULE: CUSTOMER LOAN LIMIT VALIDATION
    const loanLimit = Number(customer.loanLimit !== undefined ? customer.loanLimit : 200000);
    if (amount > loanLimit) {
      throw new Error(`Loan amount exceeds the customer's loan limit of ${this.formatCurrency(loanLimit)}.`);
    }

    // Generate unique sequential loan ID (never overwrite old loans)
    const customerLoans = this.getCustomerLoans(customer.id);
    let n = customerLoans.length + 1;
    let loanId = `${customer.id}-LOAN-${String(n).padStart(3, '0')}`;
    while (this.data.loans.some(l => l.id === loanId)) {
      n++;
      loanId = `${customer.id}-LOAN-${String(n).padStart(3, '0')}`;
    }

    const loan = {
      id:                loanId,
      customerId:        customer.id,
      customerName:      customer.fullName || customer.name,
      sectorId:          customer.sectorId,
      amount,
      paidAmount:        0,
      outstandingAmount: amount,
      creditBalance:     0,
      interestRate:      Number(loanData.interestRate || 12),
      tenureMonths:      Number(loanData.tenureMonths || 12),
      dueDate:           loanData.dueDate || '',
      disbursementDate:  loanData.date || new Date().toISOString().split('T')[0],
      paymentMethod:     loanData.method || 'Bank Transfer',
      notes:             loanData.notes  || 'Disbursed',
      status:            'ACTIVE' // Calculated: amount > 0 and paidAmount = 0
    };

    // Keep complete history: unshift new active loan
    this.data.loans.unshift(loan);

    // Update customer cache
    customer.loanId            = loanId;
    customer.loanAmount        = (customer.loanAmount || 0) + amount;
    customer.outstandingAmount = amount;
    customer.status            = 'ACTIVE';

    this.notify();
    return loan;
  }

  // 5. Record payment against a specific loan
  recordClientPayment(paymentData) {
    const loan = this.data.loans.find(l => l.id === paymentData.loanId);
    if (!loan) throw new Error('Loan not found.');
    if (loan.status === 'PAID' || Number(loan.outstandingAmount || 0) <= 0) {
      throw new Error('This loan is already fully paid.');
    }

    const customer    = this.data.customers.find(c => c.id === paymentData.customerId);
    const amount      = Number(paymentData.amount);
    const outstanding = Math.max(0, Number(loan.outstandingAmount || 0));

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    // RULE: PAYMENT CANNOT EXCEED OUTSTANDING AMOUNT
    if (amount > outstanding) {
      throw new Error(`Payment cannot exceed outstanding amount of ${this.formatCurrency(outstanding)}.`);
    }

    // Generate payment ID
    const loanPayments = this.data.payments.filter(p => p.loanId === loan.id);
    const payNum  = loanPayments.length + 1;
    const payId   = `${loan.id}-PAY-${String(payNum).padStart(3, '0')}`;

    // Apply exact payment
    loan.paidAmount        = (loan.paidAmount || 0) + amount;
    loan.outstandingAmount = Math.max(0, outstanding - amount);

    // AUTOMATIC STATUS CALCULATION:
    // Outstanding > 0 -> ACTIVE
    // Outstanding = 0 -> PAID
    loan.status = loan.outstandingAmount === 0 ? 'PAID' : 'ACTIVE';

    const payment = {
      id:           payId,
      customerId:   paymentData.customerId,
      customerName: customer ? (customer.fullName || customer.name) : (paymentData.customerName || 'Customer'),
      loanId:       loan.id,
      amount,
      excessAmount: 0,
      date:         paymentData.date      || new Date().toISOString().split('T')[0],
      method:       paymentData.method    || 'Cash',
      reference:    paymentData.reference || '',
      notes:        paymentData.notes     || '',
      type:         'COLLECTION',
      status:       'COMPLETED'
    };

    this.data.payments.unshift(payment);

    // Recompute customer outstanding from all loans
    if (customer) {
      const allLoans = this.getCustomerLoans(customer.id);
      customer.outstandingAmount = allLoans.reduce((s, l) => s + Math.max(0, Number(l.outstandingAmount || 0)), 0);
      customer.status = customer.outstandingAmount === 0 ? 'COMPLETED' : 'ACTIVE';
    }

    this.notify();
    return { payment, excessAmount: 0 };
  }

  // 6. Legacy collectPayment (used from old modal — keeps backward compat)
  collectPayment(paymentData) {
    const id     = 'PAY-' + Math.floor(100 + Math.random() * 900);
    const amount = Number(paymentData.amount);

    if (isNaN(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    // Try to update specific loan
    let loan = this.data.loans.find(l => l.id === paymentData.loanId);
    if (!loan && paymentData.customerId) {
      loan = this.getActiveLoan(paymentData.customerId);
    }

    if (loan) {
      const outstanding = Math.max(0, Number(loan.outstandingAmount || 0));
      const payToLoan = Math.min(amount, outstanding);
      loan.paidAmount        = (loan.paidAmount || 0) + payToLoan;
      loan.outstandingAmount = Math.max(0, outstanding - payToLoan);
      loan.status            = loan.outstandingAmount === 0 ? 'PAID' : 'ACTIVE';
    }

    // Update customer outstanding
    const customer = this.data.customers.find(c => c.id === paymentData.customerId);
    if (customer) {
      const allLoans = this.getCustomerLoans(customer.id);
      if (allLoans.length > 0) {
        customer.outstandingAmount = allLoans.reduce((s, l) => s + Math.max(0, Number(l.outstandingAmount || 0)), 0);
      } else {
        customer.outstandingAmount = Math.max(0, Number(customer.outstandingAmount || 0) - amount);
      }
      customer.status = (customer.outstandingAmount || 0) === 0 ? 'ACTIVE' : 'ACTIVE';
    }

    const payment = {
      id,
      customerId:   paymentData.customerId || (customer ? customer.id : ''),
      customerName: customer ? (customer.fullName || customer.name) : (paymentData.customerName || 'Customer'),
      loanId:       loan ? loan.id : (paymentData.loanId || 'N/A'),
      amount,
      excessAmount: 0,
      date:         paymentData.date      || new Date().toISOString().split('T')[0],
      method:       paymentData.method    || 'Cash',
      reference:    paymentData.reference || '',
      notes:        paymentData.notes     || 'Collection Installment',
      type:         'COLLECTION',
      status:       'COMPLETED'
    };

    if (!Array.isArray(this.data.payments)) {
      this.data.payments = [];
    }
    this.data.payments.unshift(payment);

    this.notify();
    return payment;
  }

  // 7. Disburse Loan (legacy modal — creates customer by name if not found)
  disburseLoan(loanData) {
    const amount = Number(loanData.amount);

    let customer = this.data.customers.find(c => c.id === loanData.customerId);
    if (!customer && loanData.customerName) {
      customer = this.data.customers.find(c =>
        (c.fullName || c.name || '').toLowerCase() === loanData.customerName.toLowerCase()
      );
    }
    if (!customer && loanData.customerName) {
      customer = this.addCustomer({
        name: loanData.customerName,
        phone: loanData.phone || '+91 99999 00000',
        sectorId: loanData.sectorId || (this.data.sectors[0]?.id || 'SEC-001')
      });
    }

    const custId       = customer ? customer.id : (loanData.customerId || 'UNKNOWN');
    const customerLoans = this.data.loans.filter(l => l.customerId === custId);
    const loanNum      = customerLoans.length + 1;
    const loanId       = `${custId}-LOAN-${String(loanNum).padStart(3, '0')}`;

    const loan = {
      id: loanId,
      customerId:        custId,
      customerName:      customer ? (customer.fullName || customer.name) : loanData.customerName,
      sectorId:          customer ? customer.sectorId : (loanData.sectorId || this.data.sectors[0]?.id),
      amount,
      paidAmount:        0,
      outstandingAmount: amount,
      creditBalance:     0,
      interestRate:      Number(loanData.interestRate || 12),
      tenureMonths:      Number(loanData.tenureMonths || 12),
      disbursementDate:  loanData.date || new Date().toISOString().split('T')[0],
      paymentMethod:     loanData.method || 'Bank Transfer',
      notes:             loanData.notes  || 'New loan disbursement',
      status:            'ACTIVE'
    };

    this.data.loans.unshift(loan);

    if (customer) {
      customer.loanId            = loanId;
      customer.loanAmount        = (customer.loanAmount || 0) + amount;
      customer.outstandingAmount = (customer.outstandingAmount || 0) + amount;
      customer.status            = 'ACTIVE';
    }

    this.notify();
    return loan;
  }

  // 8. Add Expense
  addExpense(expenseData) {
    const id = 'EXP-' + Math.floor(900 + Math.random() * 100);
    const expense = {
      id,
      category:    expenseData.category    || 'Other',
      description: expenseData.description || 'General office expense',
      amount:      Number(expenseData.amount),
      date:        expenseData.date   || new Date().toISOString().split('T')[0],
      method:      expenseData.method || 'Cash',
      receiptUrl:  expenseData.receiptUrl || null,
      type:        'EXPENSE'
    };
    this.data.expenses.unshift(expense);
    this.notify();
    return expense;
  }

  // 9. Audit
  addAudit(auditData) {
    const id = 'AUD-' + Math.floor(300 + Math.random() * 700);
    const newAudit = {
      id,
      title:      auditData.title    || 'Uploaded Document Audit',
      docType:    auditData.docType  || 'Receipt',
      uploadDate: new Date().toISOString().split('T')[0],
      score:      auditData.score    || 92,
      status:     auditData.status   || 'VERIFIED',
      details:    auditData.details  || 'Document verified against system ledger.',
      fileUrl:    auditData.fileUrl  || null,
      findings:   auditData.findings || [
        { text: 'Document timestamp matches transaction logs', status: 'VERIFIED' },
        { text: 'Entity & currency match verified standards',  status: 'VERIFIED' }
      ]
    };
    this.data.audits.unshift(newAudit);
    this.notify();
    return newAudit;
  }

  deleteAudit(auditId) {
    this.data.audits = this.data.audits.filter(a => a.id !== auditId);
    this.notify();
  }

  deleteTransaction(id, type) {
    if (!id) return false;
    const normType = (type || '').toUpperCase();

    if (normType === 'COLLECTION' || normType === 'PAYMENT' || normType === 'INFLOW') {
      const idx = (this.data.payments || []).findIndex(p => p.id === id);
      if (idx !== -1) {
        const [removed] = this.data.payments.splice(idx, 1);
        if (removed && removed.loanId) {
          const loan = (this.data.loans || []).find(l => l.id === removed.loanId);
          if (loan) {
            loan.paidAmount = Math.max(0, Number(loan.paidAmount || 0) - Number(removed.amount || 0));
            loan.outstandingAmount = Math.min(Number(loan.amount || 0), Number(loan.outstandingAmount || 0) + Number(removed.amount || 0));
            loan.status = loan.outstandingAmount === 0 ? 'PAID' : 'ACTIVE';
          }
        }
        if (removed && removed.customerId) {
          const customer = (this.data.customers || []).find(c => c.id === removed.customerId);
          if (customer) {
            const allLoans = this.getCustomerLoans(customer.id);
            customer.outstandingAmount = allLoans.reduce((s, l) => s + Math.max(0, Number(l.outstandingAmount || 0)), 0);
            customer.status = customer.outstandingAmount === 0 ? 'COMPLETED' : 'ACTIVE';
          }
        }
        this.notify();
        return true;
      }
    } else if (normType === 'LOAN' || normType === 'DISBURSEMENT' || normType === 'OUTFLOW') {
      const idx = (this.data.loans || []).findIndex(l => l.id === id);
      if (idx !== -1) {
        const [removed] = this.data.loans.splice(idx, 1);
        this.data.payments = (this.data.payments || []).filter(p => p.loanId !== id);
        if (removed && removed.customerId) {
          const customer = (this.data.customers || []).find(c => c.id === removed.customerId);
          if (customer) {
            const allLoans = this.getCustomerLoans(customer.id);
            customer.outstandingAmount = allLoans.reduce((s, l) => s + Math.max(0, Number(l.outstandingAmount || 0)), 0);
            customer.status = customer.outstandingAmount === 0 ? 'COMPLETED' : 'ACTIVE';
            if (customer.loanId === id) {
              customer.loanId = allLoans.length > 0 ? allLoans[0].id : null;
            }
          }
        }
        this.notify();
        return true;
      }
    } else if (normType === 'EXPENSE') {
      const idx = (this.data.expenses || []).findIndex(e => e.id === id);
      if (idx !== -1) {
        this.data.expenses.splice(idx, 1);
        this.notify();
        return true;
      }
    }
    return false;
  }

  resetDatabase() {
    this.data = this.getDefaultSeedData();
    this._migrateData();
    this.saveData();
    this.notify();
    return this.data;
  }

  /* ============================================================
     TRANSACTION QUERY & AGGREGATION
     ============================================================ */
  getAllTransactions(filter = 'ALL', search = '') {
    if (!this.data) return [];

    // 1. Collections (Inflow)
    const payments = (this.data.payments || []).map(p => {
      let custName = p.customerName;
      if (!custName && p.customerId) {
        const c = (this.data.customers || []).find(cust => cust.id === p.customerId);
        if (c) custName = c.fullName || c.name;
      }
      return {
        id: p.id || `PAY-${Math.floor(Math.random() * 1000)}`,
        party: custName || 'Customer',
        sub: p.loanId ? `Loan ${p.loanId}` : 'Direct Collection',
        type: 'COLLECTION',
        desc: p.notes || 'Collection Installment',
        amount: Number(p.amount || 0),
        date: p.date || new Date().toISOString().split('T')[0],
        method: p.method || 'Cash',
        status: p.status || 'COMPLETED',
        raw: p
      };
    });

    // 2. Loan Disbursements (Outflow)
    const loans = (this.data.loans || []).map(l => {
      let custName = l.customerName;
      if (!custName && l.customerId) {
        const c = (this.data.customers || []).find(cust => cust.id === l.customerId);
        if (c) custName = c.fullName || c.name;
      }
      return {
        id: l.id || `LOAN-${Math.floor(Math.random() * 1000)}`,
        party: custName || 'Borrower',
        sub: `${l.interestRate || 12}% for ${l.tenureMonths || 12}m`,
        type: 'LOAN',
        desc: l.notes || 'Loan Disbursement',
        amount: Number(l.amount || 0),
        date: l.disbursementDate || l.date || new Date().toISOString().split('T')[0],
        method: l.paymentMethod || l.method || 'Bank Transfer',
        status: l.status || 'ACTIVE',
        raw: l
      };
    });

    // 3. Expenses (Operational Outflow)
    const expenses = (this.data.expenses || []).map(e => ({
      id: e.id || `EXP-${Math.floor(Math.random() * 1000)}`,
      party: e.category || 'Office Expense',
      sub: 'Operational Outflow',
      type: 'EXPENSE',
      desc: e.description || 'General operational expense',
      amount: Number(e.amount || 0),
      date: e.date || new Date().toISOString().split('T')[0],
      method: e.method || 'Cash',
      status: 'PAID',
      raw: e
    }));

    let list = [...payments, ...loans, ...expenses];

    // Sort by Date descending (newest first)
    list.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    // Filter by type
    if (filter && filter !== 'ALL') {
      const normFilter = filter.toUpperCase();
      list = list.filter(item => {
        const t = (item.type || '').toUpperCase();
        if (normFilter === 'COLLECTION' || normFilter === 'INFLOW') {
          return t === 'COLLECTION' || t === 'INFLOW' || t === 'PAYMENT';
        }
        if (normFilter === 'LOAN' || normFilter === 'OUTFLOW') {
          return t === 'LOAN' || t === 'LOAN_DISBURSEMENT' || t === 'DISBURSEMENT' || t === 'OUTFLOW';
        }
        if (normFilter === 'EXPENSE') {
          return t === 'EXPENSE';
        }
        return t === normFilter;
      });
    }

    // Search query across all fields safely
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(item => {
        const p = String(item.party || '').toLowerCase();
        const d = String(item.desc || '').toLowerCase();
        const i = String(item.id || '').toLowerCase();
        const m = String(item.method || '').toLowerCase();
        const s = String(item.sub || '').toLowerCase();
        return p.includes(q) || d.includes(q) || i.includes(q) || m.includes(q) || s.includes(q);
      });
    }

    return list;
  }

  /* ============================================================
     FORMATTING
     ============================================================ */
  formatCurrency(num, compact = false) {
    const n      = Number(num || 0);
    const prefix = this.currentUser.currency || '₹';

    if (compact && Math.abs(n) >= 1000) {
      if (Math.abs(n) >= 10000000) return `${prefix} ${(n / 10000000).toFixed(1)}Cr`;
      if (Math.abs(n) >= 100000)   return `${prefix} ${(n / 100000).toFixed(1)}L`;
      if (Math.abs(n) >= 1000)     return `${prefix} ${(n / 1000).toFixed(1)}K`;
    }

    return `${prefix} ` + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  }
}

// Global single instance
window.financeStore = new FinanceStore();
