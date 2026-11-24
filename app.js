// App Controller — AI Phân Tích BCTC Cá Nhân v1.0
(function () {
  const STORAGE_KEY = "ai_bctc_personal_v1_data";
  const AI_CFG_KEY = "ai_bctc_personal_v1_aicfg";

  const state = {
    sampleKey: "sample_5y",
    data: null,
    derived: null,
    alerts: [],
    statementType: "is", // is | bs | cf
    analysisMode: "abs", // abs | vertical | horizontal
    charts: {
      trend: null,
      waterfall: null,
      variance: null,
      forecast: null,
      peer: null
    }
  };

  const F = window.FinanceEngine;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function showStatus(msg, type = "good") {
    const el = document.getElementById("globalStatus");
    if (!el) return;
    el.textContent = msg;
    el.className = "status-banner" + (type === "error" ? " error" : type === "warn" ? " warn" : "");
    el.classList.remove("hidden");
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => el.classList.add("hidden"), 4500);
  }

  function saveStateToLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sampleKey: state.sampleKey,
        data: state.data
      }));
    } catch (e) {
      console.warn("Không thể lưu localStorage:", e);
    }
  }

  function loadInitialState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && parsed.data.periods && parsed.data.is) {
          state.sampleKey = parsed.sampleKey || "custom";
          state.data = parsed.data;
          return;
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc localStorage, dùng dữ liệu mẫu:", e);
    }
    state.sampleKey = "sample_5y";
    state.data = deepClone(window.BCTC_SAMPLES.sample_5y);
  }

  function loadAiConfig() {
    try {
      const raw = localStorage.getItem(AI_CFG_KEY);
      if (!raw) return;
      const cfg = JSON.parse(raw);
      if (cfg.provider) document.getElementById("aiProviderSelect").value = cfg.provider;
      if (cfg.apiKey) document.getElementById("aiApiKeyInput").value = cfg.apiKey;
    } catch (e) {}
  }

  function saveAiConfig() {
    try {
      localStorage.setItem(AI_CFG_KEY, JSON.stringify({
        provider: document.getElementById("aiProviderSelect").value,
        apiKey: document.getElementById("aiApiKeyInput").value
      }));
    } catch (e) {}
  }

  function recomputeAll() {
    state.derived = F.computeDerived(state.data);
    state.alerts = F.detectRisksAndVariance(state.data, state.derived);
    saveStateToLocal();
    syncHeaderControls();
    renderDashboard();
    renderStatementTable();
    renderBudgetInputs();
    renderRatiosAndRisks();
    updateForecast();
    updateValuationAndPeer();
    renderPromptLibrary();
  }

  function syncHeaderControls() {
    const sel = document.getElementById("companySelect");
    if (sel) sel.value = state.sampleKey;
    const nameInp = document.getElementById("companyNameInput");
    if (nameInp) nameInp.value = state.data.companyName || "";

    const periodSel = document.getElementById("dashboardPeriodSelect");
    if (periodSel) {
      const prevVal = periodSel.value;
      periodSel.innerHTML = state.data.periods
        .map((p, idx) => `<option value="${idx}">${p}</option>`)
        .join("");
      const targetIdx = (prevVal !== "" && Number(prevVal) < state.data.periods.length)
        ? prevVal
        : String(state.data.periods.length - 1);
      periodSel.value = targetIdx;
    }
  }

  function destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      state.charts[key] = null;
    }
  }

  // ================= TAB 1: DASHBOARD =================
  function renderDashboard() {
    const d = state.data;
    const drv = state.derived;
    const periodSel = document.getElementById("dashboardPeriodSelect");
    const idx = periodSel && periodSel.value !== "" ? Number(periodSel.value) : d.periods.length - 1;
    const prev = idx - 1;
    const r = drv.ratios[idx];

    document.getElementById("dashboardTitle").textContent = `Tổng quan tài chính — ${d.companyName}`;
    document.getElementById("dashboardSubtitle").textContent =
      `Kỳ đang xem: ${d.periods[idx]} · Đơn vị: ${d.unit} ${prev >= 0 ? `(So sánh với ${d.periods[prev]})` : ""}`;

    const yoyBadge = (arr) => {
      const pct = F.yoyPct(arr, idx);
      if (pct === null) return { text: "Kỳ cơ sở", cls: "neutral" };
      const sign = pct >= 0 ? "▲ +" : "▼ ";
      return { text: `${sign}${F.fmtPct(Math.abs(pct))} YoY`, cls: pct >= 0 ? "up" : "down" };
    };

    const kpis = [
      { label: "Doanh thu thuần", val: `${F.fmtNum(d.is.revenue[idx])} tỷ`, sub: yoyBadge(d.is.revenue), tone: "" },
      { label: "EBITDA & Biên", val: `${F.fmtNum(drv.ebitda[idx])} tỷ`, sub: { text: `Biên EBITDA: ${F.fmtPct(r.ebitdaMargin)}`, cls: r.ebitdaMargin >= 0.15 ? "up" : "neutral" }, tone: r.ebitdaMargin >= 0.15 ? "good" : "warn" },
      { label: "Lợi nhuận sau thuế", val: `${F.fmtNum(drv.netProfit[idx])} tỷ`, sub: yoyBadge(drv.netProfit), tone: drv.netProfit[idx] >= 0 ? "good" : "danger" },
      { label: "Dòng tiền kinh doanh (OCF)", val: `${F.fmtNum(d.cf.ocf[idx])} tỷ`, sub: { text: d.cf.ocf[idx] >= drv.netProfit[idx] * 0.7 ? "Tiền về tốt" : "Cần kiểm tra dòng tiền", cls: d.cf.ocf[idx] >= 0 ? "up" : "down" }, tone: d.cf.ocf[idx] < 0 ? "danger" : "good" },
      { label: "Tổng Tài sản & D/E", val: `${F.fmtNum(drv.totalAssets[idx])} tỷ`, sub: { text: `D/E: ${F.fmtNum(r.debtToEquity, 2)}x | CR: ${F.fmtNum(r.currentRatio, 2)}x`, cls: r.debtToEquity > 1.5 ? "down" : "neutral" }, tone: r.debtToEquity > 1.5 ? "warn" : "" },
      { label: "Hiệu quả sinh lời (ROE)", val: F.fmtPct(r.roe), sub: { text: `ROA: ${F.fmtPct(r.roa)}`, cls: r.roe >= 0.15 ? "up" : "neutral" }, tone: r.roe >= 0.15 ? "good" : "" }
    ];

    document.getElementById("kpiGrid").innerHTML = kpis.map(k => `
      <div class="kpi-card ${k.tone}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.val}</div>
        <div class="kpi-sub ${k.sub.cls}">${k.sub.text}</div>
      </div>
    `).join("");

    // Highlights
    const hlEl = document.getElementById("dashboardHighlights");
    hlEl.innerHTML = state.alerts.slice(0, 3).map(a => `
      <div class="alert-item ${a.level}">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
      </div>
    `).join("");

    if (typeof Chart === "undefined") return;

    // Chart 1: Trend 3-5 years
    destroyChart("trend");
    const ctxTrend = document.getElementById("trendChart").getContext("2d");
    state.charts.trend = new Chart(ctxTrend, {
      type: "bar",
      data: {
        labels: d.periods,
        datasets: [
          { label: "Doanh thu (tỷ)", data: d.is.revenue, backgroundColor: "rgba(30, 58, 138, 0.78)", yAxisID: "y" },
          { label: "EBITDA (tỷ)", data: drv.ebitda, backgroundColor: "rgba(217, 119, 6, 0.8)", yAxisID: "y" },
          { label: "LNST (tỷ)", data: drv.netProfit, backgroundColor: "rgba(21, 128, 61, 0.8)", yAxisID: "y" },
          { label: "Biên gộp (%)", data: drv.ratios.map(x => +(x.grossMargin * 100).toFixed(1)), type: "line", borderColor: "#dc2626", backgroundColor: "#dc2626", tension: 0.3, yAxisID: "y1" },
          { label: "Biên ròng (%)", data: drv.ratios.map(x => +(x.netMargin * 100).toFixed(1)), type: "line", borderColor: "#0284c7", backgroundColor: "#0284c7", tension: 0.3, yAxisID: "y1" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { position: "left", title: { display: true, text: "Tỷ đồng" } },
          y1: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Biên lợi nhuận (%)" } }
        }
      }
    });

    // Chart 2: Waterfall / Profit Bridge
    destroyChart("waterfall");
    const rev = d.is.revenue[idx];
    const cogs = d.is.cogs[idx];
    const sga = d.is.sga[idx];
    const finNet = (d.is.finIncome[idx] || 0) - (d.is.interestExpense[idx] || 0) + (d.is.otherProfit[idx] || 0);
    const tax = d.is.taxExpense[idx];
    const np = drv.netProfit[idx];

    let cur = rev;
    const wfData = [
      [0, rev],
      [cur - cogs, cur],
      [cur - cogs - sga, cur - cogs],
      [Math.min(cur - cogs - sga, cur - cogs - sga + finNet), Math.max(cur - cogs - sga, cur - cogs - sga + finNet)],
      [np, np + tax],
      [0, np]
    ];
    const wfColors = ["#1e3a8a", "#ef4444", "#f97316", finNet >= 0 ? "#10b981" : "#ef4444", "#eab308", "#15803d"];

    const ctxWf = document.getElementById("waterfallChart").getContext("2d");
    state.charts.waterfall = new Chart(ctxWf, {
      type: "bar",
      data: {
        labels: ["Doanh thu", "Giá vốn", "BH & QLDN", "TC & Khác", "Thuế TNDN", "LNST"],
        datasets: [{
          label: `Cầu lợi nhuận ${d.periods[idx]} (tỷ)`,
          data: wfData,
          backgroundColor: wfColors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // Chart 3: Variance Analysis (Thực tế vs Kế hoạch)
    destroyChart("variance");
    const b = d.budgetLatest || {};
    const actualVals = [d.is.revenue[idx], drv.grossProfit[idx], drv.ebitda[idx], drv.ebt[idx], drv.netProfit[idx], d.cf.ocf[idx]];
    const budgetVals = [
      Number(b.revenue) || d.is.revenue[idx],
      Number(b.grossProfit) || drv.grossProfit[idx],
      Number(b.ebitda) || drv.ebitda[idx],
      Number(b.ebt) || drv.ebt[idx],
      Number(b.netProfit) || drv.netProfit[idx],
      Number(b.ocf) || d.cf.ocf[idx]
    ];

    const ctxVar = document.getElementById("varianceChart").getContext("2d");
    state.charts.variance = new Chart(ctxVar, {
      type: "bar",
      data: {
        labels: ["Doanh thu", "LN gộp", "EBITDA", "LNTT", "LNST", "OCF"],
        datasets: [
          { label: `Thực tế (${d.periods[idx]})`, data: actualVals, backgroundColor: "#1e3a8a" },
          { label: "Kế hoạch (Budget)", data: budgetVals, backgroundColor: "#94a3b8" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  // ================= TAB 2: STATEMENTS =================
  const STATEMENT_DEFS = {
    is: [
      { key: "revenue", label: "Doanh thu thuần", editable: true, highlight: true },
      { key: "cogs", label: "Giá vốn hàng bán", editable: true },
      { key: "_grossProfit", label: "Lợi nhuận gộp", derivedKey: "grossProfit", highlight: true },
      { key: "sga", label: "Chi phí Bán hàng & QLDN", editable: true },
      { key: "_ebit", label: "Lợi nhuận thuần HĐKD (EBIT)", derivedKey: "ebit", highlight: true },
      { key: "depreciation", label: "Khấu hao TSCĐ (tách tính EBITDA)", editable: true },
      { key: "_ebitda", label: "EBITDA", derivedKey: "ebitda", highlight: true },
      { key: "finIncome", label: "Thu nhập tài chính", editable: true },
      { key: "interestExpense", label: "Chi phí lãi vay", editable: true },
      { key: "otherProfit", label: "Lợi nhuận khác", editable: true },
      { key: "_ebt", label: "Lợi nhuận trước thuế (LNTT)", derivedKey: "ebt", highlight: true },
      { key: "taxExpense", label: "Chi phí thuế TNDN", editable: true },
      { key: "_netProfit", label: "Lợi nhuận sau thuế (LNST)", derivedKey: "netProfit", highlight: true }
    ],
    bs: [
      { section: "A. TÀI SẢN NGẮN HẠN" },
      { key: "cash", label: "Tiền & tương đương tiền", editable: true },
      { key: "receivables", label: "Các khoản phải thu ngắn hạn", editable: true },
      { key: "inventory", label: "Hàng tồn kho", editable: true },
      { key: "otherCurrent", label: "Tài sản ngắn hạn khác", editable: true },
      { key: "_ca", label: "Tổng Tài sản ngắn hạn", derivedKey: "currentAssets", highlight: true },
      { section: "B. TÀI SẢN DÀI HẠN" },
      { key: "fixedAssets", label: "Tài sản cố định", editable: true },
      { key: "longTermInvest", label: "Đầu tư tài chính dài hạn / Công ty con", editable: true },
      { key: "otherNonCurrent", label: "Tài sản dài hạn khác", editable: true },
      { key: "_ta", label: "TỔNG TÀI SẢN", derivedKey: "totalAssets", highlight: true },
      { section: "C. NGUỒN VỐN" },
      { key: "shortTermDebt", label: "Vay & nợ thuê TC ngắn hạn", editable: true },
      { key: "payables", label: "Phải trả người bán & nợ ngắn hạn khác", editable: true },
      { key: "longTermDebt", label: "Vay & nợ dài hạn", editable: true },
      { key: "_tl", label: "Tổng Nợ phải trả", derivedKey: "totalLiabilities", highlight: true },
      { key: "equity", label: "Vốn chủ sở hữu", editable: true, highlight: true }
    ],
    cf: [
      { key: "ocf", label: "Lưu chuyển tiền từ HĐ Kinh doanh (OCF)", editable: true, highlight: true },
      { key: "icf", label: "Lưu chuyển tiền từ HĐ Đầu tư (ICF)", editable: true },
      { key: "fcfFin", label: "Lưu chuyển tiền từ HĐ Tài chính", editable: true },
      { key: "capex", label: "Chi mua sắm TSCĐ (CAPEX)", editable: true },
      { key: "_fcf", label: "Dòng tiền tự do (FCF = OCF − CAPEX)", derivedKey: "fcf", highlight: true }
    ]
  };

  function renderStatementTable() {
    const tbl = document.getElementById("statementTable");
    const type = state.statementType;
    const mode = state.analysisMode;
    const d = state.data;
    const drv = state.derived;
    const defs = STATEMENT_DEFS[type];

    let html = `<thead><tr><th>Chỉ tiêu (${mode === "abs" ? d.unit : mode === "vertical" ? "% cơ cấu" : "% YoY"})</th>`;
    d.periods.forEach((p, i) => {
      html += `<th>${p}</th>`;
    });
    html += `</tr></thead><tbody>`;

    defs.forEach(row => {
      if (row.section) {
        html += `<tr class="row-section"><td colspan="${d.periods.length + 1}">${row.section}</td></tr>`;
        return;
      }
      const arr = row.derivedKey ? drv[row.derivedKey] : d[type][row.key];
      const baseArr = type === "bs" ? drv.totalAssets : d.is.revenue;

      html += `<tr class="${row.highlight ? "row-highlight" : ""}"><td>${row.label}</td>`;
      d.periods.forEach((_, i) => {
        const val = arr[i];
        if (mode === "abs") {
          if (row.editable) {
            html += `<td><input class="cell-input" type="number" step="0.1" value="${val}" onchange="window.onCellEdit('${type}','${row.key}',${i},this.value)" /></td>`;
          } else {
            html += `<td>${F.fmtNum(val, 1)}</td>`;
          }
        } else if (mode === "vertical") {
          const pct = F.safeDiv(val, baseArr[i]);
          html += `<td>${F.fmtPct(pct, 1)}</td>`;
        } else {
          const yoy = F.yoyPct(arr, i);
          if (yoy === null) {
            html += `<td class="muted">—</td>`;
          } else {
            const cls = yoy >= 0 ? "num-pos" : "num-neg";
            html += `<td class="${cls}">${yoy >= 0 ? "+" : ""}${F.fmtPct(yoy, 1)}</td>`;
          }
        }
      });
      html += `</tr>`;
    });

    html += `</tbody>`;
    tbl.innerHTML = html;
  }

  function renderBudgetInputs() {
    const b = state.data.budgetLatest || {};
    const fields = [
      { key: "revenue", label: "Kế hoạch Doanh thu" },
      { key: "grossProfit", label: "Kế hoạch LN gộp" },
      { key: "ebitda", label: "Kế hoạch EBITDA" },
      { key: "ebt", label: "Kế hoạch LNTT" },
      { key: "netProfit", label: "Kế hoạch LNST" },
      { key: "ocf", label: "Kế hoạch Dòng tiền KD (OCF)" }
    ];
    document.getElementById("budgetInputsGrid").innerHTML = fields.map(f => `
      <div class="input-box">
        <label>${f.label} (tỷ)</label>
        <input type="number" step="1" value="${b[f.key] ?? 0}" onchange="window.onBudgetEdit('${f.key}', this.value)" />
      </div>
    `).join("");
  }

  // ================= TAB 3: RATIOS & RISKS =================
  function renderRatiosAndRisks() {
    const riskEl = document.getElementById("riskAlertsContainer");
    riskEl.innerHTML = state.alerts.map(a => `
      <div class="alert-item ${a.level}">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
      </div>
    `).join("");

    const d = state.data;
    const ratios = state.derived.ratios;
    const last = ratios[ratios.length - 1];

    const ratioDefs = [
      { section: "1. NHÓM CHỈ SỐ THANH TOÁN" },
      { key: "currentRatio", label: "Current Ratio (Thanh toán hiện hành)", fmt: v => F.fmtNum(v, 2) + "x", eval: v => v >= 1.3 ? ["Tốt", "good"] : v >= 1.0 ? ["Theo dõi", "warn"] : ["Rủi ro", "danger"] },
      { key: "quickRatio", label: "Quick Ratio (Thanh toán nhanh)", fmt: v => F.fmtNum(v, 2) + "x", eval: v => v >= 1.0 ? ["Tốt", "good"] : v >= 0.7 ? ["Theo dõi", "warn"] : ["Rủi ro", "danger"] },
      { section: "2. NHÓM ĐÒN BẨY TÀI CHÍNH" },
      { key: "debtToEquity", label: "D/E (Tổng nợ / Vốn chủ sở hữu)", fmt: v => F.fmtNum(v, 2) + "x", eval: v => v <= 1.0 ? ["An toàn", "good"] : v <= 1.5 ? ["Trung bình", "warn"] : ["Đòn bẩy cao", "danger"] },
      { key: "debtToAssets", label: "Nợ phải trả / Tổng tài sản", fmt: v => F.fmtPct(v, 1), eval: v => v <= 0.5 ? ["An toàn", "good"] : v <= 0.65 ? ["Theo dõi", "warn"] : ["Cao", "danger"] },
      { key: "icr", label: "Khả năng trả lãi (EBIT / Lãi vay)", fmt: v => v > 50 ? ">50x" : F.fmtNum(v, 1) + "x", eval: v => v >= 4 ? ["Tốt", "good"] : v >= 2 ? ["Theo dõi", "warn"] : ["Rủi ro", "danger"] },
      { section: "3. NHÓM SINH LỜI" },
      { key: "grossMargin", label: "Biên lợi nhuận gộp (Gross Margin)", fmt: v => F.fmtPct(v, 1), eval: v => v >= 0.25 ? ["Tốt", "good"] : v >= 0.15 ? ["Trung bình", "warn"] : ["Mỏng", "danger"] },
      { key: "ebitdaMargin", label: "Biên EBITDA (EBITDA Margin)", fmt: v => F.fmtPct(v, 1), eval: v => v >= 0.15 ? ["Tốt", "good"] : v >= 0.08 ? ["Trung bình", "warn"] : ["Thấp", "danger"] },
      { key: "netMargin", label: "Biên lợi nhuận ròng (Net Margin)", fmt: v => F.fmtPct(v, 1), eval: v => v >= 0.10 ? ["Tốt", "good"] : v >= 0.05 ? ["Trung bình", "warn"] : ["Thấp", "danger"] },
      { key: "roa", label: "ROA (LNST / Tổng tài sản)", fmt: v => F.fmtPct(v, 1), eval: v => v >= 0.07 ? ["Tốt", "good"] : v >= 0.03 ? ["Trung bình", "warn"] : ["Thấp", "danger"] },
      { key: "roe", label: "ROE (LNST / Vốn chủ sở hữu)", fmt: v => F.fmtPct(v, 1), eval: v => v >= 0.15 ? ["Tốt", "good"] : v >= 0.08 ? ["Trung bình", "warn"] : ["Thấp", "danger"] },
      { section: "4. NHÓM HIỆU QUẢ HOẠT ĐỘNG" },
      { key: "assetTurnover", label: "Vòng quay tổng tài sản", fmt: v => F.fmtNum(v, 2) + "x", eval: v => v >= 0.8 ? ["Hiệu quả", "good"] : ["Chậm", "warn"] },
      { key: "inventoryTurnover", label: "Vòng quay hàng tồn kho", fmt: v => F.fmtNum(v, 2) + "x", eval: v => v >= 4 ? ["Nhanh", "good"] : v >= 2 ? ["Trung bình", "warn"] : ["Chậm", "danger"] },
      { key: "dso", label: "Số ngày thu tiền bình quân (DSO)", fmt: v => F.fmtNum(v, 0) + " ngày", eval: v => v <= 60 ? ["Tốt", "good"] : v <= 90 ? ["Theo dõi", "warn"] : ["Thu chậm", "danger"] }
    ];

    let html = `<thead><tr><th>Chỉ số tài chính</th>`;
    d.periods.forEach(p => html += `<th>${p}</th>`);
    html += `<th>Đánh giá (${d.periods[d.periods.length - 1]})</th></tr></thead><tbody>`;

    ratioDefs.forEach(def => {
      if (def.section) {
        html += `<tr class="row-section"><td colspan="${d.periods.length + 2}">${def.section}</td></tr>`;
        return;
      }
      const [badgeText, badgeTone] = def.eval(last[def.key]);
      html += `<tr><td>${def.label}</td>`;
      ratios.forEach(r => html += `<td>${def.fmt(r[def.key])}</td>`);
      html += `<td><span class="badge badge-${badgeTone}">${badgeText}</span></td></tr>`;
    });

    html += `</tbody>`;
    document.getElementById("ratiosTable").innerHTML = html;
  }

  // ================= TAB 4: FORECAST =================
  function getForecastAssumptions() {
    return {
      revGrowth: Number(document.getElementById("fcRevGrowth").value),
      grossMargin: Number(document.getElementById("fcGrossMargin").value),
      opexPct: Number(document.getElementById("fcOpexPct").value),
      depPct: Number(document.getElementById("fcDepPct").value),
      capexPct: Number(document.getElementById("fcCapexPct").value),
      taxRate: Number(document.getElementById("fcTaxRate").value),
      nwcPct: Number(document.getElementById("fcNwcPct").value)
    };
  }

  function updateForecast() {
    const rows = F.buildForecast(state.data, state.derived, getForecastAssumptions());
    state.forecastRows = rows;

    const tbl = document.getElementById("forecastTable");
    const metrics = [
      { label: "Doanh thu dự báo", key: "rev", hl: true },
      { label: "Lợi nhuận gộp", key: "grossProfit" },
      { label: "EBIT", key: "ebit" },
      { label: "EBITDA", key: "ebitda", hl: true },
      { label: "Lợi nhuận trước thuế (LNTT)", key: "ebt" },
      { label: "Lợi nhuận sau thuế (LNST)", key: "netProfit", hl: true },
      { label: "Vốn lưu động ròng (NWC)", key: "nwc" },
      { label: "CAPEX dự kiến", key: "capex" },
      { label: "Dòng tiền tự do (FCF)", key: "fcf", hl: true }
    ];

    let html = `<thead><tr><th>Chỉ tiêu (tỷ đồng)</th>${rows.map(r => `<th>${r.label}</th>`).join("")}</tr></thead><tbody>`;
    metrics.forEach(m => {
      html += `<tr class="${m.hl ? "row-highlight" : ""}"><td>${m.label}</td>`;
      rows.forEach(r => html += `<td>${F.fmtNum(r[m.key], 1)}</td>`);
      html += `</tr>`;
    });
    html += `</tbody>`;
    tbl.innerHTML = html;

    if (typeof Chart !== "undefined") {
      destroyChart("forecast");
      const last = state.data.periods.length - 1;
      const labels = [state.data.periods[last], ...rows.map(r => r.label)];
      const revs = [state.data.is.revenue[last], ...rows.map(r => r.rev)];
      const ebitdas = [state.derived.ebitda[last], ...rows.map(r => r.ebitda)];
      const fcfs = [state.derived.fcf[last], ...rows.map(r => r.fcf)];

      state.charts.forecast = new Chart(document.getElementById("forecastChart").getContext("2d"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "Doanh thu (tỷ)", data: revs, backgroundColor: "rgba(30, 58, 138, 0.78)" },
            { label: "EBITDA (tỷ)", data: ebitdas, backgroundColor: "rgba(217, 119, 6, 0.85)" },
            { label: "FCF (tỷ)", data: fcfs, type: "line", borderColor: "#15803d", backgroundColor: "#15803d", tension: 0.25, borderWidth: 3 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    updateValuationAndPeer();
  }

  // ================= TAB 5: PEER & VALUATION =================
  function updateValuationAndPeer() {
    const last = state.data.periods.length - 1;
    const r = state.derived.ratios[last];
    const forecastRows = state.forecastRows || F.buildForecast(state.data, state.derived, getForecastAssumptions());

    // Peer Chart
    if (typeof Chart !== "undefined") {
      destroyChart("peer");
      const peerVals = [
        Number(document.getElementById("peerGrossMargin").value) || 0,
        Number(document.getElementById("peerNetMargin").value) || 0,
        Number(document.getElementById("peerRoa").value) || 0,
        Number(document.getElementById("peerRoe").value) || 0,
        Number(document.getElementById("peerInvTurn").value) || 0
      ];
      const compVals = [
        +(r.grossMargin * 100).toFixed(1),
        +(r.netMargin * 100).toFixed(1),
        +(r.roa * 100).toFixed(1),
        +(r.roe * 100).toFixed(1),
        +r.inventoryTurnover.toFixed(1)
      ];
      state.charts.peer = new Chart(document.getElementById("peerChart").getContext("2d"), {
        type: "bar",
        data: {
          labels: ["Biên gộp (%)", "Biên ròng (%)", "ROA (%)", "ROE (%)", "VQ Tồn kho (x)"],
          datasets: [
            { label: "Doanh nghiệp", data: compVals, backgroundColor: "#1e3a8a" },
            { label: "Trung bình ngành", data: peerVals, backgroundColor: "#d97706" }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }

    // DCF & Multiples
    const wacc = Number(document.getElementById("valWacc").value) || 11;
    const termG = Number(document.getElementById("valTermG").value) || 3.5;
    const shares = Number(document.getElementById("valShares").value) || 100;
    const mktPrice = Number(document.getElementById("valMarketPrice").value) || 25;
    const multEvEbitda = Number(document.getElementById("valEvEbitda").value) || 8.5;
    const multPe = Number(document.getElementById("valPe").value) || 12;
    const multPb = Number(document.getElementById("valPb").value) || 1.8;

    const netDebt = state.derived.netDebt[last];
    const dcf = F.computeDcf(forecastRows, netDebt, wacc, termG, shares);

    const ebitdaLast = state.derived.ebitda[last];
    const npLast = state.derived.netProfit[last];
    const eqLast = state.data.bs.equity[last];

    const priceEvEbitda = shares > 0 ? (ebitdaLast * multEvEbitda - netDebt) / shares : 0;
    const pricePe = shares > 0 ? (npLast * multPe) / shares : 0;
    const pricePb = shares > 0 ? (eqLast * multPb) / shares : 0;

    const upside = (p) => {
      if (!mktPrice || mktPrice <= 0) return "";
      const diff = (p - mktPrice) / mktPrice;
      const cls = diff >= 0 ? "num-pos" : "num-neg";
      return `<span class="${cls}">${diff >= 0 ? "+" : ""}${F.fmtPct(diff, 1)} so với giá TT</span>`;
    };

    document.getElementById("valuationSummary").innerHTML = `
      <div class="val-box">
        <div class="val-box-label">Định giá DCF / CP</div>
        <div class="val-box-value">${dcf.valid ? F.fmtNum(dcf.pricePerShare, 1) + " nghìn đ" : "Lỗi giả định"}</div>
        <div class="val-box-note">${dcf.valid ? `EV: ${F.fmtNum(dcf.ev, 0)} tỷ · ${upside(dcf.pricePerShare)}` : dcf.error}</div>
      </div>
      <div class="val-box">
        <div class="val-box-label">Theo EV/EBITDA (${multEvEbitda}x)</div>
        <div class="val-box-value">${F.fmtNum(priceEvEbitda, 1)} nghìn đ</div>
        <div class="val-box-note">${upside(priceEvEbitda)}</div>
      </div>
      <div class="val-box">
        <div class="val-box-label">Theo P/E (${multPe}x)</div>
        <div class="val-box-value">${F.fmtNum(pricePe, 1)} nghìn đ</div>
        <div class="val-box-note">${upside(pricePe)}</div>
      </div>
      <div class="val-box">
        <div class="val-box-label">Theo P/B (${multPb}x)</div>
        <div class="val-box-value">${F.fmtNum(pricePb, 1)} nghìn đ</div>
        <div class="val-box-note">${upside(pricePb)}</div>
      </div>
    `;

    // Sensitivity Matrix (WACC vs g)
    const waccSteps = [wacc - 2, wacc - 1, wacc, wacc + 1, wacc + 2];
    const gSteps = [termG - 1, termG - 0.5, termG, termG + 0.5, termG + 1];

    let sHtml = `<thead><tr><th>WACC \\ g</th>${gSteps.map(g => `<th>g = ${F.fmtNum(g, 1)}%</th>`).join("")}</tr></thead><tbody>`;
    waccSteps.forEach(w => {
      sHtml += `<tr><td><strong>WACC = ${F.fmtNum(w, 1)}%</strong></td>`;
      gSteps.forEach(g => {
        const res = F.computeDcf(forecastRows, netDebt, w, g, shares);
        const isCenter = Math.abs(w - wacc) < 1e-6 && Math.abs(g - termG) < 1e-6;
        sHtml += `<td style="${isCenter ? "background:#e0e7ff;font-weight:800;" : ""}">${res.valid ? F.fmtNum(res.pricePerShare, 1) : "—"}</td>`;
      });
      sHtml += `</tr>`;
    });
    sHtml += `</tbody>`;
    document.getElementById("sensitivityTable").innerHTML = sHtml;
  }

  // ================= TAB 6: AI & PROMPTS =================
  function renderPromptLibrary() {
    const container = document.getElementById("promptLibraryContainer");
    const customQ = document.getElementById("aiCustomQuestion")?.value || "";
    container.innerHTML = window.AIPrompts.TEMPLATES.map(tpl => {
      const fullPrompt = window.AIPrompts.getContextualizedPrompt(tpl.id, state.data, state.derived, state.alerts, customQ);
      return `
        <div class="prompt-card">
          <div class="prompt-card-head">
            <h4>${tpl.title}</h4>
          </div>
          <div class="prompt-cols">
            <div class="prompt-pane">
              <div class="prompt-pane-head">
                <span>📌 Mẫu gốc (sạch)</span>
                <button class="btn btn-sm btn-outline" onclick="window.copyPromptText('${tpl.id}', false, this)">📋 Copy mẫu gốc</button>
              </div>
              <pre class="prompt-pre" id="prompt-base-${tpl.id}">${escapeHtml(tpl.basePrompt)}</pre>
            </div>
            <div class="prompt-pane">
              <div class="prompt-pane-head">
                <span>⚡ Bản đã ghép số liệu (${escapeHtml(state.data.companyName)})</span>
                <button class="btn btn-sm btn-primary" onclick="window.copyPromptText('${tpl.id}', true, this)">📋 Copy kèm số liệu</button>
              </div>
              <pre class="prompt-pre" id="prompt-ctx-${tpl.id}">${escapeHtml(fullPrompt)}</pre>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ================= TAB 7: LEARNING =================
  function renderLearningModules() {
    document.getElementById("learningModulesGrid").innerHTML = window.LEARNING_MODULES.map(m => `
      <div class="module-card">
        <div class="module-tag">${m.tag}</div>
        <h3>${m.title}</h3>
        <p class="muted">${m.desc}</p>
        <ul>${m.bullets.map(b => `<li>${b}</li>`).join("")}</ul>
      </div>
    `).join("");
  }

  // ================= GLOBAL HANDLERS (window.*) =================
  window.switchTab = function (tabId) {
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".tab-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === tabId);
    });
  };

  window.onSelectSample = function (val) {
    if (val === "custom") {
      state.sampleKey = "custom";
      saveStateToLocal();
      return;
    }
    if (window.BCTC_SAMPLES[val]) {
      state.sampleKey = val;
      state.data = deepClone(window.BCTC_SAMPLES[val]);
      recomputeAll();
      showStatus(`Đã nạp bộ dữ liệu: ${state.data.companyName}`);
    }
  };

  window.onCompanyNameChange = function (val) {
    state.data.companyName = val.trim() || "Doanh nghiệp của tôi";
    state.sampleKey = "custom";
    recomputeAll();
  };

  window.setStatementType = function (type) {
    state.statementType = type;
    ["is", "bs", "cf"].forEach(k => {
      document.getElementById("stmt-" + k).classList.toggle("active", k === type);
    });
    renderStatementTable();
  };

  window.setAnalysisMode = function (mode) {
    state.analysisMode = mode;
    ["abs", "vertical", "horizontal"].forEach(k => {
      document.getElementById("mode-" + k).classList.toggle("active", k === mode);
    });
    renderStatementTable();
  };

  window.onCellEdit = function (stmtType, key, idx, rawVal) {
    const num = Number(rawVal);
    state.data[stmtType][key][idx] = isNaN(num) ? 0 : num;
    state.sampleKey = "custom";
    recomputeAll();
  };

  window.onBudgetEdit = function (key, rawVal) {
    if (!state.data.budgetLatest) state.data.budgetLatest = {};
    state.data.budgetLatest[key] = Number(rawVal) || 0;
    state.sampleKey = "custom";
    recomputeAll();
  };

  window.addNewPeriod = function () {
    const label = prompt("Nhập tên kỳ/năm mới (ví dụ: 2027 hoặc Q2/2026):", "2027");
    if (!label || !label.trim()) return;
    state.data.periods.push(label.trim());
    ["is", "bs", "cf"].forEach(sec => {
      Object.keys(state.data[sec]).forEach(k => {
        const arr = state.data[sec][k];
        arr.push(arr.length ? arr[arr.length - 1] : 0);
      });
    });
    state.sampleKey = "custom";
    recomputeAll();
    showStatus(`Đã thêm kỳ mới: ${label.trim()}`);
  };

  window.resetToCurrentSample = function () {
    const key = window.BCTC_SAMPLES[state.sampleKey] ? state.sampleKey : "sample_5y";
    state.sampleKey = key;
    state.data = deepClone(window.BCTC_SAMPLES[key]);
    recomputeAll();
    showStatus("Đã khôi phục về số liệu mẫu ban đầu.");
  };

  window.resetForecastAssumptions = function () {
    document.getElementById("fcRevGrowth").value = 12;
    document.getElementById("fcGrossMargin").value = 28;
    document.getElementById("fcOpexPct").value = 14;
    document.getElementById("fcDepPct").value = 3.5;
    document.getElementById("fcCapexPct").value = 4;
    document.getElementById("fcTaxRate").value = 20;
    document.getElementById("fcNwcPct").value = 15;
    updateForecast();
  };

  window.renderDashboard = renderDashboard;
  window.updateForecast = updateForecast;
  window.updateValuationAndPeer = updateValuationAndPeer;
  window.saveAiConfig = saveAiConfig;

  window.generateOfflineReport = function () {
    try {
      const type = document.getElementById("reportTypeSelect").value;
      const md = F.generateOfflineReport(state.data, state.derived, state.alerts, type);
      document.getElementById("reportDraftArea").value = md;
      document.getElementById("reportStatus").textContent = "✅ Đã sinh bản nháp báo cáo thành công.";
    } catch (e) {
      document.getElementById("reportStatus").textContent = "❌ Lỗi sinh báo cáo: " + e.message;
    }
  };

  window.copyReportDraft = async function () {
    const txt = document.getElementById("reportDraftArea").value;
    if (!txt) return showStatus("Chưa có nội dung báo cáo để copy.", "warn");
    try {
      await navigator.clipboard.writeText(txt);
      showStatus("Đã copy bản nháp báo cáo vào clipboard!");
    } catch (e) {
      showStatus("Không thể copy tự động, hãy bôi đen và nhấn Ctrl+C.", "warn");
    }
  };

  window.downloadReportMd = function () {
    const txt = document.getElementById("reportDraftArea").value;
    if (!txt) return showStatus("Hãy bấm 'Tạo bản nháp' trước khi tải.", "warn");
    const blob = new Blob([txt], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Bao_cao_BCTC_${Date.now()}.md`;
    a.click();
  };

  window.copyPromptText = async function (id, withCtx, btn) {
    const el = document.getElementById((withCtx ? "prompt-ctx-" : "prompt-base-") + id);
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.textContent);
      const old = btn.textContent;
      btn.textContent = "✅ Đã copy!";
      setTimeout(() => (btn.textContent = old), 1800);
    } catch (e) {
      showStatus("Trình duyệt chặn clipboard, hãy bôi đen nội dung và nhấn Ctrl+C.", "warn");
    }
  };

  window.runDirectAiAnalysis = async function () {
    const btn = document.getElementById("runAiBtn");
    const status = document.getElementById("aiCallStatus");
    const out = document.getElementById("aiResponseBox");
    const provider = document.getElementById("aiProviderSelect").value;
    const apiKey = document.getElementById("aiApiKeyInput").value;
    const taskId = document.getElementById("aiTaskSelect").value;
    const customQ = document.getElementById("aiCustomQuestion").value;

    btn.disabled = true;
    status.className = "inline-status";
    status.textContent = "⏳ Đang gửi số liệu tới AI để phân tích...";

    try {
      const prompt = window.AIPrompts.getContextualizedPrompt(taskId, state.data, state.derived, state.alerts, customQ);
      const reply = await window.AIPrompts.callAiApi({ provider, apiKey, prompt });
      out.textContent = reply;
      out.classList.remove("hidden");
      status.textContent = "✅ Hoàn tất phân tích từ AI!";
    } catch (err) {
      status.className = "inline-status error";
      status.textContent = "❌ " + err.message;
    } finally {
      btn.disabled = false;
    }
  };

  // Excel Export Template & Import
  window.downloadExcelTemplate = function () {
    try {
      if (typeof XLSX === "undefined") {
        throw new Error("Thư viện SheetJS chưa tải được (cần kết nối mạng để xuất file .xlsx).");
      }
      const d = state.data;
      const rows = [
        ["Section", "Key", "ChiTieu", ...d.periods]
      ];
      ["is", "bs", "cf"].forEach(sec => {
        STATEMENT_DEFS[sec].forEach(def => {
          if (def.editable) {
            rows.push([sec, def.key, def.label, ...d[sec][def.key]]);
          }
        });
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BCTC_Data");
      XLSX.writeFile(wb, "Mau_Nhap_BCTC_AI.xlsx");
      showStatus("Đã tải xuống file Excel mẫu chuẩn (Mau_Nhap_BCTC_AI.xlsx).");
    } catch (e) {
      showStatus("Lỗi xuất Excel: " + e.message, "error");
    }
  };

  window.handleExcelUpload = async function (event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (typeof XLSX === "undefined") {
        throw new Error("Thư viện SheetJS chưa sẵn sàng. Hãy đảm bảo có kết nối internet.");
      }
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (!rows || rows.length < 2) throw new Error("File Excel không có dữ liệu hợp lệ.");

      const header = rows[0];
      const periods = header.slice(3).filter(x => x !== undefined && String(x).trim() !== "").map(String);
      if (periods.length === 0) throw new Error("Không tìm thấy cột kỳ/năm từ cột D trở đi. Hãy dùng file Excel mẫu.");

      const newData = deepClone(state.data);
      newData.companyName = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
      newData.periods = periods;

      ["is", "bs", "cf"].forEach(sec => {
        Object.keys(newData[sec]).forEach(k => {
          newData[sec][k] = periods.map(() => 0);
        });
      });

      for (let r = 1; r < rows.length; r++) {
        const sec = String(rows[r][0] || "").trim().toLowerCase();
        const key = String(rows[r][1] || "").trim();
        if (newData[sec] && newData[sec][key]) {
          newData[sec][key] = periods.map((_, idx) => Number(rows[r][3 + idx]) || 0);
        }
      }

      state.data = newData;
      state.sampleKey = "custom";
      recomputeAll();
      showStatus(`Đã nhập thành công dữ liệu từ "${file.name}" (${periods.length} kỳ).`);
    } catch (e) {
      showStatus("Lỗi đọc file Excel: " + e.message, "error");
    } finally {
      event.target.value = "";
    }
  };

  window.exportJsonBackup = function () {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `BCTC_Backup_${Date.now()}.json`;
    a.click();
    showStatus("Đã xuất file Backup JSON.");
  };

  window.handleJsonImport = async function (event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt);
      if (!parsed.periods || !parsed.is || !parsed.bs || !parsed.cf) {
        throw new Error("Cấu trúc file JSON không đúng định dạng BCTC.");
      }
      state.data = parsed;
      state.sampleKey = "custom";
      recomputeAll();
      showStatus(`Đã khôi phục dữ liệu từ "${file.name}".`);
    } catch (e) {
      showStatus("Lỗi khôi phục JSON: " + e.message, "error");
    } finally {
      event.target.value = "";
    }
  };

  // Init
  document.addEventListener("DOMContentLoaded", function () {
    loadInitialState();
    loadAiConfig();
    renderLearningModules();
    recomputeAll();
  });
})();
