// Dữ liệu mẫu BCTC (Đơn vị: Tỷ đồng)
window.BCTC_SAMPLES = {
  sample_5y: {
    companyName: "CTCP Sản Xuất & Thương Mại Minh Khôi (Mẫu 5 năm)",
    unit: "tỷ đồng",
    periods: ["2022", "2023", "2024", "2025", "2026"],
    budgetLatest: {
      revenue: 2550,
      grossProfit: 710,
      ebitda: 390,
      ebt: 270,
      netProfit: 216,
      ocf: 240
    },
    // Kết quả kinh doanh (Income Statement)
    is: {
      revenue:          [1650, 1890, 2120, 2310, 2480], // Doanh thu thuần
      cogs:             [1122, 1304, 1505, 1686, 1860], // Giá vốn hàng bán (biên gộp tụt dần)
      sga:              [230,  265,  305,  345,  395],  // CP Bán hàng & QLDN (tăng nhanh)
      depreciation:     [62,   68,   74,   82,   88],   // Khấu hao (nằm trong GV/CPHD, tách riêng để tính EBITDA)
      finIncome:        [18,   22,   19,   24,   21],   // Thu nhập tài chính
      interestExpense:  [34,   42,   55,   71,   89],   // Chi phí lãi vay
      otherProfit:      [5,    4,    2,    -5,   -8],   // Lợi nhuận khác
      taxExpense:       [57,   61,   55,   45,   30]    // Thuế TNDN
    },
    // Bảng cân đối kế toán (Balance Sheet)
    bs: {
      cash:             [210,  195,  160,  135,  112],  // Tiền & tương đương tiền
      receivables:      [245,  298,  375,  465,  590],  // Phải thu ngắn hạn (tăng nhanh hơn DT)
      inventory:        [280,  340,  430,  540,  695],  // Hàng tồn kho (tăng cao)
      otherCurrent:     [45,   52,   58,   65,   72],   // Tài sản ngắn hạn khác
      fixedAssets:      [680,  745,  820,  910,  985],  // Tài sản cố định
      longTermInvest:   [110,  120,  135,  150,  160],  // Đầu tư tài chính dài hạn / Công ty con
      otherNonCurrent:  [50,   55,   62,   70,   76],   // Tài sản dài hạn khác
      shortTermDebt:    [180,  230,  310,  415,  540],  // Vay & nợ thuê TC ngắn hạn
      payables:         [260,  295,  330,  370,  410],  // Phải trả người bán & nợ ngắn hạn khác
      longTermDebt:     [240,  280,  345,  420,  495],  // Vay & nợ dài hạn
      equity:           [940,  1000, 1055, 1130, 1245]  // Vốn chủ sở hữu
    },
    // Lưu chuyển tiền tệ (Cash Flow)
    cf: {
      ocf:              [265,  230,  185,  110,  42],   // Dòng tiền kinh doanh (giảm mạnh do tồn kho/công nợ)
      icf:              [-140, -165, -180, -195, -175], // Dòng tiền đầu tư
      fcfFin:           [-90,  -80,  -40,  60,   110],  // Dòng tiền tài chính
      capex:            [125,  145,  160,  170,  155]   // Chi mua sắm TSCĐ (CAPEX)
    }
  },

  sample_q1_2026: {
    companyName: "Doanh nghiệp Minh họa BCTC Riêng (Case Q1/2026)",
    unit: "tỷ đồng",
    periods: ["Q1/2025", "Q1/2026"],
    budgetLatest: {
      revenue: 4200,
      grossProfit: 920,
      ebitda: 550,
      ebt: 2100,
      netProfit: 1750,
      ocf: 300
    },
    is: {
      revenue:          [4100, 3690], // Giảm 10% YoY
      cogs:             [3150, 2915],
      sga:              [420,  435],
      depreciation:     [120,  125],
      finIncome:        [450,  1948], // Thu nhập tài chính đột biến +1.948 tỷ
      interestExpense:  [140,  165],
      otherProfit:      [15,   12],
      taxExpense:       [171,  307]
    },
    bs: {
      cash:             [1850, 2120],
      receivables:      [3100, 3650],
      inventory:        [2400, 2890],
      otherCurrent:     [620,  686],
      fixedAssets:      [4100, 4050],
      longTermInvest:   [18200, 19072], // Đầu tư vào công ty con 19.072 tỷ
      otherNonCurrent:  [580,  600],
      shortTermDebt:    [2100, 2450],
      payables:         [2350, 2608],
      longTermDebt:     [2650, 2700], // Tổng nợ phải trả = 7.758 tỷ
      equity:           [23750, 25310] // Vốn chủ sở hữu = 25.310 tỷ (Tổng TS = 33.068 tỷ)
    },
    cf: {
      ocf:              [315,  -402], // Dòng tiền kinh doanh -402 tỷ
      icf:              [-480, 2381], // Dòng tiền đầu tư +2.381 tỷ
      fcfFin:           [210,  -1709],
      capex:            [240,  180]
    }
  }
};

