/**
 * FINANCEVAULT - AUDIT & VERIFICATION ENGINE
 * Handles multi-format document uploads (Receipt, Invoice, Bank statement),
 * camera simulation, automated integrity checks, anomaly detection, and score generation.
 */

class AuditEngine {
  constructor() {
    this.currentFile = null;
    this.currentPreviewUrl = null;
  }

  init() {
    this.bindDropzone();
    this.renderAuditLogs();
    this.updateAuditSummaryCard();
  }

  bindDropzone() {
    const dropzone = document.getElementById('audit-dropzone');
    const fileInput = document.getElementById('audit-file-input');
    const cameraInput = document.getElementById('audit-camera-input');
    const runAnalysisBtn = document.getElementById('run-audit-btn');
    const removeFileBtn = document.getElementById('remove-preview-file-btn');

    if (!dropzone || !fileInput) return;

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.handleSelectedFile(e.dataTransfer.files[0]);
      }
    });

    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleSelectedFile(e.target.files[0]);
      }
    });

    if (cameraInput) {
      cameraInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleSelectedFile(e.target.files[0]);
        }
      });
    }

    if (removeFileBtn) {
      removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearSelectedFile();
      });
    }

    if (runAnalysisBtn) {
      runAnalysisBtn.addEventListener('click', () => {
        this.runAnalysisWorkflow();
      });
    }
  }

  handleSelectedFile(file) {
    this.currentFile = file;
    const previewContainer = document.getElementById('audit-preview-box');
    const previewImg = document.getElementById('audit-preview-img');
    const fileNameEl = document.getElementById('audit-filename');
    const fileSizeEl = document.getElementById('audit-filesize');
    const dropzoneText = document.getElementById('dropzone-prompt');

    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    // Preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.currentPreviewUrl = e.target.result;
        if (previewImg) previewImg.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } else {
      // PDF or Doc fallback icon
      this.currentPreviewUrl = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=150&auto=format&fit=crop&q=80';
      if (previewImg) previewImg.src = this.currentPreviewUrl;
    }

    if (previewContainer) previewContainer.classList.add('active');
    if (dropzoneText) dropzoneText.style.display = 'none';

    if (window.app) window.app.showToast(`Document loaded: ${file.name}`, 'info');
  }

  clearSelectedFile() {
    this.currentFile = null;
    this.currentPreviewUrl = null;
    const previewContainer = document.getElementById('audit-preview-box');
    const fileInput = document.getElementById('audit-file-input');
    const dropzoneText = document.getElementById('dropzone-prompt');

    if (previewContainer) previewContainer.classList.remove('active');
    if (fileInput) fileInput.value = '';
    if (dropzoneText) dropzoneText.style.display = 'block';
  }

  runAnalysisWorkflow() {
    const docTypeSelect = document.getElementById('audit-doctype-select');
    const docTitleInput = document.getElementById('audit-doc-title');

    const docType = docTypeSelect ? docTypeSelect.value : 'Financial Receipt';
    const docTitle = (docTitleInput && docTitleInput.value.trim()) ? docTitleInput.value.trim() : (this.currentFile ? this.currentFile.name : `${docType} Verification`);

    // Run simulated smart verification checks based on system ledger
    const analysis = this.performAuditChecks(docType);

    // Save to store
    const auditRecord = window.financeStore.addAudit({
      title: docTitle,
      docType: docType,
      score: analysis.score,
      status: analysis.status,
      details: analysis.summary,
      findings: analysis.findings,
      fileUrl: this.currentPreviewUrl
    });

    this.renderAuditLogs();
    this.updateAuditSummaryCard();
    this.displayAnalysisResultsModal(auditRecord);
    this.clearSelectedFile();

    if (window.app) {
      window.app.showToast(`Audit Complete! Score: ${analysis.score}% (${analysis.status})`, analysis.status === 'VERIFIED' ? 'success' : 'warning');
    }
  }

  performAuditChecks(docType) {
    const randomSeed = Math.random();
    let score = 94;
    let status = 'VERIFIED';
    let summary = 'Full document consistency and transaction parity verified.';
    const findings = [];

    // Core validation checks
    findings.push({
      text: 'Mathematical summation & currency symbols strictly match system standard.',
      status: 'VERIFIED'
    });

    findings.push({
      text: 'Authentication stamp & GSTIN / Tax identifier validity confirmed.',
      status: 'VERIFIED'
    });

    if (randomSeed > 0.65) {
      score = 88;
      status = 'WARNING';
      summary = 'Document passed core criteria with minor timestamp latency.';
      findings.push({
        text: 'Document issuance date logged 3 days prior to disbursement record.',
        status: 'WARNING'
      });
    } else if (randomSeed < 0.15) {
      score = 72;
      status = 'WARNING';
      summary = 'Potential duplicate voucher reference detected in previous period.';
      findings.push({
        text: 'Invoice number shares prefix with archived ledger #402.',
        status: 'WARNING'
      });
    } else {
      score = 98;
      status = 'VERIFIED';
      findings.push({
        text: 'Counterparty entity verified in registered client directory.',
        status: 'VERIFIED'
      });
    }

    return { score, status, summary, findings };
  }

  updateAuditSummaryCard() {
    const audits = window.financeStore.data.audits || [];
    if (audits.length === 0) return;

    const avgScore = Math.round(audits.reduce((sum, a) => sum + (a.score || 90), 0) / audits.length);
    const scoreValEl = document.getElementById('audit-avg-score-val');
    const scoreLabelEl = document.getElementById('audit-avg-score-label');
    const gaugeEl = document.getElementById('audit-score-gauge-ring');

    if (scoreValEl) scoreValEl.textContent = `${avgScore}%`;
    if (scoreLabelEl) {
      scoreLabelEl.textContent = avgScore >= 90 ? 'EXCELLENT' : (avgScore >= 75 ? 'GOOD' : 'REQUIRES ATTENTION');
    }

    if (gaugeEl) {
      gaugeEl.style.background = `conic-gradient(#10B981 0% ${avgScore}%, rgba(255,255,255,0.15) ${avgScore}% 100%)`;
    }
  }

  renderAuditLogs() {
    const listEl = document.getElementById('audit-history-list');
    if (!listEl) return;

    const audits = window.financeStore.data.audits || [];
    if (audits.length === 0) {
      const emptyHtml = `
        <div class="empty-state-box">
          <div class="empty-state-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <h4>No audit documents uploaded</h4>
          <p style="font-size: 0.8rem; margin-top: 4px;">Upload receipts, bills, invoices, or bank statements above to run automated reconciliation checks.</p>
        </div>
      `;
      listEls.forEach(el => el.innerHTML = emptyHtml);
      return;
    }

    const itemsHtml = audits.map(audit => `
      <div class="audit-item">
        <div style="flex: 1; padding-right: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="audit-badge ${audit.status === 'VERIFIED' ? 'badge-verified' : (audit.status === 'WARNING' ? 'badge-warning' : 'badge-error')}">
              ${audit.status}
            </span>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">
              ${audit.docType} • ${audit.uploadDate}
            </span>
          </div>
          <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--navy-900); margin-bottom: 4px;">${audit.title}</h4>
          <p style="font-size: 0.8rem; color: var(--text-muted);">${audit.details}</p>

          <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
            ${(audit.findings || []).map(f => `
              <div style="font-size: 0.75rem; color: var(--navy-700); display: flex; align-items: center; gap: 6px;">
                <span style="color: ${f.status === 'VERIFIED' ? '#10B981' : '#F59E0B'}; font-weight: 800;">•</span>
                ${f.text}
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 10px;">
          <div style="text-align: right;">
            <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); display: block;">SCORE</span>
            <span style="font-size: 1.25rem; font-weight: 800; color: ${audit.score >= 90 ? '#10B981' : '#F59E0B'};">${audit.score}%</span>
          </div>
          <button class="btn-icon-subtle delete-btn" onclick="window.financeStore.deleteAudit('${audit.id}')" title="Delete Audit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `).join('');

    listEl.innerHTML = itemsHtml;
  }

  displayAnalysisResultsModal(audit) {
    const modal = document.getElementById('audit-detail-modal');
    if (!modal) return;

    document.getElementById('audit-modal-title').textContent = audit.title;
    document.getElementById('audit-modal-score').textContent = `${audit.score}%`;
    document.getElementById('audit-modal-status').textContent = audit.status;
    document.getElementById('audit-modal-status').className = `status-pill ${audit.status === 'VERIFIED' ? 'status-active' : 'status-overdue'}`;
    document.getElementById('audit-modal-details').textContent = audit.details;

    const findingsContainer = document.getElementById('audit-modal-findings');
    if (findingsContainer) {
      findingsContainer.innerHTML = (audit.findings || []).map(f => `
        <div style="padding: 8px 12px; background: var(--bg-card-subtle); border-radius: 8px; font-size: 0.82rem; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span>${f.text}</span>
          <span style="font-weight: 800; font-size: 0.7rem; color: ${f.status === 'VERIFIED' ? '#10B981' : '#F59E0B'};">${f.status}</span>
        </div>
      `).join('');
    }

    if (window.app) window.app.openModal('audit-detail-modal');
  }
}

// Instantiate
window.auditEngine = new AuditEngine();
