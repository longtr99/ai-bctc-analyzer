// Engine tính toán tài chính thuần JS (v1.0)
window.FinanceEngine = (function () {
  function safeDiv(a, b) {
    if (b === null || b === undefined || isNaN(b) || Math.abs(b) < 1e-9) return 0;
    return a / b;
  }

  function fmtNum(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return Number(val).toLocaleString("vi-VN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtPct(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return (val * 100).toLocaleString("vi-VN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }) + "%";
  }

  function computeDerived(data) {
    const n = data.periods.length;
    const is = data.is;
    const bs = data.bs;
    const cf = data.cf;

    const grossProfit = [];
    const ebit = [];
    const ebitda = [];
    const ebt = [];
    const netProfit = [];

    const currentAssets = [];
    const nonCurrentAssets = [];
    const totalAssets = [];
    const currentLiabilities = [];
    const totalLiabilities = [];
    const totalDebt = [];
    const netDebt = [];
    const nwc = [];
    const fcf = [];

    for (let i = 0; i < n; i++) {
      const rev = Number(is.revenue[i]) || 0;
      const cogs = Number(is.cogs[i]) || 0;
      const sga = Number(is.sga[i]) || 0;
      const dep = Number(is.depreciation[i]) || 0;
      const finInc = Number(is.finIncome[i]) || 0;
      const intExp = Number(is.interestExpense[i]) || 0;
      const otherP = Number(is.otherProfit[i]) || 0;
      const tax = Number(is.taxExpense[i]) || 0;

      const gp = rev - cogs;
      const opProfit = gp - sga; // EBIT từ HĐKD cốt lõi
      const ebitdaVal = opProfit + dep;
      const ebtVal = opProfit + finInc - intExp + otherP;
      const np = ebtVal - tax;

      grossProfit.push(gp);
      ebit.push(opProfit);
      ebitda.push(ebitdaVal);
      ebt.push(ebtVal);
      netProfit.push(np);

      const ca = (Number(bs.cash[i]) || 0) + (Number(bs.receivables[i]) || 0) + (Number(bs.inventory[i]) || 0) + (Number(bs.otherCurrent[i]) || 0);
      const nca = (Number(bs.fixedAssets[i]) || 0) + (Number(bs.longTermInvest[i]) || 0) + (Number(bs.otherNonCurrent[i]) || 0);
      const ta = ca + nca;
      const cl = (Number(bs.shortTermDebt[i]) || 0) + (Number(bs.payables[i]) || 0);
      const tl = cl + (Number(bs.longTermDebt[i]) || 0);
      const debt = (Number(bs.shortTermDebt[i]) || 0) + (Number(bs.longTermDebt[i]) || 0);
      const nd = debt - (Number(bs.cash[i]) || 0);

      currentAssets.push(ca);
      nonCurrentAssets.push(nca);
      totalAssets.push(ta);
      currentLiabilities.push(cl);
      totalLiabilities.push(tl);
      totalDebt.push(debt);
      netDebt.push(nd);
      nwc.push(ca - cl);

      const ocfVal = Number(cf.ocf[i]) || 0;
      const capexVal = Number(cf.capex[i]) || 0;
      fcf.push(ocfVal - capexVal);
    }

    // Ratios
    const ratios = [];
    for (let i = 0; i < n; i++) {
      const rev = Number(is.revenue[i]) || 0;
      const cogs = Number(is.cogs[i]) || 0;
      const eq = Number(bs.equity[i]) || 0;
      const inv = Number(bs.inventory[i]) || 0;
      const rec = Number(bs.receivables[i]) || 0;
      const intExp = Number(is.interestExpense[i]) || 0;

      ratios.push({
        period: data.periods[i],
        currentRatio: safeDiv(currentAssets[i], currentLiabilities[i]),
        quickRatio: safeDiv(currentAssets[i] - inv, currentLiabilities[i]),
        debtToEquity: safeDiv(totalLiabilities[i], eq),
        finDebtToEquity: safeDiv(totalDebt[i], eq),
        debtToAssets: safeDiv(totalLiabilities[i], totalAssets[i]),
        icr: intExp > 0 ? safeDiv(ebit[i], intExp) : 99,
        grossMargin: safeDiv(grossProfit[i], rev),
        ebitdaMargin: safeDiv(ebitda[i], rev),
        netMargin: safeDiv(netProfit[i], rev),
        roa: safeDiv(netProfit[i], totalAssets[i]),
        roe: safeDiv(netProfit[i], eq),
        assetTurnover: safeDiv(rev, totalAssets[i]),
        inventoryTurnover: safeDiv(cogs, inv),
        dso: safeDiv(rec, rev) * 365
      });
    }

    return {
      grossProfit, ebit, ebitda, ebt, netProfit,
      currentAssets, nonCurrentAssets, totalAssets,
      currentLiabilities, totalLiabilities, totalDebt, netDebt, nwc, fcf,
      ratios
    };
  }

  function yoyPct(arr, idx) {
    if (idx <= 0 || !arr || Math.abs(arr[idx - 1]) < 1e-9) return null;
    return (arr[idx] - arr[idx - 1]) / Math.abs(arr[idx - 1]);
  }

  function detectRisksAndVariance(data, derived) {
    const alerts = [];
    const n = data.periods.length;
    if (n === 0) return alerts;
    const last = n - 1;
    const prev = n - 2;
    const rLast = derived.ratios[last];

    // 1. Giải thích biến động: Doanh thu tăng nhưng LNTT giảm
    if (prev >= 0) {
      const revChg = yoyPct(data.is.revenue, last);
      const ebtChg = yoyPct(derived.ebt, last);
      const gpChg = derived.grossProfit[last] - derived.grossProfit[prev];
      const sgaChg = data.is.sga[last] - data.is.sga[prev];
      const intChg = data.is.interestExpense[last] - data.is.interestExpense[prev];

      if (revChg > 0.02 && ebtChg < -0.02) {
        const reasons = [];
        if (rLast.grossMargin < derived.ratios[prev].grossMargin - 0.01) {
          reasons.push(`biên lợi nhuận gộp thu hẹp từ ${fmtPct(derived.ratios[prev].grossMargin)} xuống ${fmtPct(rLast.grossMargin)}`);
        }
        if (sgaChg > 0 && sgaChg > gpChg * 0.5) {
          reasons.push(`chi phí bán hàng & QLDN tăng thêm +${fmtNum(sgaChg)} tỷ`);
        }
        if (intChg > 5) {
          reasons.push(`chi phí lãi vay tăng thêm +${fmtNum(intChg)} tỷ`);
        }
        alerts.push({
          level: "danger",
          title: `Nghịch lý tăng trưởng: Doanh thu tăng ${fmtPct(revChg)} nhưng LNTT giảm ${fmtPct(Math.abs(ebtChg))}`,
          desc: `Nguyên nhân chính: ${reasons.length ? reasons.join("; ") : "áp lực chi phí đầu vào và chi phí vận hành tăng nhanh hơn doanh thu"}. Cần rà soát lại cơ cấu giá vốn và kiểm soát định phí.`
        });
      } else if (revChg < -0.05 && derived.netProfit[last] > derived.netProfit[prev]) {
        alerts.push({
          level: "warn",
          title: `Doanh thu giảm ${fmtPct(Math.abs(revChg))} nhưng LNST vẫn tăng mạnh`,
          desc: `Cần kiểm tra chất lượng lợi nhuận: Thu nhập tài chính kỳ này đạt ${fmtNum(data.is.finIncome[last])} tỷ (chiếm ${fmtPct(safeDiv(data.is.finIncome[last], Math.max(derived.ebt[last], 1)))} LNTT). Lợi nhuận đột biến từ hoạt động tài chính thường không bền vững bằng kinh doanh cốt lõi.`
        });
      }

      // 2. Công nợ phải thu tăng nhanh hơn doanh thu
      const recChg = yoyPct(data.bs.receivables, last);
      if (recChg !== null && revChg !== null && recChg > revChg + 0.08 && recChg > 0.1) {
        alerts.push({
          level: "warn",
          title: `Công nợ phải thu tăng nhanh (+${fmtPct(recChg)} so với tăng trưởng doanh thu ${fmtPct(revChg)})`,
          desc: `Khoản phải thu đạt ${fmtNum(data.bs.receivables[last])} tỷ (DSO ~ ${fmtNum(rLast.dso, 0)} ngày). Rủi ro nới lỏng chính sách bán chịu hoặc nợ khó đòi tăng.`
        });
      }

      // 3. Tồn kho tăng cao
      const invChg = yoyPct(data.bs.inventory, last);
      if (invChg !== null && revChg !== null && invChg > revChg + 0.08 && invChg > 0.1) {
        alerts.push({
          level: "warn",
          title: `Hàng tồn kho tăng nhanh (+${fmtPct(invChg)})`,
          desc: `Tồn kho lên mức ${fmtNum(data.bs.inventory[last])} tỷ, vòng quay tồn kho còn ${fmtNum(rLast.inventoryTurnover, 2)} vòng. Nguy cơ ứ đọng vốn lưu động và trích lập dự phòng giảm giá.`
        });
      }
    }

    // 4. Lợi nhuận dương nhưng dòng tiền kinh doanh âm hoặc rất yếu
    const npLast = derived.netProfit[last];
    const ocfLast = data.cf.ocf[last];
    if (npLast > 0 && ocfLast < 0) {
      alerts.push({
        level: "danger",
        title: `Chất lượng lợi nhuận thấp: LNST dương (+${fmtNum(npLast)} tỷ) nhưng Dòng tiền kinh doanh âm (${fmtNum(ocfLast)} tỷ)`,
        desc: `Tiền thực không chảy về tương ứng với lợi nhuận trên sổ sách. Kiểm tra ngay biến động Phải thu, Tồn kho và tỷ trọng thu nhập tài chính chưa thu tiền.`
      });
    } else if (npLast > 0 && ocfLast < npLast * 0.5) {
      alerts.push({
        level: "warn",
        title: `Dòng tiền kinh doanh (${fmtNum(ocfLast)} tỷ) yếu hơn nhiều so với LNST (${fmtNum(npLast)} tỷ)`,
        desc: `Tỷ lệ OCF/LNST chỉ đạt ${fmtPct(safeDiv(ocfLast, npLast))}. Vốn đang bị giam trong vốn lưu động.`
      });
    }

    // 5. Xu hướng biên lợi nhuận tụt dần 3 năm liên tiếp
    if (n >= 3) {
      const gm1 = derived.ratios[n - 3].grossMargin;
      const gm2 = derived.ratios[n - 2].grossMargin;
      const gm3 = derived.ratios[n - 1].grossMargin;
      if (gm1 > gm2 && gm2 > gm3) {
        alerts.push({
          level: "danger",
          title: `Cảnh báo xu hướng: Biên lợi nhuận gộp tụt giảm 3 kỳ liên tiếp`,
          desc: `Giảm từ ${fmtPct(gm1)} → ${fmtPct(gm2)} → ${fmtPct(gm3)}. Doanh nghiệp đang mất dần lợi thế định giá hoặc chịu áp lực chi phí nguyên vật liệu kéo dài.`
        });
      }
    }

    // 6. Thanh khoản & Đòn bẩy
    if (rLast.currentRatio < 1.1) {
      alerts.push({
        level: "danger",
        title: `Áp lực thanh khoản ngắn hạn (Current Ratio = ${fmtNum(rLast.currentRatio, 2)})`,
        desc: `Tài sản ngắn hạn chỉ vừa đủ hoặc thấp hơn nợ ngắn hạn. Cần cơ cấu lại kỳ hạn nợ và đẩy nhanh thu hồi công nợ.`
      });
    }
    if (rLast.debtToEquity > 1.5) {
      alerts.push({
        level: "warn",
        title: `Đòn bẩy nợ ở mức cao (D/E = ${fmtNum(rLast.debtToEquity, 2)} lần)`,
        desc: `Tổng nợ phải trả (${fmtNum(derived.totalLiabilities[last])} tỷ) vượt xa vốn chủ sở hữu (${fmtNum(data.bs.equity[last])} tỷ), làm tăng rủi ro chi phí lãi vay khi lãi suất biến động.`
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        level: "good",
        title: "Cấu trúc tài chính hiện tại ở trạng thái cân bằng, chưa phát hiện cảnh báo đỏ nghiêm trọng",
        desc: "Tiếp tục theo dõi biến động biên lợi nhuận và dòng tiền kinh doanh so với kế hoạch ở các kỳ tới."
      });
    }
    return alerts;
  }

  function buildForecast(data, derived, assumptions) {
    const last = data.periods.length - 1;
    const baseRev = Number(data.is.revenue[last]) || 100;
    const lastYearNum = parseInt(String(data.periods[last]).replace(/\D/g, ""), 10);
    const startYear = (!isNaN(lastYearNum) && lastYearNum >= 2000 && lastYearNum <= 2100) ? lastYearNum : 2026;

    const g = (Number(assumptions.revGrowth) || 0) / 100;
    const gm = (Number(assumptions.grossMargin) || 0) / 100;
    const opex = (Number(assumptions.opexPct) || 0) / 100;
    const dep = (Number(assumptions.depPct) || 0) / 100;
    const capexPct = (Number(assumptions.capexPct) || 0) / 100;
    const taxRate = (Number(assumptions.taxRate) || 0) / 100;
    const nwcPct = (Number(assumptions.nwcPct) || 0) / 100;

    let prevRev = baseRev;
    let prevNwc = derived.nwc[last];
    const rows = [];

    for (let y = 1; y <= 3; y++) {
      const label = `Dự báo ${startYear + y}`;
      const rev = prevRev * (1 + g);
      const grossProfit = rev * gm;
      const sga = rev * opex;
      const ebit = grossProfit - sga;
      const depreciation = rev * dep;
      const ebitda = ebit + depreciation;
      const intExp = Number(data.is.interestExpense[last]) || 0;
      const ebt = ebit - intExp;
      const tax = ebt > 0 ? ebt * taxRate : 0;
      const netProfit = ebt - tax;
      const nwc = rev * nwcPct;
      const deltaNwc = nwc - prevNwc;
      const capex = rev * capexPct;
      // Unlevered FCF ~ EBIT*(1-t) + Dep - CAPEX - deltaNWC
      const fcf = ebit * (1 - taxRate) + depreciation - capex - deltaNwc;

      rows.push({
        label, rev, grossProfit, ebit, ebitda, ebt, netProfit, nwc, deltaNwc, capex, fcf
      });
      prevRev = rev;
      prevNwc = nwc;
    }
    return rows;
  }

  function computeDcf(forecastRows, netDebt, waccPct, termGPct, sharesMil) {
    const wacc = (Number(waccPct) || 10) / 100;
    const g = (Number(termGPct) || 3) / 100;
    if (wacc <= g + 0.005) {
      return { valid: false, error: "WACC phải lớn hơn tăng trưởng dài hạn g ít nhất 0.5%." };
    }
    let pvFcf = 0;
    forecastRows.forEach((row, idx) => {
      pvFcf += row.fcf / Math.pow(1 + wacc, idx + 1);
    });
    const lastFcf = forecastRows[forecastRows.length - 1].fcf;
    const terminalVal = (lastFcf * (1 + g)) / (wacc - g);
    const pvTerminal = terminalVal / Math.pow(1 + wacc, forecastRows.length);
    const ev = pvFcf + pvTerminal;
    const equityVal = ev - netDebt;
    const pricePerShare = sharesMil > 0 ? equityVal / sharesMil : 0; // tỷ / triệu CP = nghìn đồng/CP
    return { valid: true, pvFcf, pvTerminal, ev, equityVal, pricePerShare };
  }

  function generateOfflineReport(data, derived, alerts, reportType) {
    const n = data.periods.length;
    const last = n - 1;
    const prev = n - 2;
    const pLast = data.periods[last];
    const r = derived.ratios[last];
    const revYoy = prev >= 0 ? fmtPct(yoyPct(data.is.revenue, last)) : "N/A";
    const npYoy = prev >= 0 ? fmtPct(yoyPct(derived.netProfit, last)) : "N/A";

    const titles = {
      bod: `BÁO CÁO PHÂN TÍCH TÀI CHÍNH TRÌNH BAN GIÁM ĐỐC — ${data.companyName}`,
      monthly: `BÁO CÁO TÀI CHÍNH QUẢN TRỊ KỲ ${pLast} — ${data.companyName}`,
      agm: `BÁO CÁO KẾT QUẢ TÀI CHÍNH TRÌNH ĐẠI HỘI ĐỒNG CỔ ĐÔNG — ${data.companyName}`
    };

    const alertLines = alerts.map((a, i) => `${i + 1}. [${a.level.toUpperCase()}] ${a.title}\n   - ${a.desc}`).join("\n");

    return `# ${titles[reportType] || titles.bod}
Kỳ báo cáo: ${pLast} | Đơn vị tính: ${data.unit}

## 1. TÓM TẮT ĐIỀU HÀNH (EXECUTIVE SUMMARY)
- **Doanh thu thuần:** ${fmtNum(data.is.revenue[last])} tỷ (YoY: ${revYoy})
- **Lợi nhuận gộp:** ${fmtNum(derived.grossProfit[last])} tỷ (Biên gộp: ${fmtPct(r.grossMargin)})
- **EBITDA:** ${fmtNum(derived.ebitda[last])} tỷ (Biên EBITDA: ${fmtPct(r.ebitdaMargin)})
- **Lợi nhuận sau thuế (LNST):** ${fmtNum(derived.netProfit[last])} tỷ (YoY: ${npYoy} | Biên ròng: ${fmtPct(r.netMargin)})
- **Dòng tiền kinh doanh (OCF):** ${fmtNum(data.cf.ocf[last])} tỷ | **Dòng tiền tự do (FCF):** ${fmtNum(derived.fcf[last])} tỷ

## 2. SỨC KHỎE BẢNG CÂN ĐỐI & CHỈ SỐ CỐT LÕI
- **Tổng tài sản:** ${fmtNum(derived.totalAssets[last])} tỷ | **Vốn chủ sở hữu:** ${fmtNum(data.bs.equity[last])} tỷ | **Tổng nợ phải trả:** ${fmtNum(derived.totalLiabilities[last])} tỷ
- **Thanh khoản:** Current Ratio = ${fmtNum(r.currentRatio, 2)}x | Quick Ratio = ${fmtNum(r.quickRatio, 2)}x
- **Đòn bẩy:** D/E = ${fmtNum(r.debtToEquity, 2)}x | Nợ/Tổng tài sản = ${fmtPct(r.debtToAssets)}
- **Hiệu quả & Sinh lời:** ROA = ${fmtPct(r.roa)} | ROE = ${fmtPct(r.roe)} | Vòng quay tài sản = ${fmtNum(r.assetTurnover, 2)}x | DSO = ${fmtNum(r.dso, 0)} ngày

## 3. PHÂN TÍCH BIẾN ĐỘNG & CẢNH BÁO RỦI RO
${alertLines}

## 4. KIẾN NGHỊ HÀNH ĐỘNG CHO BAN LÃNH ĐẠO
1. **Kiểm soát biên lợi nhuận:** Rà soát cơ cấu giá vốn và định phí (CP Bán hàng & QLDN) để bảo vệ biên EBITDA.
2. **Tối ưu vốn lưu động:** Đặt hạn mức công nợ phải thu (DSO) và giải phóng hàng tồn kho chậm luân chuyển nhằm cải thiện dòng tiền kinh doanh (OCF).
3. **Kỷ luật tài chính:** Cân đối giữa nợ vay ngắn hạn và dài hạn, ưu tiên nguồn tài trợ phù hợp với dòng tiền thực thu.
`;
  }

  return {
    safeDiv, fmtNum, fmtPct, yoyPct,
    computeDerived, detectRisksAndVariance, buildForecast, computeDcf, generateOfflineReport
  };
})();
