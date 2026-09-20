/**
 * FINANCEVAULT - CORE APPLICATION CONTROLLER
 * Routing, View Management, Modal Controller, Auth, Data Bindings, and UI Handlers
 */

class FinanceApp {
  constructor() {
    this.currentView     = 'home';
    this.currentSectorId = 'SEC-004';
    this.currentClientId = null;
    this.currentLoanId   = null;
    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindAuth();
    this.bindModals();
    this.bindDashboardActions();
    this.bindPayActions();
    this.bindSearchAndFilters();
    this.bindProfileActions();
    this.bindDedicatedNewCustomerForm();
    this.bindClientDetailsActions();

    // Migrate existing customers — assign roll numbers if missing
    this.migrateExistingCustomerRollNumbers();

    // Subscribe to Store Updates
    window.financeStore.subscribe(() => {
      this.renderAllViews();
    });

    // Check Auth State
    if (window.financeStore.currentUser.isLoggedIn) {
      this.showApp();
    } else {
      this.showAuth();
    }

    // Initialize sub-engines
    if (window.financeCalculatorSuite) {
      window.financeCalculatorSuite.initCashReconciliation();
      window.financeCalculatorSuite.initEmiCalculator();
      window.financeCalculatorSuite.initSavingsCalculator();
      window.financeCalculatorSuite.initInvestmentCalculator();
    }

    if (window.auditEngine) {
      window.auditEngine.init();
    }

    this.renderAllViews();
  }

  /* Assign roll numbers to any existing customers that lack them */
  migrateExistingCustomerRollNumbers() {
    const store = window.financeStore;
    let changed = false;
    (store.data.customers || []).forEach(c => {
      if (!c.rollNumber) {
        c.rollNumber = store.generateNextRollNumber(c.sectorId);
        changed = true;
      }
    });
    if (changed) store.notify();
  }

