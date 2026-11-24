// Thư viện Prompt AI (Bản mẫu gốc + Tự động ghép số liệu) & Kết nối AI API (v1.0)
window.AIPrompts = (function () {
  const TEMPLATES = [
    {
      id: "variance",
      title: "1. Giải thích biến động & Nguyên nhân gốc rễ",
      basePrompt: `Bạn là Giám đốc Tài chính (CFO) giàu kinh nghiệm. Hãy phân tích báo cáo tài chính đính kèm và:
1. Giải thích rõ nguyên nhân biến động Doanh thu, Biên lợi nhuận gộp, EBITDA và Lợi nhuận trước thuế giữa các kỳ.
2. Chỉ ra cụ thể vì sao lợi nhuận tăng hoặc giảm so với tốc độ tăng trưởng doanh thu.
3. Đánh giá chất lượng lợi nhuận bằng cách đối chiếu LNST với Dòng tiền kinh doanh (OCF).
4. Đề xuất 3 câu hỏi quản trị quan trọng nhất mà Ban Giám đốc cần làm rõ ngay.`
    },
    {
      id: "risks",
      title: "2. Soát xét rủi ro & Dấu hiệu bất thường (Red Flags)",
      basePrompt: `Bạn là Chuyên gia Kiểm toán & Quản trị Rủi ro Tài chính. Dựa trên số liệu BCTC, hãy:
1. Rà soát xu hướng 3-5 năm để phát hiện sớm tình trạng biên lợi nhuận tụt dần.
2. Kiểm tra bất thường ở Công nợ phải thu, Hàng tồn kho, Chi phí tài chính và Nợ ngắn hạn.
3. Xếp hạng 3 rủi ro lớn nhất (Cao / Trung bình / Thấp) kèm bằng chứng định lượng.
4. Gợi ý các biện pháp kiểm soát rủi ro ngắn hạn trong 90 ngày.`
    },
    {
      id: "bod_report",
      title: "3. Viết Báo cáo Quản trị cho Ban Giám đốc / ĐHCĐ",
      basePrompt: `Hãy soạn thảo một bản Báo cáo Phân tích Tài chính súc tích, ngôn ngữ điều hành dành cho Ban Giám đốc gồm 4 phần:
1. Tóm tắt kết quả nổi bật (3-5 gạch đầu dòng có số liệu so sánh YoY và Kế hoạch).
2. Phân tích cấu trúc tài chính & sức khỏe dòng tiền.
3. Điểm nghẽn vận hành cần xử lý ngay.
4. Đề xuất ưu tiên hành động cho quý tới (gắn với KPI đo lường).`
    },
    {
      id: "forecast",
      title: "4. Dự báo dòng tiền & Tối ưu vốn lưu động",
      basePrompt: `Dựa trên dữ liệu lịch sử BCTC, hãy xây dựng 3 kịch bản dự báo (Thận trọng / Cơ sở / Tích cực) cho năm tới về Doanh thu, EBITDA, LNTT và Dòng tiền tự do (FCF). Đồng thời tính xem nếu giảm số ngày thu tiền (DSO) và tồn kho xuống 15%, doanh nghiệp sẽ giải phóng thêm được bao nhiêu tỷ đồng tiền mặt.`
    },
    {
      id: "valuation",
      title: "5. So sánh cùng ngành & Định giá (DCF, Multiples)",
      basePrompt: `Dựa trên các chỉ số tài chính của doanh nghiệp và mặt bằng ngành, hãy:
1. Đánh giá điểm mạnh, điểm yếu của doanh nghiệp so với đối thủ cùng ngành.
2. Nhận xét mức định giá hợp lý theo EV/EBITDA, P/E, P/B và DCF.
3. Chỉ ra các giả định nhạy cảm nhất (WACC, tăng trưởng dài hạn g, biên EBITDA) có thể làm thay đổi mạnh kết quả định giá.`
    }
  ];

  function buildDataContext(data, derived, alerts) {
    const F = window.FinanceEngine;
    const periods = data.periods.join(" | ");
    const row = (label, arr) => `- ${label}: ${arr.map(v => F.fmtNum(v, 1)).join(" | ")}`;
    const ratioRow = (label, key, isPct) =>
      `- ${label}: ${derived.ratios.map(r => isPct ? F.fmtPct(r[key], 1) : F.fmtNum(r[key], 2)).join(" | ")}`;

    const alertText = alerts.map(a => `* ${a.title}: ${a.desc}`).join("\n");

    return `[DỮ LIỆU BCTC CỦA DOANH NGHIỆP: ${data.companyName} | ĐVT: ${data.unit}]
Các kỳ: ${periods}

1) Kết quả kinh doanh:
${row("Doanh thu thuần", data.is.revenue)}
${row("Lợi nhuận gộp", derived.grossProfit)}
${row("CP Bán hàng & QLDN", data.is.sga)}
${row("EBITDA", derived.ebitda)}
${row("Thu nhập tài chính", data.is.finIncome)}
${row("Chi phí lãi vay", data.is.interestExpense)}
${row("LNTT", derived.ebt)}
${row("LNST", derived.netProfit)}

2) Bảng cân đối kế toán & Lưu chuyển tiền tệ:
${row("Tổng tài sản", derived.totalAssets)}
${row("Tiền & TĐT", data.bs.cash)}
${row("Phải thu ngắn hạn", data.bs.receivables)}
${row("Hàng tồn kho", data.bs.inventory)}
${row("Đầu tư dài hạn/Công ty con", data.bs.longTermInvest)}
${row("Tổng nợ phải trả", derived.totalLiabilities)}
${row("Vốn chủ sở hữu", data.bs.equity)}
${row("Dòng tiền kinh doanh (OCF)", data.cf.ocf)}
${row("Dòng tiền đầu tư (ICF)", data.cf.icf)}
${row("Dòng tiền tự do (FCF)", derived.fcf)}

3) Chỉ số tài chính chính:
${ratioRow("Current Ratio", "currentRatio", false)}
${ratioRow("Quick Ratio", "quickRatio", false)}
${ratioRow("D/E", "debtToEquity", false)}
${ratioRow("Biên gộp", "grossMargin", true)}
${ratioRow("Biên EBITDA", "ebitdaMargin", true)}
${ratioRow("Biên ròng", "netMargin", true)}
${ratioRow("ROA", "roa", true)}
${ratioRow("ROE", "roe", true)}
${ratioRow("Vòng quay tài sản", "assetTurnover", false)}

4) Cảnh báo sơ bộ hệ thống ghi nhận:
${alertText}`;
  }

  function getContextualizedPrompt(taskId, data, derived, alerts, customQuestion) {
    const tpl = TEMPLATES.find(t => t.id === taskId) || TEMPLATES[0];
    const ctx = buildDataContext(data, derived, alerts);
    const extra = customQuestion && customQuestion.trim()
      ? `\n\nYêu cầu bổ sung từ người dùng: ${customQuestion.trim()}`
      : "";
    return `${tpl.basePrompt}${extra}\n\n---\n${ctx}`;
  }

  async function callAiApi({ provider, apiKey, prompt }) {
    if (!apiKey || !apiKey.trim()) {
      throw new Error("Vui lòng nhập API Key trước khi chạy trực tiếp, hoặc dùng nút Copy Prompt ở bên dưới để dán sang Claude/ChatGPT/Gemini miễn phí.");
    }
    const key = apiKey.trim();

    if (provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || `Lỗi Gemini API (HTTP ${res.status})`);
      }
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini API không trả về nội dung văn bản.");
      return text;
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Bạn là chuyên gia phân tích tài chính doanh nghiệp (CFO/CFA), trả lời bằng tiếng Việt rõ ràng, định lượng." },
            { role: "user", content: prompt }
          ]
        })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || `Lỗi OpenAI API (HTTP ${res.status})`);
      }
      return json?.choices?.[0]?.message?.content || "Không nhận được phản hồi từ OpenAI.";
    }

    throw new Error("Nhà cung cấp AI chưa được hỗ trợ.");
  }

  return { TEMPLATES, buildDataContext, getContextualizedPrompt, callAiApi };
})();