window.LEARNING_MODULES = [
  {
    tag: "Module 1",
    title: "Nền tảng BCTC & Bảng cân đối kế toán",
    desc: "Hiểu tài sản, nguồn vốn và vốn lưu động đang nói gì về cấu trúc tài chính. Nhìn ra doanh nghiệp đang sống bằng vốn tự có hay bằng nợ.",
    bullets: [
      "Phương trình cốt lõi: Tổng Tài sản = Nợ phải trả + Vốn chủ sở hữu.",
      "Vốn lưu động ròng (NWC) = Tài sản ngắn hạn − Nợ ngắn hạn. NWC âm kéo dài báo hiệu áp lực thanh khoản.",
      "Kiểm tra tỷ trọng Phải thu & Tồn kho trong Tổng tài sản để tránh 'tài sản ảo' hoặc hàng tồn chậm luân chuyển."
    ]
  },
  {
    tag: "Module 2",
    title: "Báo cáo KQKD & Lưu chuyển tiền tệ",
    desc: "Bóc tách Gross Profit, EBITDA, NPAT để biết khoản mục nào đang ăn vào lợi nhuận. So sánh lợi nhuận trên giấy với tiền thật về tài khoản.",
    bullets: [
      "Biên gộp (Gross Margin) phản ánh sức mạnh sản phẩm và kiểm soát giá vốn.",
      "EBITDA cho thấy dòng tiền tạo ra từ hoạt động cốt lõi trước lãi vay, thuế và khấu hao.",
      "Quy tắc vàng: So sánh LNST với Dòng tiền kinh doanh (OCF). Nếu lãi lớn nhưng OCF âm nhiều kỳ -> kiểm tra ngay công nợ & thu nhập tài chính bất thường."
    ]
  },
  {
    tag: "Module 3",
    title: "Hệ thống Chỉ số Tài chính",
    desc: "Tính và diễn giải 4 nhóm chỉ số: Thanh toán, Hiệu quả hoạt động, Đòn bẩy, Sinh lời — đặt trong đúng bối cảnh ngành thay vì chỉ thuộc công thức.",
    bullets: [
      "Thanh toán: Current Ratio (>1.2–1.5 an toàn), Quick Ratio (>1.0).",
      "Đòn bẩy: D/E (Nợ/VCSH). Sản xuất thường <1.5; cần đối chiếu với khả năng trả lãi (ICR).",
      "Sinh lời: ROE > 15% là tốt, nhưng phải kiểm tra xem ROE cao do biên lợi nhuận tốt hay do vay nợ quá nhiều (phân tích DuPont)."
    ]
  },
  {
    tag: "Module 4",
    title: "Thực hành phân tích BCTC thực tế",
    desc: "Quy trình 5 bước cầm một bộ BCTC thật, tự đọc từ đầu đến cuối và đề xuất hành động quản trị.",
    bullets: [
      "Bước 1: Đọc xu hướng 3–5 năm (Doanh thu, Biên gộp, LNST, OCF).",
      "Bước 2: Phân tích dọc (cơ cấu chi phí/tài sản) & Phân tích ngang (% biến động YoY).",
      "Bước 3: Quét Red Flags (tồn kho, phải thu, nợ ngắn hạn, chi phí bất thường).",
      "Bước 4: So sánh đối thủ cùng ngành & Định giá nhanh (DCF, P/E, EV/EBITDA)."
    ]
  },
  {
    tag: "Module 5",
    title: "Ứng dụng AI & Checklist kiểm chứng kết quả",
    desc: "Dùng AI tăng tốc từ 2–3 giờ xuống 15 phút, nhưng luôn biết con số nào hợp lý và câu hỏi tiếp theo cần đặt.",
    bullets: [
      "Luôn cấp cho AI số liệu sạch có cấu trúc (dùng nút Copy bản đã ghép số liệu ở tab Trợ lý AI).",
      "Kiểm tra chéo 3 điểm AI dễ nhầm: đơn vị tính (tỷ/triệu), dấu âm dương của dòng tiền, và công thức mẫu số (bình quân hay cuối kỳ).",
      "Hỏi đào sâu theo chuỗi 'Tại sao?': Doanh thu tăng nhưng LNTT giảm -> do giá vốn, chi phí bán hàng hay lãi vay?"
    ]
  }
];