  // ==========================================
  // NAVIGATION & VIEW SWITCHER
  // ==========================================
  bindNavigation() {
    // Bottom Nav Items
    const navItems = document.querySelectorAll('.nav-item, .nav-center-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewTarget = item.dataset.view;
        if (viewTarget === 'audit') {
          this.openModal('audit-coming-soon-modal');
          return;
        }
        if (viewTarget) {
          this.switchView(viewTarget);
        }
      });
    });

    // Desktop Nav Items
    const desktopBtns = document.querySelectorAll('.desktop-nav-btn');
    desktopBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const viewTarget = btn.dataset.view;
        if (viewTarget === 'audit') {
          this.openModal('audit-coming-soon-modal');
          return;
        }
        if (viewTarget) {
          this.switchView(viewTarget);
        }
      });
    });

    // Calculator Sub-Tabs
    const calcTabs = document.querySelectorAll('.calc-tab-btn');
    calcTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        calcTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetPanel = tab.dataset.calc;
        document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
        const activePanel = document.getElementById(`calc-${targetPanel}`);
        if (activePanel) activePanel.classList.add('active');
      });
    });

    // Quick Action Bar on Dashboard
    document.querySelectorAll('[data-action-view]').forEach(el => {
      el.addEventListener('click', () => {
        const view = el.dataset.actionView;
        this.switchView(view);
      });
    });
  }

  switchView(viewName) {
    if (viewName === 'audit') {
      this.openModal('audit-coming-soon-modal');
      return;
    }

    this.currentView = viewName;

    // Update bottom nav active state
    document.querySelectorAll('.nav-item, .nav-center-item').forEach(item => {
      if (item.dataset.view === viewName || (viewName === 'live-book-value' && item.dataset.view === 'profile')) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Toggle view sections
    document.querySelectorAll('.view-section').forEach(section => {
      section.classList.remove('active-view');
    });

    const activeSection = document.getElementById(`view-${viewName}`);
    if (activeSection) {
      activeSection.classList.add('active-view');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (viewName === 'audit' && window.auditEngine) {
      window.auditEngine.updateAuditSummaryCard();
      window.auditEngine.renderAuditLogs();
    }

    if (viewName === 'live-book-value') {
      this.renderLiveBookValueBreakdown();
    }

    this.renderAllViews();
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================
  bindAuth() {
    const loginForm = document.getElementById('login-form');
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const passwordInput = document.getElementById('auth-password');
    const demoFillBtn = document.getElementById('demo-fill-btn');
    const authToggleLink = document.getElementById('auth-toggle-link');
    const authTitle = document.getElementById('auth-title');
    const authSubmitBtn = document.getElementById('auth-submit-btn');

    let isCreateAccount = false;

    if (togglePasswordBtn && passwordInput) {
      togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
      });
    }

    if (demoFillBtn) {
      demoFillBtn.addEventListener('click', () => {
        document.getElementById('auth-name').value = 'Deepan Kumar';
        document.getElementById('auth-email').value = 'deepan@microfi.io';
        document.getElementById('auth-password').value = 'microfi@2026';
        this.showToast('Demo credentials autofilled!', 'info');
      });
    }

    if (authToggleLink) {
      authToggleLink.addEventListener('click', () => {
        isCreateAccount = !isCreateAccount;
        if (isCreateAccount) {
          authTitle.textContent = 'Create Account';
          authSubmitBtn.textContent = 'Create Account';
          authToggleLink.textContent = 'Already have an account? Login';
        } else {
          authTitle.textContent = 'Welcome Back';
          authSubmitBtn.textContent = 'Sign In to microfi';
          authToggleLink.textContent = 'New to microfi? Create Account';
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('auth-name').value.trim();
        const email = document.getElementById('auth-email').value.trim();
        const pass = document.getElementById('auth-password').value.trim();

        if (!name || !email || !pass) {
          this.showToast('Please fill all required credentials.', 'error');
          return;
        }

        // Simulate login state
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = 'Authenticating...';

        setTimeout(() => {
          window.financeStore.saveUser({
            name: name,
            email: email,
            avatar: name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
            isLoggedIn: true
          });

          authSubmitBtn.disabled = false;
          authSubmitBtn.textContent = isCreateAccount ? 'Create Account' : 'Sign In to microfi';

          this.showApp();
          this.showToast(`Welcome back, ${name}!`, 'success');
        }, 500);
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.financeStore.saveUser({ isLoggedIn: false });
        this.showAuth();
        this.showToast('Signed out successfully.', 'info');
      });
    }
  }

  showAuth() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
  }

  showApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';
    this.renderAllViews();
  }

  // ==========================================
  // RENDER VIEWS & DYNAMIC DATA
  // ==========================================
  renderAllViews() {
    const store = window.financeStore;
    const user = store.currentUser;

    // 1. Header User Info
    document.querySelectorAll('.user-avatar').forEach(el => el.textContent = user.avatar || 'DK');
    document.querySelectorAll('.user-name').forEach(el => el.textContent = user.name || 'Deepan Kumar');
    document.querySelectorAll('.profile-name-text').forEach(el => el.textContent = user.name);
    document.querySelectorAll('.profile-email-text').forEach(el => el.textContent = user.email);
    document.querySelectorAll('.profile-phone-text').forEach(el => el.textContent = user.phone);

    // 2. Live Book Value (Settings & Dedicated View)
    const liveBookValue = store.getLiveBookValue();
    const liveBookEl = document.getElementById('hero-live-book-value');
    if (liveBookEl) liveBookEl.textContent = store.formatCurrency(liveBookValue);

    const areasCountEl = document.getElementById('hero-areas-count');
    const clientsCountEl = document.getElementById('hero-clients-count');
    const exposureCountEl = document.getElementById('hero-exposure-count');

    if (areasCountEl) areasCountEl.textContent = store.getTotalAreas();
    if (clientsCountEl) clientsCountEl.textContent = store.getTotalClients();
    if (exposureCountEl) exposureCountEl.textContent = store.formatCurrency(store.getTotalExposure(), true);

    // Dedicated Live Book Value View Elements
    const settingsLbvBadge = document.getElementById('settings-book-val-badge');
    if (settingsLbvBadge) settingsLbvBadge.textContent = store.formatCurrency(liveBookValue, true);

    const settingsLbvVal = document.getElementById('settings-live-book-val-amount');
    if (settingsLbvVal) settingsLbvVal.textContent = store.formatCurrency(liveBookValue);

    const lbvAreasEl = document.getElementById('lbv-summary-areas');
    const lbvClientsEl = document.getElementById('lbv-summary-clients');
    const lbvExposureEl = document.getElementById('lbv-summary-exposure');
    const lbvBookEl = document.getElementById('lbv-summary-book');

    if (lbvAreasEl) lbvAreasEl.textContent = store.getTotalAreas();
    if (lbvClientsEl) lbvClientsEl.textContent = store.getTotalClients();
    if (lbvExposureEl) lbvExposureEl.textContent = store.formatCurrency(store.getTotalExposure(), true);
    if (lbvBookEl) lbvBookEl.textContent = store.formatCurrency(liveBookValue, true);

    this.renderProfileStats();
    if (this.currentView === 'live-book-value') {
      this.renderLiveBookValueBreakdown();
    }

    // 3. Financial Summary 4-Cards Grid
    const initFund = store.data.initialFund;
    const collected = store.getTotalCollected();
    const disbursed = store.getTotalDisbursed();
    const expense = store.getTotalExpenses();
    const closing = store.getClosingBalance();

    const setCardVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = store.formatCurrency(val);
    };

    setCardVal('card-initial-fund', initFund);
    setCardVal('card-collected-amount', collected);
    setCardVal('card-loan-disbursed', disbursed);
    setCardVal('card-expense', expense);

    // 4. Pay Page Summary Cards & Closing Balance Card
    setCardVal('pay-collected-amount', collected);
    setCardVal('pay-loan-disbursed', disbursed);
    setCardVal('pay-expense', expense);
    setCardVal('pay-closing-balance-val', closing);
    setCardVal('main-closing-balance-amount', closing);

    // Dynamic Live Financial Visual in Closing Balance Card
    this.updateClosingBalanceVisual(closing);

    // Closing Breakdown Values
    setCardVal('bd-initial-fund', initFund);
    setCardVal('bd-collected', collected);
    setCardVal('bd-disbursed', disbursed);
    setCardVal('bd-expense', expense);
    setCardVal('bd-closing-balance', closing);

    // 5. Sectors Render
    this.renderSectors();

    // 6. Transactions Table
    this.renderTransactionsTable();
    this.renderHomeRecentTransactions();

    // 7. Customers Table
    this.renderCustomersTable();

    // 8. Dynamic Dropdown Options in Modals
    this.populateModalDropdowns();

    // 9. Re-render client details if we're on that view
    if (this.currentView === 'client-details' && this.currentClientId) {
      this.renderClientDetails(this.currentClientId);
    }

    // 10. Re-render collections search so outstanding values stay live
    this.renderCollectionsSearch();

    // 11. Profile stats strip
    this.renderProfileStats();

    // 12. Audit engine sync
    if (window.auditEngine) {
      window.auditEngine.updateAuditSummaryCard();
      window.auditEngine.renderAuditLogs();
    }
  }

  // ==========================================
  // DYNAMIC CLOSING BALANCE FINANCIAL VISUAL
  // ==========================================
  updateClosingBalanceVisual(closing) {
    const card = document.getElementById('closing-balance-card');
    const badge = document.getElementById('closing-status-badge');
    const bgVisual = document.getElementById('closing-card-bg-visual');
    const svgWrap = document.getElementById('closing-svg-wrap');
    if (!card || !svgWrap) return;

    let mode = 'zero';
    if (closing > 0) mode = 'positive';
    else if (closing < 0) mode = 'negative';

    // Update theme classes on card
    card.classList.remove('theme-positive', 'theme-negative', 'theme-zero');
    card.classList.add(`theme-${mode}`);

    // Update dataset mode on background visual container
    if (bgVisual) {
      bgVisual.dataset.mode = mode;
    }

    // Update Status Pill
    if (badge) {
      badge.className = `closing-status-badge badge-${mode}`;
      if (mode === 'positive') {
        badge.innerHTML = `<span class="badge-dot"></span> ↗ PROFIT / INCREASING`;
      } else if (mode === 'negative') {
        badge.innerHTML = `<span class="badge-dot"></span> ↘ LOSS / DECREASING`;
      } else {
        badge.innerHTML = `<span class="badge-dot"></span> → BALANCED`;
      }
    }

    // Only update inner SVG if state has transitioned or if empty, ensuring continuous animation loops never hitch
    if (svgWrap.dataset.mode !== mode || !svgWrap.firstElementChild) {
      svgWrap.dataset.mode = mode;
      svgWrap.innerHTML = this.generateClosingVisualSvg(mode);
    }
  }

  generateClosingVisualSvg(mode) {
    if (mode === 'positive') {
      return `
        <svg class="closing-full-svg svg-positive" viewBox="0 0 600 240" preserveAspectRatio="none" aria-label="Financial Growth Animation">
          <defs>
            <linearGradient id="posBarGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#059669" stop-opacity="0.15" />
              <stop offset="50%" stop-color="#10B981" stop-opacity="0.65" />
              <stop offset="100%" stop-color="#34D399" stop-opacity="0.95" />
            </linearGradient>
            <linearGradient id="posCapGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#34D399" />
              <stop offset="50%" stop-color="#6EE7B7" />
              <stop offset="100%" stop-color="#A7F3D0" />
            </linearGradient>
            <linearGradient id="posLineGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stop-color="#059669" stop-opacity="0.25" />
              <stop offset="35%" stop-color="#10B981" stop-opacity="0.85" />
              <stop offset="80%" stop-color="#34D399" stop-opacity="1" />
              <stop offset="100%" stop-color="#A7F3D0" stop-opacity="1" />
            </linearGradient>
            <filter id="glow-pos" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <!-- Subtle Background Grid Coordinates -->
          <g class="fin-grid-lines" opacity="0.25">
            <line x1="10" y1="60" x2="590" y2="60" stroke="#10B981" stroke-dasharray="4 8" stroke-width="0.8" />
            <line x1="10" y1="120" x2="590" y2="120" stroke="#10B981" stroke-dasharray="4 8" stroke-width="0.8" />
            <line x1="10" y1="180" x2="590" y2="180" stroke="#10B981" stroke-dasharray="4 8" stroke-width="0.8" />
            <line x1="10" y1="232" x2="590" y2="232" stroke="#34D399" stroke-width="1.2" opacity="0.5" />
          </g>

          <!-- Full-Bleed Continuous Wave Bars (12 bars progressively increasing left to right) -->
          <g class="fin-bars-group">
            <rect class="pos-wave-bar bar-idx-0" x="16" y="202" width="28" height="30" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-0" x="16" y="202" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-1" x="65" y="188" width="28" height="44" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-1" x="65" y="188" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-2" x="114" y="172" width="28" height="60" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-2" x="114" y="172" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-3" x="163" y="154" width="28" height="78" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-3" x="163" y="154" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-4" x="212" y="134" width="28" height="98" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-4" x="212" y="134" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-5" x="261" y="112" width="28" height="120" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-5" x="261" y="112" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-6" x="310" y="90" width="28" height="142" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-6" x="310" y="90" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-7" x="359" y="68" width="28" height="164" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-7" x="359" y="68" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-8" x="408" y="48" width="28" height="184" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-8" x="408" y="48" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-9" x="457" y="30" width="28" height="202" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-9" x="457" y="30" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-10" x="506" y="16" width="28" height="216" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-10" x="506" y="16" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />

            <rect class="pos-wave-bar bar-idx-11" x="555" y="6" width="28" height="226" rx="5" fill="url(#posBarGrad)" />
            <rect class="pos-wave-bar bar-idx-11" x="555" y="6" width="28" height="3.5" rx="1.75" fill="url(#posCapGrad)" />
          </g>

          <!-- Upward-Curving Growth Curve / Arrow & Energy Pulse Stream across the full card -->
          <g class="fin-trend-group">
            <path d="M 16 208 C 160 200, 340 120, 565 24" fill="none" stroke="#10B981" stroke-width="12" stroke-opacity="0.22" stroke-linecap="round" />
            <path d="M 16 208 C 160 200, 340 120, 565 24" fill="none" stroke="url(#posLineGrad)" stroke-width="4.5" stroke-linecap="round" />
            <path class="pos-stream-dash" d="M 16 208 C 160 200, 340 120, 565 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-dasharray="24 60" />

            <!-- Animated Upward Arrowhead Surge -->
            <g class="pos-full-arrow" transform="translate(565, 24)">
              <polygon points="-18,-4 5,-2 -3,20" fill="#34D399" filter="url(#glow-pos)" />
              <circle cx="5" cy="-2" r="5" fill="#A7F3D0" />
              <circle cx="5" cy="-2" r="12" fill="none" stroke="#34D399" stroke-width="1.8" class="apex-beacon-ring" />
            </g>
          </g>

          <!-- Glowing Floating Particles Travelling Upward Along Growth Direction -->
          <g class="fin-particles-group">
            <circle class="pos-fp1" cx="60" cy="195" r="3.5" fill="#6EE7B7" filter="url(#glow-pos)" />
            <circle class="pos-fp2" cx="140" cy="180" r="4.5" fill="#34D399" filter="url(#glow-pos)" />
            <circle class="pos-fp3" cx="230" cy="145" r="4" fill="#A7F3D0" filter="url(#glow-pos)" />
            <circle class="pos-fp4" cx="320" cy="105" r="5" fill="#6EE7B7" filter="url(#glow-pos)" />
            <circle class="pos-fp5" cx="410" cy="65" r="4.5" fill="#34D399" filter="url(#glow-pos)" />
            <circle class="pos-fp6" cx="490" cy="40" r="3.5" fill="#A7F3D0" filter="url(#glow-pos)" />
            <circle class="pos-fp7" cx="540" cy="28" r="3" fill="#ECFDF5" filter="url(#glow-pos)" />
          </g>
        </svg>
      `;
    }

    if (mode === 'negative') {
      return `
        <svg class="closing-full-svg svg-negative" viewBox="0 0 600 240" preserveAspectRatio="none" aria-label="Financial Loss Animation">
          <defs>
            <linearGradient id="negBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F87171" stop-opacity="0.95" />
              <stop offset="50%" stop-color="#EF4444" stop-opacity="0.65" />
              <stop offset="100%" stop-color="#991B1B" stop-opacity="0.15" />
            </linearGradient>
            <linearGradient id="negCapGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#FCA5A5" />
              <stop offset="50%" stop-color="#F87171" />
              <stop offset="100%" stop-color="#EF4444" />
            </linearGradient>
            <linearGradient id="negLineGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FCA5A5" stop-opacity="1" />
              <stop offset="35%" stop-color="#F87171" stop-opacity="0.85" />
              <stop offset="80%" stop-color="#EF4444" stop-opacity="1" />
              <stop offset="100%" stop-color="#B91C1C" stop-opacity="0.25" />
            </linearGradient>
            <filter id="glow-neg" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <!-- Subtle Background Grid Coordinates -->
          <g class="fin-grid-lines" opacity="0.25">
            <line x1="10" y1="60" x2="590" y2="60" stroke="#EF4444" stroke-dasharray="4 8" stroke-width="0.8" />
            <line x1="10" y1="120" x2="590" y2="120" stroke="#EF4444" stroke-dasharray="4 8" stroke-width="0.8" />
            <line x1="10" y1="180" x2="590" y2="180" stroke="#EF4444" stroke-dasharray="4 8" stroke-width="0.8" />
            <line x1="10" y1="232" x2="590" y2="232" stroke="#F87171" stroke-width="1.2" opacity="0.5" />
          </g>

          <!-- Full-Bleed Continuous Wave Bars (12 bars progressively decreasing left to right) -->
          <g class="fin-bars-group">
            <rect class="neg-wave-bar bar-idx-0" x="16" y="6" width="28" height="226" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-0" x="16" y="6" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-1" x="65" y="16" width="28" height="216" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-1" x="65" y="16" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-2" x="114" y="30" width="28" height="202" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-2" x="114" y="30" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-3" x="163" y="48" width="28" height="184" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-3" x="163" y="48" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-4" x="212" y="68" width="28" height="164" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-4" x="212" y="68" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-5" x="261" y="90" width="28" height="142" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-5" x="261" y="90" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-6" x="310" y="112" width="28" height="120" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-6" x="310" y="112" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-7" x="359" y="134" width="28" height="98" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-7" x="359" y="134" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-8" x="408" y="154" width="28" height="78" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-8" x="408" y="154" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-9" x="457" y="172" width="28" height="60" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-9" x="457" y="172" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-10" x="506" y="188" width="28" height="44" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-10" x="506" y="188" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />

            <rect class="neg-wave-bar bar-idx-11" x="555" y="202" width="28" height="30" rx="5" fill="url(#negBarGrad)" />
            <rect class="neg-wave-bar bar-idx-11" x="555" y="202" width="28" height="3.5" rx="1.75" fill="url(#negCapGrad)" />
          </g>

          <!-- Downward-Curving Trend Arrow & Loss Pulse Stream -->
          <g class="fin-trend-group">
            <path d="M 16 24 C 160 40, 340 140, 565 210" fill="none" stroke="#EF4444" stroke-width="12" stroke-opacity="0.22" stroke-linecap="round" />
            <path d="M 16 24 C 160 40, 340 140, 565 210" fill="none" stroke="url(#negLineGrad)" stroke-width="4.5" stroke-linecap="round" />
            <path class="neg-stream-dash" d="M 16 24 C 160 40, 340 140, 565 210" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-dasharray="24 60" />

            <!-- Animated Downward Arrowhead Surge -->
            <g class="neg-full-arrow" transform="translate(565, 210)">
              <polygon points="-18,4 5,2 -3,-20" fill="#F87171" filter="url(#glow-neg)" />
              <circle cx="5" cy="2" r="5" fill="#FECACA" />
              <circle cx="5" cy="2" r="12" fill="none" stroke="#EF4444" stroke-width="1.8" class="apex-beacon-ring" />
            </g>
          </g>

          <!-- Glowing Floating Particles Moving Downward -->
          <g class="fin-particles-group">
            <circle class="neg-fp1" cx="60" cy="35" r="3.5" fill="#FCA5A5" filter="url(#glow-neg)" />
            <circle class="neg-fp2" cx="140" cy="50" r="4.5" fill="#F87171" filter="url(#glow-neg)" />
            <circle class="neg-fp3" cx="230" cy="85" r="4" fill="#EF4444" filter="url(#glow-neg)" />
            <circle class="neg-fp4" cx="320" cy="130" r="5" fill="#FCA5A5" filter="url(#glow-neg)" />
            <circle class="neg-fp5" cx="410" cy="168" r="4.5" fill="#F87171" filter="url(#glow-neg)" />
            <circle class="neg-fp6" cx="490" cy="195" r="3.5" fill="#FCA5A5" filter="url(#glow-neg)" />
            <circle class="neg-fp7" cx="540" cy="208" r="3" fill="#FEF2F2" filter="url(#glow-neg)" />
          </g>
        </svg>
      `;
    }

    // Default / Zero / Balanced mode
    return `
      <svg class="closing-full-svg svg-zero" viewBox="0 0 600 240" preserveAspectRatio="none" aria-label="Financial Balanced Animation">
        <defs>
          <linearGradient id="zeroBarGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#1E293B" stop-opacity="0.3" />
            <stop offset="50%" stop-color="#334155" stop-opacity="0.75" />
            <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.85" />
          </linearGradient>
          <linearGradient id="zeroCapGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#38BDF8" />
            <stop offset="50%" stop-color="#7DD3FC" />
            <stop offset="100%" stop-color="#BAE6FD" />
          </linearGradient>
          <linearGradient id="zeroLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#64748B" />
            <stop offset="50%" stop-color="#38BDF8" />
            <stop offset="100%" stop-color="#7DD3FC" />
          </linearGradient>
          <filter id="glow-zero" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Subtle Background Grid Coordinates -->
        <g class="fin-grid-lines" opacity="0.25">
          <line x1="10" y1="60" x2="590" y2="60" stroke="#38BDF8" stroke-dasharray="4 8" stroke-width="0.8" />
          <line x1="10" y1="130" x2="590" y2="130" stroke="#38BDF8" stroke-dasharray="4 8" stroke-width="0.8" />
          <line x1="10" y1="190" x2="590" y2="190" stroke="#38BDF8" stroke-dasharray="4 8" stroke-width="0.8" />
          <line x1="10" y1="232" x2="590" y2="232" stroke="#475569" stroke-width="1.2" opacity="0.5" />
        </g>

        <!-- Balanced Equal-Height Bars (12 bars across the card) -->
        <g class="fin-bars-group">
          <rect class="zero-wave-bar bar-idx-0" x="16" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-0" x="16" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-1" x="65" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-1" x="65" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-2" x="114" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-2" x="114" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-3" x="163" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-3" x="163" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-4" x="212" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-4" x="212" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-5" x="261" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-5" x="261" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-6" x="310" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-6" x="310" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-7" x="359" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-7" x="359" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-8" x="408" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-8" x="408" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-9" x="457" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-9" x="457" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-10" x="506" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-10" x="506" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />

          <rect class="zero-wave-bar bar-idx-11" x="555" y="136" width="28" height="96" rx="5" fill="url(#zeroBarGrad)" />
          <rect class="zero-wave-bar bar-idx-11" x="555" y="136" width="28" height="3.5" rx="1.75" fill="url(#zeroCapGrad)" />
        </g>

        <!-- Horizontal Steady Line & Pulse Across Whole Box -->
        <g class="fin-trend-group">
          <line x1="16" y1="130" x2="565" y2="130" stroke="#38BDF8" stroke-width="10" stroke-opacity="0.2" stroke-linecap="round" />
          <line x1="16" y1="130" x2="565" y2="130" stroke="url(#zeroLineGrad)" stroke-width="4.5" stroke-linecap="round" />
          <line class="zero-stream-dash" x1="16" y1="130" x2="565" y2="130" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="16 48" />

          <!-- Terminal Arrow Pointing Right -->
          <g class="zero-full-arrow" transform="translate(565, 130)">
            <polygon points="-16,-7 5,0 -16,7" fill="#7DD3FC" filter="url(#glow-zero)" />
            <circle cx="5" cy="0" r="5" fill="#BAE6FD" />
            <circle cx="5" cy="0" r="10" fill="none" stroke="#38BDF8" stroke-width="1.8" class="apex-beacon-ring" />
          </g>
        </g>

        <!-- Neutral Balanced Twinkling Particles -->
        <g class="fin-particles-group">
          <circle class="zero-fp1" cx="120" cy="130" r="3" fill="#7DD3FC" filter="url(#glow-zero)" />
          <circle class="zero-fp2" cx="240" cy="130" r="3.5" fill="#38BDF8" filter="url(#glow-zero)" />
          <circle class="zero-fp3" cx="360" cy="130" r="3" fill="#BAE6FD" filter="url(#glow-zero)" />
          <circle class="zero-fp4" cx="480" cy="130" r="3.5" fill="#7DD3FC" filter="url(#glow-zero)" />
        </g>
      </svg>
    `;
  }

  renderProfileStats() {
    const store = window.financeStore;
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('profile-stat-sectors', store.getTotalAreas());
    setEl('profile-stat-clients', store.getTotalClients());
    const activeLoans = (store.data.loans || []).filter(l => l.status === 'ACTIVE').length;
    setEl('profile-stat-loans', activeLoans);
    setEl('profile-stat-book', store.formatCurrency(store.getLiveBookValue(), true));
    setEl('settings-book-val-badge', store.formatCurrency(store.getLiveBookValue(), true));
  }

  // Open Dedicated Live Book Value Section (Settings -> Live Book Value)
  openLiveBookValueSection() {
    this.switchView('live-book-value');
    this.renderLiveBookValueBreakdown();
  }

  // Render Detailed Financial Areas & Routes Breakdown for Live Book Value
  renderLiveBookValueBreakdown() {
    const container = document.getElementById('lbv-breakdown-container');
    if (!container) return;

    const store = window.financeStore;
    const sectors = store.data.sectors || [];
    const totalBookValue = store.getLiveBookValue();

    if (sectors.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1; padding: 32px; text-align: center;">
          <p>No financial sectors or areas registered yet. Click "+ NEW SECTOR" to create your first area.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sectors.map((sector, idx) => {
      const metrics = store.getSectorMetrics(sector.id);
      const bookVal = store.getSectorBookValue(sector.id);
      const pct = totalBookValue > 0 ? ((bookVal / totalBookValue) * 100).toFixed(1) : '0.0';

      return `
        <div class="sector-card" style="cursor: pointer;" onclick="window.app.openSectorDetails('${sector.id}')" title="Click to view sector roster and clients">
          <div class="sector-card-top">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="sector-name-badge">${sector.name}</div>
                <span style="font-size: 0.7rem; color: #10B981; font-weight: 800; background: rgba(16, 185, 129, 0.1); padding: 2px 7px; border-radius: 4px;">Area ${idx + 1}</span>
              </div>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: inline-block;">Code: ${sector.code}</span>
            </div>
            <span class="sector-client-badge">${metrics.clientCount} Clients</span>
          </div>

          <div style="margin: 14px 0 12px; padding: 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
              <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.05em; text-transform: uppercase;">Area Book Value</span>
              <span style="font-size: 1.25rem; font-weight: 900; color: #10B981;">${store.formatCurrency(bookVal, true)}</span>
            </div>
            <div style="height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 3px; overflow: hidden;">
              <div style="width: ${Math.min(100, Math.max(0, pct))}%; height: 100%; background: linear-gradient(90deg, #10B981, #06B6D4); border-radius: 3px;"></div>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 5px;">
              <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 700;">${pct}% of Total Book Value</span>
            </div>
          </div>

          <div class="sector-metrics-grid">
            <div class="sector-metric-item">
              <div class="sector-metric-label">Exposure</div>
              <div class="sector-metric-val">${store.formatCurrency(metrics.loanExposure, true)}</div>
            </div>
            <div class="sector-metric-item">
              <div class="sector-metric-label">Collected</div>
              <div class="sector-metric-val" style="color: var(--primary-dark);">${store.formatCurrency(metrics.collectedAmount, true)}</div>
            </div>
            <div class="sector-metric-item">
              <div class="sector-metric-label">Outstanding</div>
              <div class="sector-metric-val" style="color: #EA580C;">${store.formatCurrency(metrics.outstandingAmount, true)}</div>
            </div>
          </div>

          <div class="sector-actions-row" onclick="event.stopPropagation();" style="margin-top: 12px;">
            <button class="btn-primary-sm" style="padding: 4px 10px; font-size: 0.72rem;" onclick="window.app.openSectorDetails('${sector.id}')">
              View Clients &amp; Roster &rarr;
            </button>
            <button class="btn-primary-sm" style="padding: 4px 10px; font-size: 0.72rem; margin-left: auto;" onclick="window.app.openNewCustomerScreen('${sector.id}')">
              + Add Client
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Sectors Grid
  renderSectors() {
    const container = document.getElementById('sectors-grid-container');
    if (!container) return;

    const sectors = window.financeStore.data.sectors || [];
    if (sectors.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1;">
          <p>No sectors registered yet. Click "+ NEW SECTOR" to create your first financial area.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = sectors.map(sector => {
      const metrics = window.financeStore.getSectorMetrics(sector.id);
      return `
        <div class="sector-card" style="cursor: pointer;" onclick="window.app.openSectorDetails('${sector.id}')" title="Click to view sector roster and clients">
          <div class="sector-card-top">
            <div>
              <div class="sector-name-badge">${sector.name}</div>
              <span style="font-size: 0.7rem; color: var(--text-muted);">${sector.code}</span>
            </div>
            <span class="sector-client-badge">${metrics.clientCount} Clients</span>
          </div>

          <div class="sector-metrics-grid">
            <div class="sector-metric-item">
              <div class="sector-metric-label">Exposure</div>
              <div class="sector-metric-val">${window.financeStore.formatCurrency(metrics.loanExposure, true)}</div>
            </div>
            <div class="sector-metric-item">
              <div class="sector-metric-label">Collected</div>
              <div class="sector-metric-val" style="color: var(--primary-dark);">${window.financeStore.formatCurrency(metrics.collectedAmount, true)}</div>
            </div>
            <div class="sector-metric-item">
              <div class="sector-metric-label">Outstanding</div>
              <div class="sector-metric-val" style="color: #EA580C;">${window.financeStore.formatCurrency(metrics.outstandingAmount, true)}</div>
            </div>
          </div>

          <div class="sector-actions-row" onclick="event.stopPropagation();">
            <button class="btn-primary-sm" style="padding: 4px 10px; font-size: 0.72rem;" onclick="window.app.openNewCustomerScreen('${sector.id}')" title="Add Client to this Sector">
              + Add Client
            </button>
            <div style="display: flex; gap: 4px; margin-left: auto;">
              <button class="btn-icon-subtle" onclick="window.app.openEditSectorModal('${sector.id}', '${sector.name}')" title="Edit Sector">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
              <button class="btn-icon-subtle delete-btn" onclick="window.app.deleteSectorConfirm('${sector.id}', '${sector.name}')" title="Delete Sector">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Open Sector Details Page
  openSectorDetails(sectorId) {
    this.currentSectorId = sectorId;
    const sector = window.financeStore.data.sectors.find(s => s.id === sectorId) || window.financeStore.data.sectors[0];
    if (!sector) return;

    const titleEl = document.getElementById('sector-detail-title');
    const tableSectorNameEl = document.getElementById('sd-table-sector-name');
    if (titleEl) titleEl.textContent = `${sector.name} (${sector.code})`;
    if (tableSectorNameEl) tableSectorNameEl.textContent = sector.name;

    const metrics = window.financeStore.getSectorMetrics(sector.id);
    const clientCountEl = document.getElementById('sd-client-count');
    const exposureEl = document.getElementById('sd-exposure');
    const collectedEl = document.getElementById('sd-collected');
    const outstandingEl = document.getElementById('sd-outstanding');

    if (clientCountEl) clientCountEl.textContent = metrics.clientCount;
    if (exposureEl) exposureEl.textContent = window.financeStore.formatCurrency(metrics.loanExposure);
    if (collectedEl) collectedEl.textContent = window.financeStore.formatCurrency(metrics.collectedAmount);
    if (outstandingEl) outstandingEl.textContent = window.financeStore.formatCurrency(metrics.outstandingAmount);

    this.renderSectorCustomersTable(sector.id);
    this.switchView('sector-details');
  }

  // Render customers strictly belonging to this sector
  renderSectorCustomersTable(sectorId) {
    const tbody = document.getElementById('sector-customers-tbody');
    if (!tbody) return;

    const customers = (window.financeStore.data.customers || []).filter(c => c.sectorId === sectorId);

    if (customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 36px 20px; color: var(--text-muted);">
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--navy-800); margin-bottom: 4px;">No customers enrolled in this sector yet</div>
            <p style="font-size: 0.8rem; margin-bottom: 12px;">Click "+ Add Client" to create and register the first customer record.</p>
            <button class="btn-primary-sm" style="display: inline-flex;" onclick="window.app.openNewCustomerScreen('${sectorId}')">
              + Add Client
            </button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = customers.map(c => {
      let statusClass = 'status-active';
      if (c.status === 'COMPLETED') statusClass = 'status-completed';
      if (c.status === 'OVERDUE')   statusClass = 'status-overdue';

      const summary = window.financeStore.getClientSummary(c.id);
      const rollDisplay = c.rollNumber ? '#' + c.rollNumber.replace(/^#/, '') : (c.id || c.customerId);

      return `
        <tr class="clickable-row" onclick="window.app.openClientDetails('${c.id}')" style="cursor:pointer;" title="Click to open client details">
          <td style="font-weight: 900; font-family: var(--font-mono); color: var(--primary-dark); font-size: 1rem; letter-spacing: 0.04em;">
            ${rollDisplay}
          </td>
          <td>
            <div style="font-weight: 800; color: var(--navy-900);">${c.fullName || c.name}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">${c.relativeName ? 'S/o ' + c.relativeName : ''}</div>
          </td>
          <td style="font-family: var(--font-mono); font-size: 0.82rem;">
            ${c.phone || '—'}
          </td>
          <td style="color: var(--text-muted); font-size: 0.82rem;">
            ${c.address || '—'}
          </td>
          <td style="font-weight: 800; font-family: var(--font-mono); color: var(--navy-900);">
            ${window.financeStore.formatCurrency(c.loanLimit !== undefined ? c.loanLimit : 10000)}
          </td>
          <td style="font-weight: 800; font-family: var(--font-mono); color: ${summary.totalOutstanding > 0 ? '#EA580C' : 'var(--primary-dark)'}">
            ${window.financeStore.formatCurrency(summary.totalOutstanding)}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${c.status || 'ACTIVE'}</span>
          </td>
          <td style="text-align:right;">
            <button class="btn-primary-sm" onclick="event.stopPropagation();window.app.openClientDetails('${c.id}')" style="padding:4px 10px;font-size:0.72rem;">
              View
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Open Dedicated New Customer Screen
  openNewCustomerScreen(sectorId) {
    const targetSectorId = sectorId || this.currentSectorId || (window.financeStore.data.sectors[0]?.id || 'SEC-004');
    this.currentSectorId = targetSectorId;
    const sector = window.financeStore.data.sectors.find(s => s.id === targetSectorId) || window.financeStore.data.sectors[0];

    const displayEl = document.getElementById('nc-sector-display-name');
    const hiddenEl = document.getElementById('nc-sector-id-hidden');
    if (displayEl && sector) displayEl.textContent = sector.name;
    if (hiddenEl && sector) hiddenEl.value = sector.id;

    // Reset Form fields to fresh state
    const form = document.getElementById('dedicated-new-customer-form');
    if (form) {
      form.reset();
      document.getElementById('nc-loanlimit').value = '10000';
    }

    this.switchView('new-customer');
  }

  // Close New Customer Screen & Return to Sector Details
  closeNewCustomerScreen() {
    if (this.currentSectorId) {
      this.openSectorDetails(this.currentSectorId);
    } else {
      this.switchView('home');
    }
  }

  // Bind Dedicated New Customer Form Submission
  bindDedicatedNewCustomerForm() {
    const form = document.getElementById('dedicated-new-customer-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const fullName = document.getElementById('nc-fullname').value.trim();
      const relativeName = document.getElementById('nc-relativename').value.trim();
      const phone = document.getElementById('nc-phone').value.trim();
      const address = document.getElementById('nc-address').value.trim();
      const loanLimit = document.getElementById('nc-loanlimit').value;
      const sectorId = document.getElementById('nc-sector-id-hidden').value;

      if (!fullName) {
        this.showToast('Full Name is required.', 'error');
        document.getElementById('nc-fullname').focus();
        return;
      }

      if (!relativeName) {
        this.showToast('Husband / Father Name is required.', 'error');
        document.getElementById('nc-relativename').focus();
        return;
      }

      if (!address) {
        this.showToast('Address / Place is required.', 'error');
        document.getElementById('nc-address').focus();
        return;
      }

      if (!loanLimit || Number(loanLimit) <= 0) {
        this.showToast('Please enter a valid Customer Loan Limit.', 'error');
        document.getElementById('nc-loanlimit').focus();
        return;
      }

      const saveBtn = document.getElementById('nc-save-btn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span>Saving Customer...</span>`;
      }

      setTimeout(() => {
        const newCustomer = window.financeStore.addCustomer({
          fullName,
          relativeName,
          phone,
          address,
          loanLimit: Number(loanLimit),
          sectorId
        });

        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<span>Save Customer</span>`;
        }

        const sector = window.financeStore.data.sectors.find(s => s.id === sectorId);
        const rollDisplay = newCustomer.rollNumber ? ' | Roll No: #' + newCustomer.rollNumber : '';
        this.showToast(`Customer "${fullName}"${rollDisplay} saved to ${sector ? sector.name : 'Sector'}!`, 'success');
        
        // Return to the Sector Details view
        this.openSectorDetails(sectorId);
      }, 350);
    });
  }

  // Render Transactions (Transaction History View)
  renderTransactionsTable() {
    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;

    const filterType = this.currentTxnFilter || 'ALL';
    const searchQuery = (document.getElementById('txn-search-input')?.value || '').toLowerCase();

    const list = window.financeStore.getAllTransactions(filterType, searchQuery);

    if (list.length === 0) {
      const msg = searchQuery
        ? `No transactions found matching "${searchQuery}".`
        : filterType !== 'ALL'
          ? `No ${filterType.toLowerCase()} records found.`
          : 'No transactions recorded yet. Record collections, disbursements, or expenses to view history.';

      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--navy-800); margin-bottom: 4px;">No Transactions Displayed</div>
            <div style="font-size: 0.8rem;">${msg}</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(item => this.buildTransactionRowHtml(item)).join('');
  }

  // Render Home Dashboard Recent Transactions Preview
  renderHomeRecentTransactions() {
    const tbody = document.getElementById('home-recent-transactions-tbody');
    if (!tbody) return;

    const list = (window.financeStore.getAllTransactions('ALL') || []).slice(0, 5);

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px 20px; color: var(--text-muted);">
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--navy-800); margin-bottom: 4px;">No Recent Transactions</div>
            <div style="font-size: 0.8rem;">Record collections, disbursements, or expenses to view activity here.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(item => this.buildTransactionRowHtml(item)).join('');
  }

  buildTransactionRowHtml(item) {
    let badgeClass = 'status-active';
    let typeColor = 'var(--primary-dark)';
    let sign = '+';

    if (item.type === 'LOAN') {
      badgeClass = 'status-completed';
      typeColor = '#EA580C';
      sign = '-';
    } else if (item.type === 'EXPENSE') {
      badgeClass = 'status-overdue';
      typeColor = '#DC2626';
      sign = '-';
    }

    const party  = item.party || 'Customer';
    const sub    = item.sub || '';
    const desc   = item.desc || 'General Transaction';
    const id     = item.id || '';
    const safeId = String(id).replace(/'/g, "\\'");
    const date   = item.date || new Date().toISOString().split('T')[0];
    const method = item.method || 'Cash';
    const amount = Number(item.amount || 0);

    return `
      <tr>
        <td>
          <div style="font-weight: 800; color: var(--navy-900);">${party}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${sub}</div>
        </td>
        <td>
          <span class="status-pill ${badgeClass}">${item.type}</span>
        </td>
        <td>
          <div style="font-size: 0.82rem; color: var(--navy-700);">${desc}</div>
          <div style="font-size: 0.7rem; color: var(--text-light); font-family: var(--font-mono);">${id}</div>
        </td>
        <td>
          <div style="font-size: 0.82rem; font-weight: 700;">${date}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${method}</div>
        </td>
        <td style="font-weight: 800; font-family: var(--font-mono); color: ${typeColor};">
          ${sign} ${window.financeStore.formatCurrency(amount)}
        </td>
        <td style="text-align: right;">
          <button class="btn-icon-subtle" onclick="window.app.showReceiptModal('${safeId}', '${item.type}')" title="View Voucher">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </button>
          <button class="btn-icon-subtle delete-btn" onclick="window.app.deleteTransactionWithFeedback('${safeId}', '${item.type}')" title="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      </tr>
    `;
  }

  // Render Customers
  renderCustomersTable() {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;

    const customers = window.financeStore.data.customers || [];
    const search = (document.getElementById('customer-search-input')?.value || '').toLowerCase();

    let filtered = customers;
    if (search) {
      filtered = customers.filter(c => 
        c.name.toLowerCase().includes(search) ||
        c.id.toLowerCase().includes(search) ||
        c.phone.includes(search)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">
            No client records found.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const sector = window.financeStore.data.sectors.find(s => s.id === c.sectorId);
      let statusClass = 'status-active';
      if (c.status === 'COMPLETED') statusClass = 'status-completed';
      if (c.status === 'OVERDUE') statusClass = 'status-overdue';
      const rollDisplay = c.rollNumber ? '#' + c.rollNumber.replace(/^#/, '') : '—';
      const summary = window.financeStore.getClientSummary(c.id);

      return `
        <tr class="clickable-row" onclick="window.app.openClientDetails('${c.id}')" style="cursor:pointer;" title="Click to open client details">
          <td style="font-weight: 900; font-family: var(--font-mono); color: var(--primary-dark); font-size: 0.98rem;">
            ${rollDisplay}
          </td>
          <td>
            <div style="font-weight: 800; color: var(--navy-900);">${c.fullName || c.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">${c.id || c.customerId}</div>
          </td>
          <td>
            <div style="font-size: 0.82rem; color: var(--navy-800);">${c.phone || '—'}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${sector ? sector.name : 'General'}</div>
          </td>
          <td style="font-weight: 800; font-family: var(--font-mono);">
            ${window.financeStore.formatCurrency(c.loanLimit !== undefined ? c.loanLimit : 10000)}
          </td>
          <td style="font-weight: 800; font-family: var(--font-mono); color: ${summary.totalOutstanding > 0 ? '#EA580C' : '#059669'};">
            ${window.financeStore.formatCurrency(summary.totalOutstanding)}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${c.status || 'ACTIVE'}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Populate Dropdowns in Modals
  populateModalDropdowns() {
    const store = window.financeStore;

    // Customer Select in Collect Payment Modal (Requirement 17)
    const payCustSelect = document.getElementById('pay-customer-select');
    if (payCustSelect) {
      payCustSelect.innerHTML = '<option value="">-- Choose Registered Customer --</option>' + 
        store.data.customers.map(c => {
          const activeLoan = store.getActiveLoan(c.id);
          const out = activeLoan ? activeLoan.outstandingAmount : 0;
          const roll = c.rollNumber ? '#' + c.rollNumber.replace(/^#/, '') : c.id;
          return `
            <option value="${c.id}" data-name="${c.name || c.fullName}" data-has-active="${Boolean(activeLoan)}" data-outstanding="${out}">
              ${roll} ${c.name || c.fullName} — ${activeLoan ? `Active Loan: ${store.formatCurrency(out)}` : 'No Active Loan'}
            </option>`;
        }).join('');

      payCustSelect.onchange = () => {
        const custId = payCustSelect.value;
        const loanInput = document.getElementById('pay-loan-id');
        const amtInput  = document.getElementById('pay-amount');

        if (!custId) {
          if (loanInput) loanInput.value = '';
          if (amtInput) amtInput.value = '';
          return;
        }

        const activeLoan = store.getActiveLoan(custId);
        if (activeLoan && Number(activeLoan.outstandingAmount || 0) > 0) {
          if (loanInput) loanInput.value = activeLoan.id;
          if (amtInput) {
            amtInput.removeAttribute('max');
            amtInput.placeholder = `Enter amount (Active Loan Outstanding: ${store.formatCurrency(activeLoan.outstandingAmount)})`;
          }
        } else {
          if (loanInput) loanInput.value = '';
          if (amtInput) {
            amtInput.removeAttribute('max');
            amtInput.placeholder = 'Enter payment amount (₹)';
          }
        }
      };
    }

    // Collections Sector Select (Roll No. Search)
    const colSectorSelect = document.getElementById('collections-sector-select');
    if (colSectorSelect) {
      const currentVal = colSectorSelect.value;
      colSectorSelect.innerHTML = '<option value="">— All Sectors —</option>' +
        store.data.sectors.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      if (currentVal) colSectorSelect.value = currentVal;
    }

    // Sector Select in Disburse Loan Modal
    const loanSectorSelect = document.getElementById('loan-sector-select');
    if (loanSectorSelect) {
      loanSectorSelect.innerHTML = store.data.sectors.map(s => `
        <option value="${s.id}">${s.name} (${s.code})</option>
      `).join('');
    }

    // Sector Select in Add Customer Modal
    const custSectorSelect = document.getElementById('cust-sector-select');
    if (custSectorSelect) {
      custSectorSelect.innerHTML = store.data.sectors.map(s => `
        <option value="${s.id}">${s.name}</option>
      `).join('');
    }
  }

  // ==========================================
  // MODAL HANDLERS & BINDINGS
  // ==========================================
  bindModals() {
    // Modal Close Buttons
    document.querySelectorAll('.modal-close-btn, .modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) this.closeModal(modal.id);
      });
    });

    // Close on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModal(overlay.id);
        }
      });
    });

    // Audit Coming Soon: Back to Home button
    const auditBackHomeBtn = document.getElementById('audit-cs-back-home-btn');
    if (auditBackHomeBtn) {
      auditBackHomeBtn.addEventListener('click', (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.closeModal('audit-coming-soon-modal');
        this.switchView('home');
      });
    }

    // 1. Collect Payment Form Submit
    const collectPaymentForm = document.getElementById('collect-payment-form');
    if (collectPaymentForm) {
      collectPaymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const custSelect = document.getElementById('pay-customer-select');
        const custId = custSelect.value;
        const selectedOption = custSelect.options[custSelect.selectedIndex];
        const custName = selectedOption ? selectedOption.dataset.name : 'Customer';
        const loanId = document.getElementById('pay-loan-id').value.trim();
        const amount = document.getElementById('pay-amount').value;
        const date = document.getElementById('pay-date').value;
        const method = document.getElementById('pay-method').value;
        const notes = document.getElementById('pay-notes').value.trim();

        if (!custId || !amount) {
          this.showToast('Please select a customer and enter payment amount.', 'error');
          return;
        }

        try {
          const recorded = window.financeStore.collectPayment({
            customerId: custId,
            customerName: custName,
            loanId: loanId,
            amount: amount,
            date: date,
            method: method,
            notes: notes
          });

          this.closeModal('collect-payment-modal');
          collectPaymentForm.reset();
          this.showToast(`Collection of ${window.financeStore.formatCurrency(amount)} recorded successfully!`, 'success');
          this.renderAllViews();
        } catch (err) {
          this.showToast(err.message || 'Error recording collection payment.', 'error');
        }
      });
    }

    // 2. Disburse Loan Form Submit
    const disburseLoanForm = document.getElementById('disburse-loan-form');
    if (disburseLoanForm) {
      disburseLoanForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('loan-cust-name').value.trim();
        const phone = document.getElementById('loan-cust-phone').value.trim();
        const sectorId = document.getElementById('loan-sector-select').value;
        const amount = document.getElementById('loan-amount-input').value;
        const interest = document.getElementById('loan-interest-input').value;
        const tenure = document.getElementById('loan-tenure-input').value;
        const date = document.getElementById('loan-date-input').value;
        const method = document.getElementById('loan-method-select').value;
        const notes = document.getElementById('loan-notes-input').value.trim();

        if (!name || !amount) {
          this.showToast('Customer Name and Loan Amount are required.', 'error');
          return;
        }

        window.financeStore.disburseLoan({
          customerName: name,
          phone: phone,
          sectorId: sectorId,
          amount: amount,
          interestRate: interest,
          tenureMonths: tenure,
          date: date,
          method: method,
          notes: notes
        });

        this.closeModal('disburse-loan-modal');
        disburseLoanForm.reset();
        this.showToast(`Loan of ${window.financeStore.formatCurrency(amount)} disbursed to ${name}!`, 'success');
      });
    }

    // 3. Add Expense Form Submit
    const addExpenseForm = document.getElementById('add-expense-form');
    if (addExpenseForm) {
      addExpenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const category = document.getElementById('exp-category-select').value;
        const desc = document.getElementById('exp-desc-input').value.trim();
        const amount = document.getElementById('exp-amount-input').value;
        const date = document.getElementById('exp-date-input').value;
        const method = document.getElementById('exp-method-select').value;

        if (!amount || !desc) {
          this.showToast('Please enter expense description and amount.', 'error');
          return;
        }

        window.financeStore.addExpense({
          category: category,
          description: desc,
          amount: amount,
          date: date,
          method: method
        });

        this.closeModal('add-expense-modal');
        addExpenseForm.reset();
        this.showToast(`Expense of ${window.financeStore.formatCurrency(amount)} logged!`, 'success');
      });
    }

    // 4. Add Sector Form Submit
    const newSectorForm = document.getElementById('new-sector-form');
    if (newSectorForm) {
      newSectorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('sector-name-input').value.trim();
        const code = document.getElementById('sector-code-input').value.trim();

        if (!name) {
          this.showToast('Sector name is required.', 'error');
          return;
        }

        window.financeStore.addSector(name, code);
        this.closeModal('new-sector-modal');
        newSectorForm.reset();
        this.showToast(`New Sector "${name}" registered!`, 'success');
      });
    }

    // 5. Add Customer Form Submit
    const newCustForm = document.getElementById('new-customer-form');
    if (newCustForm) {
      newCustForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('cust-name-input').value.trim();
        const phone = document.getElementById('cust-phone-input').value.trim();
        const email = document.getElementById('cust-email-input').value.trim();
        const address = document.getElementById('cust-address-input').value.trim();
        const sectorId = document.getElementById('cust-sector-select').value;
        const initialLoan = document.getElementById('cust-loan-amount-input').value;

        if (!name || !phone) {
          this.showToast('Client Name and Phone are required.', 'error');
          return;
        }

        window.financeStore.addCustomer({
          name, phone, email, address, sectorId, loanAmount: initialLoan
        });

        this.closeModal('new-customer-modal');
        newCustForm.reset();
        this.showToast(`Client ${name} enrolled successfully!`, 'success');
      });
    }

    // 6. Set Initial Fund Modal Submit
    const initialFundForm = document.getElementById('initial-fund-form');
    if (initialFundForm) {
      initialFundForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fund = document.getElementById('initial-fund-modal-input').value;
        window.financeStore.setInitialFund(fund);
        this.closeModal('initial-fund-modal');
        this.showToast(`Initial Capital updated to ${window.financeStore.formatCurrency(fund)}`, 'success');
      });
    }

    // 7. Edit Profile Form
    const editProfileForm = document.getElementById('edit-profile-form');
    if (editProfileForm) {
      editProfileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('edit-prof-name').value.trim();
        const email = document.getElementById('edit-prof-email').value.trim();
        const phone = document.getElementById('edit-prof-phone').value.trim();

        window.financeStore.saveUser({ name, email, phone });
        this.closeModal('edit-profile-modal');
        this.showToast('Profile credentials saved!', 'success');
      });
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      // Auto fill today's date on date inputs
      const today = new Date().toISOString().split('T')[0];
      modal.querySelectorAll('input[type="date"]').forEach(d => {
        if (!d.value) d.value = today;
      });

      modal.classList.add('active');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  // ==========================================
  // DASHBOARD ACTIONS & BUTTONS
  // ==========================================
  bindDashboardActions() {
    // Open Sector Modal
    const newSectorBtn = document.getElementById('open-new-sector-btn');
    if (newSectorBtn) {
      newSectorBtn.addEventListener('click', () => this.openModal('new-sector-modal'));
    }

    // Open Initial Fund Modal from card
    const initialFundCard = document.getElementById('card-initial-fund-box');
    if (initialFundCard) {
      initialFundCard.addEventListener('click', () => {
        document.getElementById('initial-fund-modal-input').value = window.financeStore.data.initialFund;
        this.openModal('initial-fund-modal');
      });
    }
  }

  // ==========================================
  // PAY ACTIONS & CLOSING BREAKDOWN
  // ==========================================
  bindPayActions() {
    // Breakdown Drawer Toggle
    const toggleBtn = document.getElementById('toggle-breakdown-btn');
    const drawer = document.getElementById('breakdown-drawer');
    if (toggleBtn && drawer) {
      toggleBtn.addEventListener('click', () => {
        drawer.classList.toggle('open');
        const isOpen = drawer.classList.contains('open');
        toggleBtn.innerHTML = isOpen ? 
          `Hide Mathematical Breakdown <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>` : 
          `View Mathematical Breakdown <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
      });
    }

    // Collect Payment Button
    const collectBtn = document.getElementById('open-collect-modal-btn');
    if (collectBtn) {
      collectBtn.addEventListener('click', () => {
        this.populateModalDropdowns();
        const amtInput = document.getElementById('pay-amount');
        if (amtInput) amtInput.value = '';
        this.openModal('collect-payment-modal');
      });
    }

    // Disburse Loan Button
    const disburseBtn = document.getElementById('open-disburse-modal-btn');
    if (disburseBtn) {
      disburseBtn.addEventListener('click', () => {
        this.populateModalDropdowns();
        this.openModal('disburse-loan-modal');
      });
    }

    // Add Expense Button
    const expenseBtn = document.getElementById('open-expense-modal-btn');
    if (expenseBtn) {
      expenseBtn.addEventListener('click', () => this.openModal('add-expense-modal'));
    }
  }

  // ==========================================
  // SEARCH & FILTER CHIPS
  // ==========================================
  bindSearchAndFilters() {
    // Transaction Filter Chips
    const chips = document.querySelectorAll('.txn-filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentTxnFilter = chip.dataset.filter;
        this.renderTransactionsTable();
      });
    });

    // Transaction Search
    const txnSearch = document.getElementById('txn-search-input');
    if (txnSearch) {
      txnSearch.addEventListener('input', () => this.renderTransactionsTable());
    }

    // Customer Search
    const custSearch = document.getElementById('customer-search-input');
    if (custSearch) {
      custSearch.addEventListener('input', () => this.renderCustomersTable());
    }

    // Export CSV
    const exportBtn = document.getElementById('export-transactions-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportTransactionsCSV());
    }

    // Collections Roll No. Search + Sector filter
    const rollSearch    = document.getElementById('collections-roll-search');
    const sectorFilter  = document.getElementById('collections-sector-select');
    const renderCollect = () => this.renderCollectionsSearch();
    if (rollSearch)   rollSearch.addEventListener('input', renderCollect);
    if (sectorFilter) sectorFilter.addEventListener('change', renderCollect);
  }

  /* ============================================================
     COLLECTIONS — ROLL NUMBER SEARCH RENDER
     ============================================================ */
  renderCollectionsSearch() {
    const store     = window.financeStore;
    const container = document.getElementById('collections-result-container');
    if (!container) return;

    const rawInput   = (document.getElementById('collections-roll-search')?.value || '').trim();
    const sectorId   = document.getElementById('collections-sector-select')?.value || '';

    // If nothing typed, show placeholder text
    if (!rawInput) {
      container.innerHTML = `
        <div style="text-align:center;padding:22px 16px;color:var(--text-muted);font-size:0.88rem;">
          Enter a Roll Number above to find a customer (e.g. <strong>#A01</strong> or <strong>C02</strong>)
        </div>`;
      return;
    }

    // Normalize input: strip # and uppercase
    const norm = rawInput.replace(/^#/, '').trim().toUpperCase();

    // Find matching customers (partial match supported)
    let customers = store.data.customers.filter(c => {
      const cRoll = (c.rollNumber || '').replace(/^#/, '').trim().toUpperCase();
      const match = cRoll === norm || cRoll.startsWith(norm);
      if (sectorId) return match && c.sectorId === sectorId;
      return match;
    });

    if (customers.length === 0) {
      // Check if it's a sector mismatch (customer exists in another sector)
      const anywhereMatch = store.data.customers.find(c => {
        const cRoll = (c.rollNumber || '').replace(/^#/, '').trim().toUpperCase();
        return cRoll === norm;
      });

      if (anywhereMatch && sectorId) {
        const sec = store.data.sectors.find(s => s.id === anywhereMatch.sectorId);
        container.innerHTML = `
          <div style="padding:16px;background:#FEF3C7;border-radius:12px;border:1.5px solid #FCD34D;color:#92400E;font-size:0.88rem;font-weight:700;">
            <strong>#${norm}</strong> belongs to sector <strong>${sec ? sec.name : anywhereMatch.sectorId}</strong>, not the selected sector. Change sector filter or clear it.
          </div>`;
      } else {
        container.innerHTML = `
          <div style="padding:16px;background:#FEF2F2;border-radius:12px;border:1.5px solid #FECACA;color:#991B1B;font-size:0.88rem;font-weight:700;">
            No customer found with Roll No. <strong>#${norm}</strong>.
          </div>`;
      }
      return;
    }

    container.innerHTML = customers.map(c => {
      const activeLoan    = store.getActiveLoan(c.id);
      const outstanding   = activeLoan ? Math.max(0, Number(activeLoan.outstandingAmount || 0)) : 0;
      const rollDisplay   = '#' + (c.rollNumber || '').replace(/^#/, '');
      const sector        = store.data.sectors.find(s => s.id === c.sectorId);
      const avatarLetter  = (c.fullName || c.name || 'C').charAt(0).toUpperCase();
      const hasLoan       = Boolean(activeLoan && outstanding > 0);
      const statusColor   = hasLoan ? '#EA580C' : '#059669';
      const statusLabel   = hasLoan ? 'Active Loan' : (activeLoan ? 'Fully Paid' : 'No Loan');

      return `
        <div class="collections-customer-card" onclick="window.app.openClientDetails('${c.id}')" style="
          display:flex;align-items:center;gap:14px;padding:14px 18px;
          background:#fff;border-radius:14px;border:1.5px solid var(--border-light);
          margin-bottom:10px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.06);
          transition:box-shadow .15s,border-color .15s;
        " onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,.12)';this.style.borderColor='var(--primary-dark)';"
           onmouseleave="this.style.boxShadow='0 2px 8px rgba(0,0,0,.06)';this.style.borderColor='var(--border-light)';">

          <!-- Avatar -->
          <div style="width:46px;height:46px;border-radius:50%;background:var(--primary-dark);color:#fff;
                      display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.1rem;flex-shrink:0;">
            ${avatarLetter}
          </div>

          <!-- Info -->
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-weight:900;font-family:var(--font-mono);color:var(--primary-dark);font-size:1rem;">${rollDisplay}</span>
              <span style="font-weight:800;color:var(--navy-900);font-size:0.95rem;">${c.fullName || c.name}</span>
            </div>
            ${c.relativeName ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:1px;">S/O ${c.relativeName}</div>` : ''}
            <div style="display:flex;gap:12px;margin-top:4px;flex-wrap:wrap;align-items:center;">
              ${c.phone ? `<span style="font-size:0.8rem;color:var(--navy-700);">📞 ${c.phone}</span>` : ''}
              ${sector   ? `<span style="font-size:0.75rem;color:var(--text-muted);">📂 ${sector.name}</span>` : ''}
            </div>
          </div>

          <!-- Outstanding + status -->
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-weight:900;font-family:var(--font-mono);color:${statusColor};font-size:1rem;">
              ${store.formatCurrency(outstanding)}
            </div>
            <div style="font-size:0.72rem;font-weight:700;color:${statusColor};margin-top:2px;">${statusLabel}</div>
            <div style="margin-top:6px;">
              ${hasLoan ? `
                <button type="button" class="btn-pay-now" onclick="event.stopPropagation(); window.app.openClientPaymentModal('${c.id}', '${activeLoan.id}')" style="
                  padding: 5px 12px; font-size: 0.75rem; font-weight: 800; border-radius: 8px; border: none; cursor: pointer;
                  background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: #fff;
                  box-shadow: 0 2px 6px rgba(15,98,254,0.3); display: inline-flex; align-items: center; gap: 4px;
                  transition: transform 0.12s, box-shadow 0.12s;"
                  onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 10px rgba(15,98,254,0.4)';"
                  onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 6px rgba(15,98,254,0.3)';"
                  title="Record payment for ${c.fullName || c.name}">
                  ⚡ Pay Now
                </button>
              ` : `
                <span style="font-size:0.72rem;padding:3px 8px;border-radius:20px;
                  background:#DCFCE7;color:#166534;font-weight:700;display:inline-block;">
                  ✓ Clear
                </span>
              `}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  exportTransactionsCSV() {
    const list = window.financeStore.getAllTransactions('ALL');
    const rows = list.map(item => {
      const party = (item.party || '').replace(/"/g, '""');
      const desc  = (item.desc || '').replace(/"/g, '""');
      return `"${item.id}","${item.type}","${party}","${desc}","${item.amount}","${item.date}","${item.method}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      'Transaction ID,Type,Counterparty,Description,Amount,Date,Payment Method',
      ...rows
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `microfi_Transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast('Transaction statement exported to CSV!', 'success');
  }

  // ==========================================
  // PROFILE & SETTINGS
  // ==========================================
  bindProfileActions() {
    // Edit Profile Modal
    const editProfBtn = document.getElementById('open-edit-profile-btn');
    if (editProfBtn) {
      editProfBtn.addEventListener('click', () => {
        const u = window.financeStore.currentUser;
        document.getElementById('edit-prof-name').value = u.name;
        document.getElementById('edit-prof-email').value = u.email;
        document.getElementById('edit-prof-phone').value = u.phone;
        this.openModal('edit-profile-modal');
      });
    }

    // Currency Setting
    const currencySelect = document.getElementById('currency-setting-select');
    if (currencySelect) {
      currencySelect.value = window.financeStore.currentUser.currency || '₹';
      currencySelect.addEventListener('change', (e) => {
        window.financeStore.saveUser({ currency: e.target.value });
        this.showToast(`Currency updated to ${e.target.value}`, 'success');
      });
    }

    // Reset Database
    const resetBtn = document.getElementById('reset-db-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all data back to the default demo financial books?')) {
          window.financeStore.resetDatabase();
          this.showToast('System reset to demo books.', 'info');
        }
      });
    }
  }

  // Edit Sector Modal trigger
  openEditSectorModal(sectorId, currentName) {
    const newName = prompt('Enter updated sector name:', currentName);
    if (newName && newName.trim()) {
      window.financeStore.editSector(sectorId, newName);
      this.showToast(`Sector updated to ${newName.toUpperCase()}`, 'success');
    }
  }

  deleteSectorConfirm(sectorId, name) {
    if (confirm(`Delete financial sector "${name}"? Active clients in this sector will remain in directory.`)) {
      window.financeStore.deleteSector(sectorId);
      this.showToast(`Sector "${name}" removed.`, 'warning');
    }
  }

  showReceiptModal(txnId, type) {
    const modal = document.getElementById('voucher-modal');
    if (!modal) return;

    let title  = 'Financial Voucher';
    let party  = 'N/A';
    let amount = 0;
    let date   = '';
    let method = '';
    let notes  = '';

    const normType = (type || '').toUpperCase();

    if (normType === 'COLLECTION' || normType === 'INFLOW' || normType === 'PAYMENT') {
      const p = (window.financeStore.data.payments || []).find(x => x.id === txnId);
      if (p) {
        title = 'Payment Collection Receipt';
        let custName = p.customerName;
        if (!custName && p.customerId) {
          const c = (window.financeStore.data.customers || []).find(cust => cust.id === p.customerId);
          if (c) custName = c.fullName || c.name;
        }
        party = custName || 'Customer';
        amount = p.amount;
        date = p.date;
        method = p.method || 'Cash';
        notes = `Loan ID: ${p.loanId || 'N/A'} — ${p.notes || 'Collection Installment'}`;
      }
    } else if (normType === 'LOAN' || normType === 'DISBURSEMENT' || normType === 'OUTFLOW') {
      const l = (window.financeStore.data.loans || []).find(x => x.id === txnId);
      if (l) {
        title = 'Loan Disbursement Voucher';
        let custName = l.customerName;
        if (!custName && l.customerId) {
          const c = (window.financeStore.data.customers || []).find(cust => cust.id === l.customerId);
          if (c) custName = c.fullName || c.name;
        }
        party = custName || 'Borrower';
        amount = l.amount;
        date = l.disbursementDate || l.date;
        method = l.paymentMethod || l.method || 'Bank Transfer';
        notes = `Tenure: ${l.tenureMonths || 12}m @ ${l.interestRate || 12}% — ${l.notes || 'Loan Principal'}`;
      }
    } else if (normType === 'EXPENSE') {
      const e = (window.financeStore.data.expenses || []).find(x => x.id === txnId);
      if (e) {
        title = 'Expense Payment Voucher';
        party = e.category || 'Operational Outflow';
        amount = e.amount;
        date = e.date;
        method = e.method || 'Cash';
        notes = e.description || 'Operating Expense';
      }
    }

    document.getElementById('voucher-title').textContent = title;
    document.getElementById('voucher-id').textContent = txnId;
    document.getElementById('voucher-party').textContent = party;
    document.getElementById('voucher-amount').textContent = window.financeStore.formatCurrency(amount);
    document.getElementById('voucher-date').textContent = date;
    document.getElementById('voucher-method').textContent = method;
    document.getElementById('voucher-notes').textContent = notes;

    this.openModal('voucher-modal');
  }

  deleteTransactionWithFeedback(id, type) {
    if (!id) return;
    if (confirm(`Are you sure you want to delete transaction "${id}"? This will permanently update the books.`)) {
      const ok = window.financeStore.deleteTransaction(id, type);
      if (ok) {
        this.showToast(`Transaction ${id} deleted successfully.`, 'info');
      } else {
        this.showToast(`Could not locate transaction ${id}.`, 'error');
      }
    }
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    if (type === 'error') {
      icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (type === 'warning' || type === 'info') {
      icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /* ============================================================
     CLIENT DETAILS — OPEN / CLOSE
     ============================================================ */
  openClientDetails(customerId) {
    const customer = window.financeStore.data.customers.find(c => c.id === customerId);
    if (!customer) { this.showToast('Customer record not found.', 'error'); return; }
    this.currentClientId = customerId;
    // Track which sector we came from so back-button works
    if (customer.sectorId) this.currentSectorId = customer.sectorId;
    this.renderClientDetails(customerId);
    this.switchView('client-details');
  }

  closeClientDetails() {
    if (this.currentSectorId) {
      this.openSectorDetails(this.currentSectorId);
    } else {
      this.switchView('home');
    }
  }

  /* ============================================================
     CLIENT DETAILS — RENDER
     ============================================================ */
  /* ============================================================
     CLIENT DETAILS — RENDER
     ============================================================ */
  renderClientDetails(customerId) {
    const store    = window.financeStore;
    const customer = store.data.customers.find(c => c.id === customerId);
    if (!customer) return;

    const sector  = store.data.sectors.find(s => s.id === customer.sectorId);
    const summary = store.getClientSummary(customerId);
    const activeLoan = store.getActiveLoan(customerId);
    const hasActiveLoan = Boolean(activeLoan && Number(activeLoan.outstandingAmount || 0) > 0);
    const loanLimit = store.getCustomerLoanLimit(customerId);
    const availableForLoan = hasActiveLoan ? 0 : loanLimit;

    // ---- Header ----
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
    const rollDisplay = customer.rollNumber ? '#' + customer.rollNumber.replace(/^#/, '') : '';
    setTxt('cd-customer-name', rollDisplay ? `${rollDisplay}  ${customer.fullName || customer.name}` : (customer.fullName || customer.name));
    setTxt('cd-customer-id-display', 'Customer ID: ' + customer.id);

    // ---- Personal Info ----
    setTxt('cd-fullname',     customer.fullName || customer.name);
    setTxt('cd-relativename', customer.relativeName);
    setTxt('cd-phone',        customer.phone);
    setTxt('cd-address',      customer.address);
    setTxt('cd-sector-name',  sector ? sector.name : 'Unknown');
    setTxt('cd-loanlimit',    store.formatCurrency(loanLimit));
    setTxt('cd-joined',       customer.createdAt || 'N/A');

    // ---- Status badge ----
    const badge = document.getElementById('cd-status-badge');
    if (badge) {
      badge.textContent = hasActiveLoan ? 'ACTIVE' : 'PAID';
      badge.className   = 'status-pill ' + (hasActiveLoan ? 'status-active' : 'status-completed');
    }

    // ---- Requirement 11: 4 Key Indicators ----
    setTxt('cd-loanlimit-stat',       store.formatCurrency(loanLimit));
    setTxt('cd-total-outstanding',    store.formatCurrency(summary.totalOutstanding));
    setTxt('cd-available-limit-stat', store.formatCurrency(availableForLoan));
    
    const outEl = document.getElementById('cd-total-outstanding');
    if (outEl) {
      outEl.style.color = summary.totalOutstanding > 0 ? '#EA580C' : '#059669';
    }

    const availSub = document.getElementById('cd-available-sub');
    if (availSub) {
      availSub.textContent = hasActiveLoan ? 'Blocked: Active loan exists' : 'Eligible for new loan';
      availSub.style.color = hasActiveLoan ? '#D97706' : '#059669';
    }

    const activeStatEl = document.getElementById('cd-has-active-stat');
    if (activeStatEl) {
      activeStatEl.innerHTML = hasActiveLoan
        ? `<span class="badge-blocked" style="font-size:0.88rem;padding:4px 12px;">Yes</span>`
        : `<span class="badge-eligible" style="font-size:0.88rem;padding:4px 12px;">No</span>`;
    }

    const activeSub = document.getElementById('cd-has-active-sub');
    if (activeSub) {
      activeSub.textContent = hasActiveLoan 
        ? `₹${activeLoan.outstandingAmount.toLocaleString('en-IN')} outstanding`
        : 'Eligible for new loan';
    }

    // ---- Cumulative Totals ----
    setTxt('cd-total-loan', store.formatCurrency(summary.totalLoan));
    setTxt('cd-total-paid', store.formatCurrency(summary.totalPaid));

    const cbRow = document.getElementById('cd-credit-balance-row');
    const cbVal = document.getElementById('cd-credit-balance');
    if (cbRow) cbRow.style.display = summary.creditBalance > 0 ? 'flex' : 'none';
    if (cbVal) cbVal.textContent   = store.formatCurrency(summary.creditBalance);

    // ---- Create Loan Button State (Requirement 11 & 18) ----
    const createBtn = document.getElementById('cd-create-loan-btn');
    if (createBtn) {
      if (hasActiveLoan) {
        createBtn.className = 'btn-primary-sm btn-restricted';
        createBtn.title = `Active loan has ${store.formatCurrency(activeLoan.outstandingAmount)} outstanding. Collect remaining amount first.`;
      } else {
        createBtn.className = 'btn-primary-sm';
        createBtn.title = 'Customer is eligible for a new loan.';
      }
    }

    // ---- Add Payment Button State ----
    const payBtn = document.getElementById('cd-add-payment-btn');
    if (payBtn) {
      if (!hasActiveLoan) {
        payBtn.style.opacity = '0.5';
        payBtn.title = 'No active loan to collect payment for.';
      } else {
        payBtn.style.opacity = '1';
        payBtn.title = `Record payment against ${activeLoan.id}`;
      }
    }

    // ---- Loans sections ----
    this.renderClientLoans(customerId);

    // ---- Payment history ----
    this.renderClientPaymentHistory(customerId);
  }

  renderClientLoans(customerId) {
    const store     = window.financeStore;
    const activeContainer  = document.getElementById('cd-active-loan-container');
    const historyContainer = document.getElementById('cd-loan-history-container');
    if (!activeContainer || !historyContainer) return;

    const allLoans = store.getCustomerLoans(customerId);
    const activeLoan = allLoans.find(l => Number(l.outstandingAmount || 0) > 0);
    const historyLoans = allLoans.filter(l => Number(l.outstandingAmount || 0) === 0);

    // 1. Render ACTIVE LOAN section (Requirement 12 & 15)
    if (activeLoan) {
      const paidPct = activeLoan.amount > 0 ? Math.min(100, Math.round(((activeLoan.paidAmount || 0) / activeLoan.amount) * 100)) : 0;
      activeContainer.innerHTML = `
        <div class="loan-card" style="border-left: 4px solid #EA580C;">
          <div class="loan-card-header">
            <div>
              <div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em;">LOAN ID</div>
              <div style="font-weight:800;font-family:var(--font-mono);color:var(--navy-900);font-size:0.95rem;">${activeLoan.id}</div>
              ${activeLoan.notes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${activeLoan.notes}</div>` : ''}
            </div>
            <span class="status-pill status-active">ACTIVE</span>
          </div>

          <div class="loan-metrics-grid">
            <div class="loan-metric">
              <div class="loan-metric-label">PRINCIPAL</div>
              <div class="loan-metric-val">${store.formatCurrency(activeLoan.amount)}</div>
            </div>
            <div class="loan-metric">
              <div class="loan-metric-label">PAID</div>
              <div class="loan-metric-val" style="color:var(--primary-dark);">${store.formatCurrency(activeLoan.paidAmount || 0)}</div>
            </div>
            <div class="loan-metric">
              <div class="loan-metric-label">OUTSTANDING</div>
              <div class="loan-metric-val" style="color:#EA580C;">${store.formatCurrency(activeLoan.outstandingAmount || 0)}</div>
            </div>
            <div class="loan-metric">
              <div class="loan-metric-label">INTEREST</div>
              <div class="loan-metric-val">${activeLoan.interestRate}% p.a.</div>
            </div>
            <div class="loan-metric">
              <div class="loan-metric-label">TENURE</div>
              <div class="loan-metric-val">${activeLoan.tenureMonths} months</div>
            </div>
            <div class="loan-metric">
              <div class="loan-metric-label">DISBURSED</div>
              <div class="loan-metric-val">${activeLoan.disbursementDate}</div>
            </div>
          </div>

          <div class="loan-progress-wrap">
            <div class="loan-progress-fill" style="width:${paidPct}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-top:4px;">
            <span style="color:var(--primary-dark);">REPAID: ${paidPct}%</span>
            <span style="color:#EA580C;">${store.formatCurrency(activeLoan.outstandingAmount || 0)} remaining</span>
          </div>

          <div style="margin-top:14px;display:flex;gap:10px;align-items:center;">
            <button class="btn-primary-sm" onclick="window.app.openClientPaymentModal('${customerId}', '${activeLoan.id}')" style="padding:7px 18px;font-weight:700;">
              + Add Payment
            </button>
            <span style="font-size:0.78rem;color:var(--text-muted);">Pay toward this active loan to reduce outstanding balance.</span>
          </div>
        </div>`;
    } else {
      activeContainer.innerHTML = `
        <div class="empty-state-box" style="background:#F0FDF4;border:1.5px dashed #86EFAC;">
          <div class="empty-state-icon" style="background:#DCFCE7;color:#15803D;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <p style="font-weight:800;color:#166534;margin-bottom:4px;font-size:0.95rem;">No Active Loan</p>
          <p style="font-size:0.82rem;color:#15803D;">This customer has zero outstanding balance and is eligible for a new loan up to ${store.formatCurrency(store.getCustomerLoanLimit(customerId))}.</p>
        </div>`;
    }

    // 2. Render LOAN HISTORY section (Requirement 15)
    if (historyLoans.length === 0) {
      historyContainer.innerHTML = `
        <div class="empty-state-box">
          <p style="font-size:0.82rem;color:var(--text-muted);">No completed past loans yet.</p>
        </div>`;
    } else {
      historyContainer.innerHTML = historyLoans.map(loan => {
        return `
          <div class="loan-card" style="border-left: 4px solid #10B981; opacity: 0.95;">
            <div class="loan-card-header">
              <div>
                <div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em;">LOAN ID</div>
                <div style="font-weight:800;font-family:var(--font-mono);color:var(--navy-900);font-size:0.9rem;">${loan.id}</div>
                ${loan.notes ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">${loan.notes}</div>` : ''}
              </div>
              <span class="status-pill status-completed">PAID</span>
            </div>

            <div class="loan-metrics-grid">
              <div class="loan-metric">
                <div class="loan-metric-label">PRINCIPAL</div>
                <div class="loan-metric-val">${store.formatCurrency(loan.amount)}</div>
              </div>
              <div class="loan-metric">
                <div class="loan-metric-label">PAID</div>
                <div class="loan-metric-val" style="color:var(--primary-dark);">${store.formatCurrency(loan.paidAmount || loan.amount)}</div>
              </div>
              <div class="loan-metric">
                <div class="loan-metric-label">OUTSTANDING</div>
                <div class="loan-metric-val" style="color:var(--primary-dark);">₹ 0</div>
              </div>
              <div class="loan-metric">
                <div class="loan-metric-label">INTEREST</div>
                <div class="loan-metric-val">${loan.interestRate}% p.a.</div>
              </div>
              <div class="loan-metric">
                <div class="loan-metric-label">TENURE</div>
                <div class="loan-metric-val">${loan.tenureMonths} months</div>
              </div>
              <div class="loan-metric">
                <div class="loan-metric-label">DISBURSED</div>
                <div class="loan-metric-val">${loan.disbursementDate}</div>
              </div>
            </div>

            <div class="loan-progress-wrap">
              <div class="loan-progress-fill" style="width:100%; background:#10B981;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.72rem;font-weight:700;color:var(--primary-dark);margin-top:4px;">
              <span>REPAID: 100%</span>
              <span>✓ Loan Fully Settled</span>
            </div>
          </div>`;
      }).join('');
    }
  }

  renderClientPaymentHistory(customerId) {
    const store     = window.financeStore;
    const container = document.getElementById('cd-payment-history-container');
    if (!container) return;

    const payments = store.getCustomerPayments(customerId)
      .slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (payments.length === 0) {
      container.innerHTML = `<div class="empty-state-box"><p style="font-size:0.85rem;color:var(--text-muted);">No payment records found for this customer.</p></div>`;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Payment ID</th>
              <th>Loan ID</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td style="font-weight:700;">${p.date}</td>
                <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted);">${p.id}</td>
                <td style="font-family:var(--font-mono);font-size:0.78rem;">${p.loanId}</td>
                <td style="font-weight:800;font-family:var(--font-mono);color:var(--primary-dark);">+ ${store.formatCurrency(p.amount)}</td>
                <td>${p.method}</td>
                <td><span class="status-pill status-active">${p.status || 'COMPLETED'}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ============================================================
     TRIGGER CREATE LOAN / RESTRICTION (Requirement 2 & 18)
     ============================================================ */
  handleCreateLoanClick(customerId) {
    customerId = customerId || this.currentClientId;
    const store = window.financeStore;
    const customer = store.data.customers.find(c => c.id === customerId);
    if (!customer) return;

    const activeLoan = store.getActiveLoan(customerId);
    if (activeLoan && Number(activeLoan.outstandingAmount || 0) > 0) {
      // Show Active Loan Exists Blocker (Requirement 2 & 18)
      const outEl = document.getElementById('alb-outstanding-val');
      if (outEl) outEl.textContent = store.formatCurrency(activeLoan.outstandingAmount);
      this.openModal('active-loan-blocker-modal');
      return;
    }

    // Customer is eligible for new loan
    this.openClientLoanModal(customerId);
  }

  viewCurrentActiveLoan() {
    this.closeModal('active-loan-blocker-modal');
    const container = document.getElementById('cd-active-loan-container');
    if (container) {
      container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      container.style.transition = 'outline 0.3s ease';
      container.style.outline = '3px solid #EA580C';
      setTimeout(() => { container.style.outline = 'none'; }, 2000);
    }
  }

  openActiveClientPaymentModal() {
    const customerId = this.currentClientId;
    const store = window.financeStore;
    const activeLoan = store.getActiveLoan(customerId);
    if (!activeLoan) {
      this.showToast('This customer has no active loan to collect payment for.', 'info');
      return;
    }
    this.openClientPaymentModal(customerId, activeLoan.id);
  }

  /* ============================================================
     CLIENT LOAN MODAL (Requirement 5 & 6)
     ============================================================ */
  openClientLoanModal(customerId) {
    this.currentClientId = customerId;
    const store = window.financeStore;
    const customer = store.data.customers.find(c => c.id === customerId);
    if (!customer) return;

    // Double check: active loan restriction
    const activeLoan = store.getActiveLoan(customerId);
    if (activeLoan && Number(activeLoan.outstandingAmount || 0) > 0) {
      this.handleCreateLoanClick(customerId);
      return;
    }

    const loanLimit = store.getCustomerLoanLimit(customerId);
    const customerLoans = store.getCustomerLoans(customerId);
    const hasPreviousLoans = customerLoans.length > 0;
    const previousLoanStatus = hasPreviousLoans ? 'PAID' : 'None';

    // Populate Readonly Info Grid (Requirement 5)
    const custEl = document.getElementById('cl-customer-display');
    if (custEl) custEl.textContent = `${customer.fullName || customer.name} (${customer.id})`;

    const limitEl = document.getElementById('cl-limit-display');
    if (limitEl) limitEl.textContent = store.formatCurrency(loanLimit);

    const prevEl = document.getElementById('cl-previous-loan-display');
    if (prevEl) prevEl.textContent = previousLoanStatus;

    const availEl = document.getElementById('cl-available-limit-display');
    if (availEl) availEl.textContent = store.formatCurrency(loanLimit);

    const form = document.getElementById('client-loan-form');
    if (form) form.reset();

    const amountInput = document.getElementById('cl-amount');
    const feedbackEl  = document.getElementById('cl-amount-feedback');
    if (amountInput) {
      amountInput.value = '';
      amountInput.max = loanLimit;
      amountInput.placeholder = `Max: ${store.formatCurrency(loanLimit)}`;
    }
    if (feedbackEl) {
      feedbackEl.style.display = 'none';
      feedbackEl.textContent = '';
    }

    // Set Dates
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('cl-loan-date');
    if (dateInput) dateInput.value = today;

    // Set Due Date (1 year ahead by default)
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const dueInput = document.getElementById('cl-due-date');
    if (dueInput) dueInput.value = nextYear.toISOString().split('T')[0];

    // Live validation on loan amount (Requirement 6)
    if (amountInput) {
      amountInput.oninput = () => {
        const val = Number(amountInput.value);
        if (!feedbackEl) return;

        if (isNaN(val) || val <= 0) {
          feedbackEl.style.display = 'block';
          feedbackEl.style.color = '#DC2626';
          feedbackEl.textContent = 'Amount must be greater than ₹0.';
        } else if (val > loanLimit) {
          feedbackEl.style.display = 'block';
          feedbackEl.style.color = '#DC2626';
          feedbackEl.textContent = `Loan amount exceeds the customer's loan limit of ${store.formatCurrency(loanLimit)}.`;
        } else {
          const remaining = loanLimit - val;
          feedbackEl.style.display = 'block';
          feedbackEl.style.color = '#059669';
          feedbackEl.textContent = `Within limit. Remaining limit after this loan: ${store.formatCurrency(remaining)}`;
        }
      };
    }

    this.openModal('client-add-loan-modal');
  }

  /* ============================================================
     CLIENT PAYMENT MODAL (Requirement 13)
     ============================================================ */
  openClientPaymentModal(customerId, loanId) {
    this.currentClientId = customerId;
    this.currentLoanId   = loanId;

    const store    = window.financeStore;
    const customer = store.data.customers.find(c => c.id === customerId);
    let loan = store.data.loans.find(l => l.id === loanId);
    if (!loan && customerId) {
      loan = store.getActiveLoan(customerId);
      if (loan) this.currentLoanId = loan.id;
    }

    if (!customer || !loan) {
      this.showToast('No active loan found for this customer.', 'error');
      return;
    }

    const outstanding = Math.max(0, Number(loan.outstandingAmount || 0));
    if (outstanding <= 0) {
      this.showToast('This loan is already fully paid.', 'info');
      return;
    }

    const custEl = document.getElementById('cp-customer-display');
    const loanEl = document.getElementById('cp-loan-display');
    const amtEl  = document.getElementById('cp-amount');
    const dateEl = document.getElementById('cp-date');
    const refEl  = document.getElementById('cp-reference');
    const notesEl = document.getElementById('cp-notes');

    if (custEl) custEl.textContent = `${customer.fullName || customer.name} (${customer.id})`;
    if (loanEl) loanEl.innerHTML = `<span style="font-weight:800;">${loan.id}</span> &nbsp;|&nbsp; Outstanding: <span style="color:#EA580C;font-weight:800;">${store.formatCurrency(outstanding)}</span>`;
    if (amtEl) {
      amtEl.value = '';
      amtEl.max = outstanding;
      amtEl.placeholder = `Enter amount (Max: ${store.formatCurrency(outstanding)})`;
    }
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    if (refEl) refEl.value = '';
    if (notesEl) notesEl.value = '';

    this.openModal('client-record-payment-modal');
    if (amtEl) setTimeout(() => amtEl.focus(), 50);
  }

  /* ============================================================
     BIND CLIENT DETAILS FORM HANDLERS
     ============================================================ */
  bindClientDetailsActions() {
    // --- Create Loan for client (Requirement 1, 5, 6) ---
    const loanForm = document.getElementById('client-loan-form');
    if (loanForm) {
      loanForm.addEventListener('submit', e => {
        e.preventDefault();
        const store = window.financeStore;
        const customerId = this.currentClientId;
        const customer = store.data.customers.find(c => c.id === customerId);
        if (!customer) {
          this.showToast('Customer record not found.', 'error');
          return;
        }

        const amountVal = document.getElementById('cl-amount').value;
        const amount    = Number(amountVal);
        const limit     = store.getCustomerLoanLimit(customerId);

        // Validation rule 6:
        if (isNaN(amount) || amount <= 0) {
          this.showToast('Loan amount must be greater than zero.', 'error');
          return;
        }

        if (amount > limit) {
          this.showToast(`Loan amount exceeds the customer's loan limit of ${store.formatCurrency(limit)}.`, 'error');
          return;
        }

        // Active loan check:
        const activeLoan = store.getActiveLoan(customerId);
        if (activeLoan && Number(activeLoan.outstandingAmount || 0) > 0) {
          this.closeModal('client-add-loan-modal');
          this.handleCreateLoanClick(customerId);
          return;
        }

        const interest = 12;
        const tenure   = document.getElementById('cl-tenure')?.value || 12;
        const date     = document.getElementById('cl-loan-date')?.value || new Date().toISOString().split('T')[0];
        const dueDate  = document.getElementById('cl-due-date')?.value || '';
        const method   = document.getElementById('cl-method')?.value || 'Bank Transfer';
        const notes    = (document.getElementById('cl-notes')?.value || '').trim();

        try {
          const loan = store.addLoan({
            customerId,
            amount,
            interestRate: interest,
            tenureMonths: tenure,
            dueDate,
            date,
            method,
            notes
          });

          this.closeModal('client-add-loan-modal');
          this.showToast(`Loan ${loan.id} of ${store.formatCurrency(amount)} created successfully!`, 'success');
          this.renderClientDetails(customerId);
        } catch (err) {
          this.showToast(err.message || 'Error creating loan.', 'error');
        }
      });
    }

    // --- Record Payment against a loan (Requirement 9 & 13) ---
    const payForm = document.getElementById('client-payment-form');
    if (payForm) {
      payForm.addEventListener('submit', e => {
        e.preventDefault();
        const store = window.financeStore;
        const customerId = this.currentClientId;
        const loanId    = this.currentLoanId;
        const amountVal = document.getElementById('cp-amount').value;
        const amount    = Number(amountVal);
        const date      = document.getElementById('cp-date').value || new Date().toISOString().split('T')[0];
        const method    = document.getElementById('cp-method').value || 'Cash';
        const reference = (document.getElementById('cp-reference')?.value || '').trim();
        const notes     = (document.getElementById('cp-notes')?.value || '').trim();

        if (isNaN(amount) || amount <= 0) {
          this.showToast('Please enter a valid payment amount.', 'error');
          return;
        }

        // Check against current outstanding:
        const loan = store.data.loans.find(l => l.id === loanId);
        if (loan) {
          const outstanding = Math.max(0, Number(loan.outstandingAmount || 0));
          if (amount > outstanding) {
            this.showToast(`Payment cannot exceed outstanding amount of ${store.formatCurrency(outstanding)}.`, 'error');
            return;
          }
        }

        try {
          const { payment } = store.recordClientPayment({
            customerId,
            loanId,
            amount,
            date,
            method,
            reference,
            notes
          });

          this.closeModal('client-record-payment-modal');
          if (this.currentView === 'client-details') {
            this.renderClientDetails(customerId);
          }
          this.renderCollectionsSearch();
        } catch (err) {
          this.showToast(err.message || 'Error recording payment.', 'error');
        }
      });
    }
  }
}

// Instantiate on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FinanceApp();
});
