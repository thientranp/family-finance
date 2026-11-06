// Import.gs - one-time, repeatable import of the old AppSheet workbook (history only).
// How it works (see the deployment guide): upload Appsheet_Finance.xlsx to Google Drive, open it as a Google Sheet,
// copy its ID, run importPrepare('<ID>'), review/edit the ImportMap sheet, run importDryRun(), then importRun().
// Safe by design: the source is only read; every row has an idempotency key (imp:finance:<ID>, imp:change:<ID>),
// so re-running never duplicates; rows whose category needs a business decision stay blocked until you decide.
var FF_V = FF_V || {};
FF_V.Import = '0.3.0';

// 'split' is a sentinel: this category's rows don't share one decision — look up
// FF_IMPORT_ROW_OVERRIDES[id] instead (per-row, because the note text decides).
var FF_IMP_ACTIONS = ['expense', 'income', 'transfer', 'adjustment', 'asset_purchase', 'loan_payment', 'skip', 'review', 'split'];

function impSource_() {
  var id = FF_CTX.importSrc || PropertiesService.getScriptProperties().getProperty('IMPORT_SRC');
  if (!id) throw ffErr_('IMPORT', 'Chưa chọn file nguồn. Chạy importPrepare("ID_file_Google_Sheet") trước.');
  return SpreadsheetApp.openById(id);
}

function impTable_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) throw ffErr_('IMPORT', 'File nguồn thiếu sheet "' + name + '".');
  var last = sh.getLastRow();
  if (last < 2) return [];
  var width = 12;
  var vals = sh.getRange(1, 1, last, width).getValues();
  var head = vals[0].map(function (x) { return String(x).trim(); });
  var rows = [];
  for (var i = 1; i < vals.length; i++) {
    var o = { _n: i + 1 }, any = false;
    for (var j = 0; j < head.length; j++) { if (head[j]) { o[head[j]] = vals[i][j]; if (vals[i][j] !== '' && vals[i][j] !== null) any = true; } }
    if (any) rows.push(o);
  }
  return rows;
}

function impDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, FF_TZ, 'yyyy-MM-dd');
  var s = String(v).trim();
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return m[3] + '-' + pad2_(+m[2]) + '-' + pad2_(+m[1]);
  return s.slice(0, 10);
}
function impKey_(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

function impAmount_(v) {
  if (typeof v === 'number') return (Number.isSafeInteger(v) && v > 0) ? v : null;
  var d = String(v).replace(/[\s.,]/g, '');
  return /^\d+$/.test(d) && Number(d) > 0 ? Number(d) : null;
}

function impLoad_() {
  var ss = impSource_();
  return { fin: impTable_(ss, 'finance'), chg: impTable_(ss, 'change') };
}

// ---------- ImportMap (category decisions, editable by the user in the sheet) ----------
var FF_IMP_MAP_HEAD = ['source_kind', 'source_category', 'rows', 'total', 'action', 'target_category', 'note'];

function impMapSheet_() {
  var ss = getSs_();
  var sh = ss.getSheetByName('ImportMap');
  if (!sh) { sh = ss.insertSheet('ImportMap'); sh.getRange(1, 1, 1, FF_IMP_MAP_HEAD.length).setValues([FF_IMP_MAP_HEAD]); sh.setFrozenRows(1); }
  return sh;
}

function impCats_() {
  var byName = {};
  readAll_('Categories').forEach(function (c) { if (c.active === 1) byName[c.kind + '|' + impKey_(c.name)] = c; });
  return byName;
}

// Final decisions for the 32 ambiguous category groups.
// First pass confirmed by the user on 2026-11-06 (Ra_soat_giao_dich_chua_ro.xlsx: blank cells -> skip).
// Revised 2026-11-07 after re-checking every ambiguous group against the real source rows (see
// BUSINESS_RULES.md "Nhập dữ liệu lịch sử — các nhóm còn mơ hồ"): CT tower, Điều chỉnh, Tiết kiệm,
// Chứng khoán, Trả góp, Ô tô, Chi phí, Phí thẻ, Thuê xe, Vending all changed from "skip" to a real
// classification; Cho vay/Mượn tiền kept "skip" (85% of rows have no real amount, unrelated reason).
// 'Chi|Chứng khoán' and 'Chi|Ô tô' are 'split': each mixes several real natures (SSI/Entrade/Pinetree;
// down payment/loan installment/accessory) — resolved per-row via FF_IMPORT_ROW_OVERRIDES below.
// The user may still adjust any of this later directly in the ImportMap sheet before re-running.
var FF_IMPORT_DECISIONS = {
  'Chi|CT tower': { action: 'asset_purchase', target: 'Nhà - CT Tower' },
  'Thu|Tiết kiệm': { action: 'transfer', target: 'Tiết kiệm - Cục Cá' },
  'Thu|Gia đình': { action: 'skip' },
  'Chi|Chứng khoán': { action: 'split' },
  'Thu|Chứng khoán': { action: 'transfer', target: 'Pinetree - Chứng khoán' },
  'Chi|Ô tô': { action: 'split' },
  'Thu|Thưởng': { action: 'income', target: 'Thưởng' },
  'Chi|Tiết kiệm': { action: 'transfer', target: 'Tiết kiệm - Cục Cá' },
  'Chi|Điều chỉnh': { action: 'expense', target: 'Đối soát cũ (lịch sử) - thiếu hụt' },
  'Thu|Điều chỉnh': { action: 'income', target: 'Đối soát cũ (lịch sử) - phát sinh' },
  'Thu|Cheppy': { action: 'income', target: 'Thu khác' },
  'Chi|Coin': { action: 'skip' },
  'Thu|Vending': { action: 'income', target: 'Thu nhập Vending' },
  'Chi|Vending': { action: 'asset_purchase', target: 'Máy bán nước tự động' },
  'Thu|Khác': { action: 'income', target: 'Thu khác' },
  'Chi|Trả góp': { action: 'expense', target: 'Trả nợ vay cũ (đã tất toán)' },
  'Chi|Gia đình': { action: 'skip' },
  'Thu|Được tặng': { action: 'income', target: 'Thu khác' },
  'Chi|Em - Ba': { action: 'skip' },
  'Chi|Em - Mẹ': { action: 'skip' },
  'Thu|Cưới hỏi': { action: 'income', target: 'Thu khác' },
  'Thu|Kinh doanh': { action: 'income', target: 'Thu khác' },
  'Chi|Thuê xe': { action: 'expense', target: 'Xe và di chuyển' },
  'Chi|Chi phí': { action: 'split' },
  'Chi|Em - Hùng': { action: 'skip' },
  'Chi|Cho vay': { action: 'skip' },
  'Thu|Lì xì': { action: 'income', target: 'Thu khác' },
  'Thu|Họ hàng': { action: 'income', target: 'Thu khác' },
  'Thu|Mượn tiền': { action: 'skip' },
  'Chi|Ba - Điện': { action: 'expense', target: 'Hoá đơn điện' },
  'Chi|Phí thẻ': { action: 'expense', target: 'Phí ngân hàng & thẻ' },
  'Thu|Tiền lãi': { action: 'income', target: 'Lãi tiết kiệm' }
};

// Per-row overrides for the 3 'split' categories above (77 rows: 10 Ô tô + 27 Chứng khoán Chi + 40
// Chi phí — each category mixes several real natures that only the row's own note/amount decides).
// A row id with no entry here falls back to 'review'. Classified 2026-11-07 directly from
// Appsheet_Finance.xlsx / oto.xlsx, row by row — see
// BUSINESS_RULES.md for the full reasoning. 20 "no note, small recurring amount" Chi phí rows were
// classified as bank fees by matching their amount pattern against the explicit "Phí thẻ" rows
// (11000/14520/66000 repeating monthly/annually on the same wallets) — a judgment call, not a
// confirmed note; flagged in the report, free to recategorize by hand in ImportMap/ImportReport.
var FF_IMPORT_ROW_OVERRIDES = {
  // --- Ô tô (10 rows: 1 down payment + 4 loan installments found in `finance` + 5 accessories/misc;
  //     the other 18 real installments are in oto.xlsx only, not in `finance` at all — see
  //     importOtoInstallments() below) ---
  '03e96b40': { action: 'asset_purchase', target: 'Xe Cx3' },                      // 2025-01-22 190.000.000 "Cx3" (trả trước)
  '26eb66d0': { action: 'loan_payment', target: 'Vay mua xe Cx3' },               // 2025-01-28 7.000.000
  '0f2f6d72': { action: 'loan_payment', target: 'Vay mua xe Cx3' },               // 2025-02-21 6.000.000
  '4dfa205f': { action: 'loan_payment', target: 'Vay mua xe Cx3' },               // 2025-03-23 6.212.000
  'e8e02ee1': { action: 'loan_payment', target: 'Vay mua xe Cx3' },               // 2025-04-21 6.393.393
  '3d881642': { action: 'expense', target: 'Xe và di chuyển' },                   // vá lốp lưu động
  '76f9cd29': { action: 'expense', target: 'Xe và di chuyển' },                   // bơm điện xiaomi
  'da21c29a': { action: 'expense', target: 'Xe và di chuyển' },                   // gối dựa
  '4ac03191': { action: 'expense', target: 'Xe và di chuyển' },                   // bảng số điện thoại taplo
  '6138d113': { action: 'expense', target: 'Xe và di chuyển' },                   // cx3 rửa xe

  // --- Chứng khoán Chi (27 rows: SSI 16, Entrade 2, Pinetree 7 + 2 không ghi chú nhưng số tiền
  //     khớp chính xác với dòng Pinetree đã ghi chú gần đó) ---
  'a1172cdc': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '0ed8e665': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '44f5e928': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '7d743b55': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '29a3ef93': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '4c080e5b': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '42b499c7': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '81606969': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '54e1e3bd': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '163d20eb': { action: 'transfer', target: 'SSI - Chứng khoán' },
  'dc0c2fba': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '2e4d0b70': { action: 'transfer', target: 'SSI - Chứng khoán' },
  'c4f3822a': { action: 'transfer', target: 'SSI - Chứng khoán' },
  'dee7079f': { action: 'transfer', target: 'SSI - Chứng khoán' },
  'cd7e6383': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '277c4291': { action: 'transfer', target: 'SSI - Chứng khoán' },
  '7a4457b8': { action: 'transfer', target: 'Entrade - Chứng khoán' },
  '6d4d9d3e': { action: 'transfer', target: 'Entrade - Chứng khoán' },
  '08ff2197': { action: 'transfer', target: 'Pinetree - Chứng khoán' },
  'd67f1b01': { action: 'transfer', target: 'Pinetree - Chứng khoán' },
  'dbc15123': { action: 'transfer', target: 'Pinetree - Chứng khoán' },
  '6284377b': { action: 'transfer', target: 'Pinetree - Chứng khoán' },
  'acb8033e': { action: 'transfer', target: 'Pinetree - Chứng khoán' },
  '6e7d943d': { action: 'transfer', target: 'Pinetree - Chứng khoán' },
  '12532b63': { action: 'transfer', target: 'Pinetree - Chứng khoán' },
  '77bc4403': { action: 'transfer', target: 'Pinetree - Chứng khoán' },           // không ghi chú, 8.370.000 khớp đúng dòng 08ff2197
  'df2b1c39': { action: 'transfer', target: 'Pinetree - Chứng khoán' },           // không ghi chú, 50.000.000 khớp đúng dòng d67f1b01

  // --- Chi phí (40 rows: phí ngân hàng/thẻ, phí hành chính-giấy tờ, xe & di chuyển, 2 dòng tự ghi
  //     "điều chỉnh", còn lại 'review') ---
  'v37xb22g': { action: 'expense', target: 'Xe và di chuyển' },                   // khám sức khoẻ lái xe
  '9aac9305': { action: 'expense', target: 'Xe và di chuyển' },                   // sửa xe oto thuê
  'ce2e5f67': { action: 'expense', target: 'Xe và di chuyển' },                   // phí cầu đường
  'a438b779': { action: 'expense', target: 'Xe và di chuyển' },                   // phí cầu đường
  'fceef346': { action: 'expense', target: 'Xe và di chuyển' },                   // vetc
  'k15yr10l': { action: 'expense', target: 'Phí hành chính - giấy tờ' },          // chụp ảnh thẻ
  '39ce15c5': { action: 'expense', target: 'Phí hành chính - giấy tờ' },          // chụp ảnh thẻ
  '6d4920b2': { action: 'expense', target: 'Phí hành chính - giấy tờ' },          // phí hộ chiếu onl
  'bfddb9f0': { action: 'expense', target: 'Phí hành chính - giấy tờ' },          // công chứng
  '4aceaf28': { action: 'expense', target: 'Phí hành chính - giấy tờ' },          // công chứng
  '9c247ef2': { action: 'expense', target: 'Phí hành chính - giấy tờ' },          // hồ sơ khai sinh cheppy
  '42158623': { action: 'expense', target: 'Phí hành chính - giấy tờ' },          // phí làm sổ đỏ
  'a422f080': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // phí thường niên 2023
  'eef7b1df': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // card
  '4339cacf': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // phí thường niên 2023
  'b223856a': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // phí rút tiền
  '8efc5205': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // phí chuyển đổi
  '8d9c123a': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // phí hoàn tiền shopee
  '000dcc94': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // "Phí thẻ" (ghi chú gốc)
  '62317c3e': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 11.000 — suy theo mẫu Phí thẻ
  'fa808a33': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 14.520
  '77e3610b': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // "T06.2024", 14.520
  '4750c0b2': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // "T05.2024", 14.520
  'b9d69cef': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 66.000
  '12ab2470': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 14.520
  '48113a4d': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 14.520
  'a9655d40': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 11.000
  'e1763a58': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 11.000
  'bf148530': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 11.000
  '815c3f5d': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 158
  '7192d170': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 121.000
  '8289cbd7': { action: 'expense', target: 'Phí ngân hàng & thẻ' },               // không ghi chú, 14.520
  'a16ec2b8': { action: 'expense', target: 'Đối soát cũ (lịch sử) - thiếu hụt' }, // ghi chú gốc "điều chỉnh"
  '9a20f8f4': { action: 'expense', target: 'Đối soát cũ (lịch sử) - thiếu hụt' }, // ghi chú gốc "điều chỉnh"
  // 6 dòng còn lại: đã hỏi và được xác nhận trực tiếp (07/11/2026) — tất cả bỏ qua.
  'e11hq92j': { action: 'skip' },  // "Bỏ vô tiền vàng cho đủ 2.5 củ" — xác nhận: bỏ qua
  '588de776': { action: 'skip' },  // "Card Đt" — xác nhận: nạp tiền điện thoại, bỏ qua
  'e73505ef': { action: 'skip' },  // "Card Đt" — nt
  'b31412c6': { action: 'skip' },  // "Card Đt" — nt
  '162d640a': { action: 'skip' },  // "Card Đt" — nt
  'c887a440': { action: 'skip' }   // "Anh Thiện Típ" — xác nhận: bỏ qua
};

// Writes/refreshes ImportMap. Existing decisions (already in the sheet) are kept; new groups fall
// back to FF_IMPORT_DECISIONS, then to matching an existing category by name, then to "review".
function impPrepareMap_(fin) {
  var cats = impCats_(), agg = {};
  fin.forEach(function (r) {
    var kind = String(r['Loại']).trim(), cat = String(r['Mục']).trim();
    var k = kind + '|' + cat; var a = agg[k] = agg[k] || { kind: kind, cat: cat, rows: 0, total: 0 };
    var amt = impAmount_(r['Số tiền']); a.rows++; a.total += amt || 0;
  });
  var sh = impMapSheet_(), last = sh.getLastRow(), old = {};
  if (last > 1) sh.getRange(2, 1, last - 1, FF_IMP_MAP_HEAD.length).getValues().forEach(function (v) { old[v[0] + '|' + v[1]] = v; });
  var rows = Object.keys(agg).sort().map(function (k) {
    var a = agg[k], prev = old[k];
    var action = prev && prev[4] ? String(prev[4]) : '', target = prev && prev[5] ? String(prev[5]) : '', note = prev && prev[6] ? String(prev[6]) : '';
    if (!action) {
      var dec = FF_IMPORT_DECISIONS[k];
      if (dec) { action = dec.action; target = dec.target || ''; note = 'Theo quyết định 06/11/2026 (đã duyệt file rà soát). Có thể sửa lại.'; }
      else {
        var ck = (a.kind === 'Chi' ? 'expense' : 'income') + '|' + impKey_(a.cat);
        if (cats[ck]) { action = a.kind === 'Chi' ? 'expense' : 'income'; target = cats[ck].name; }
        else { action = 'review'; note = 'Cần bạn quyết định: chi tiêu thật, thu nhập thật, hay bỏ qua?'; }
      }
    }
    return [a.kind, a.cat, a.rows, a.total, action, target, note];
  });
  if (last > 1) sh.getRange(2, 1, last - 1, FF_IMP_MAP_HEAD.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, FF_IMP_MAP_HEAD.length).setValues(rows);
  return rows;
}

function impReadMap_() {
  var sh = impMapSheet_(), last = sh.getLastRow(), m = {};
  if (last > 1) sh.getRange(2, 1, last - 1, FF_IMP_MAP_HEAD.length).getValues().forEach(function (v) {
    m[String(v[0]) + '|' + String(v[1])] = { action: String(v[4]).trim().toLowerCase(), target: String(v[5]).trim() };
  });
  return m;
}

// ---------- planning ----------
// Returns the summary; when commit is true, writes up to `limit` new transactions.
function impPlan_(m, commit, limit) {
  var data = impLoad_();
  var map = impReadMap_(), cats = impCats_();
  var wallets = {}, members = {}, assets = {}, liabs = {};
  readAll_('Wallets').forEach(function (w) { wallets[impKey_(w.name)] = w.wallet_id; });
  readAll_('Members').forEach(function (x) { members[impKey_(x.display_name)] = x.member_id; });
  readAll_('Assets').forEach(function (a) { assets[impKey_(a.name)] = a.asset_id; });
  readAll_('Liabilities').forEach(function (l) { liabs[impKey_(l.name)] = l.liability_id; });

  var rep = {
    finance: { rows: 0, total: 0, imported: 0, importedTotal: 0, skipped: 0, skippedTotal: 0, errors: 0, errorTotal: 0, blocked: 0, blockedTotal: 0, pending: 0 },
    change: { rows: 0, total: 0, imported: 0, importedTotal: 0, errors: 0, errorTotal: 0, pending: 0 },
    errors: {}, blockedCats: {}, written: 0
  };
  function addErr(sheet, msg, id, amt) {
    var r = rep[sheet]; r.errors++; r.errorTotal += amt || 0;
    var e = rep.errors[msg] = rep.errors[msg] || { count: 0, sample: [] };
    e.count++; if (e.sample.length < 5) e.sample.push(sheet + ':' + id);
  }

  var items = [];
  data.fin.forEach(function (r) {
    var amt = impAmount_(r['Số tiền']), id = String(r['ID']).trim(), kind = String(r['Loại']).trim(), cat = String(r['Mục']).trim();
    rep.finance.rows++; rep.finance.total += amt || 0;
    if (Number(r['Số tiền']) === 0) { rep.finance.skipped++; rep.zero = (rep.zero || 0) + 1; return; } // 0 đ: không có tác động tài chính
    var mp = map[kind + '|' + cat];
    // 'split': this category mixes several real natures (vd "Chi phí" gồm cả phí ngân hàng lẫn phí
    // giấy tờ) — quyết định theo từng dòng (FF_IMPORT_ROW_OVERRIDES[id]), không theo cả nhóm.
    if (mp && mp.action === 'split') { mp = id && FF_IMPORT_ROW_OVERRIDES[id] ? FF_IMPORT_ROW_OVERRIDES[id] : { action: 'review' }; }
    if (!mp || mp.action === 'review' || mp.action === '') { rep.finance.blocked++; rep.finance.blockedTotal += amt || 0; rep.blockedCats[kind + '|' + cat] = true; return; }
    if (mp.action === 'skip') { rep.finance.skipped++; rep.finance.skippedTotal += amt || 0; return; }
    if (FF_IMP_ACTIONS.indexOf(mp.action) < 0 || mp.action === 'split') { addErr('finance', 'Hành động không hợp lệ trong ImportMap: ' + mp.action, id, amt); return; }
    if (!id) { addErr('finance', 'Thiếu ID', r._n, amt); return; }
    var wid = wallets[impKey_(r['Ví'])], mid = members[impKey_(r['Sở hữu'])];
    if (!amt) { addErr('finance', 'Số tiền không hợp lệ', id, 0); return; }
    if (!wid) { addErr('finance', 'Ví không nhận diện được: ' + r['Ví'], id, amt); return; }
    var note = String(r['Ghi chú'] || ''), spec = null;
    if (mp.action === 'expense' || mp.action === 'income') {
      var c = mp.target ? cats[mp.action + '|' + impKey_(mp.target)] : null;
      if (mp.target && !c) { addErr('finance', 'Danh mục đích không tồn tại: ' + mp.target, id, amt); return; }
      spec = { kind: mp.action, date: impDate_(r['Ngày']), amount: amt, wallet_id: wid, category_id: c ? c.category_id : '', note: note, key: 'imp:finance:' + id };
      if (mp.action === 'expense') { if (!mid) { addErr('finance', 'Người sở hữu không nhận diện được: ' + r['Sở hữu'], id, amt); return; } spec.paid_by = mid; }
    } else if (mp.action === 'transfer') {
      var tgtW = wallets[impKey_(mp.target)];
      if (!tgtW) { addErr('finance', 'Ví đích (transfer) không tồn tại: ' + mp.target, id, amt); return; }
      // Chi = tiền rời ví nguồn (Ví cột) vào ví đích (target); Thu = ngược lại.
      var fromW = kind === 'Chi' ? wid : tgtW, toW = kind === 'Chi' ? tgtW : wid;
      spec = { kind: 'transfer', date: impDate_(r['Ngày']), amount: amt, from_wallet: fromW, to_wallet: toW, key: 'imp:finance:' + id };
    } else if (mp.action === 'adjustment') {
      // actual_balance phụ thuộc số dư ví NGAY TRƯỚC thời điểm ghi (theo trình tự replay), nên chưa
      // tính được ở đây — spec.needsBalanceDelta được impPlan_ tính ngay trước khi gọi planPost_.
      spec = { kind: 'adjustment', date: impDate_(r['Ngày']), wallet_id: wid, reason: 'Nhập từ dữ liệu cũ — không rõ lý do gốc (ghi chú gốc: "' + (note || '(trống)') + '")', key: 'imp:finance:' + id, needsBalanceDelta: kind === 'Thu' ? amt : -amt };
    } else if (mp.action === 'asset_purchase') {
      var aid = assets[impKey_(mp.target)];
      if (!aid) { addErr('finance', 'Tài sản đích không tồn tại: ' + mp.target, id, amt); return; }
      spec = { kind: 'asset_purchase', date: impDate_(r['Ngày']), amount: amt, wallet_id: wid, asset_id: aid, note: note, key: 'imp:finance:' + id };
    } else if (mp.action === 'loan_payment') {
      var lid = liabs[impKey_(mp.target)];
      if (!lid) { addErr('finance', 'Khoản vay đích không tồn tại: ' + mp.target, id, amt); return; }
      spec = { kind: 'loan_payment', date: impDate_(r['Ngày']), amount: amt, wallet_id: wid, liability_id: lid, key: 'imp:finance:' + id };
    }
    items.push({ sheet: 'finance', id: id, amt: amt, date: spec.date, n: r._n, spec: spec });
  });
  data.chg.forEach(function (r) {
    var amt = impAmount_(r['Số tiền']), id = String(r['ID']).trim();
    rep.change.rows++; rep.change.total += amt || 0;
    if (!id) { addErr('change', 'Thiếu ID', r._n, amt); return; }
    if (!amt) { addErr('change', 'Số tiền không hợp lệ', id, 0); return; }
    var a = wallets[impKey_(r['Từ'])], b = wallets[impKey_(r['Đến'])];
    if (!a || !b) { addErr('change', 'Ví chuyển không nhận diện được: ' + r['Từ'] + ' → ' + r['Đến'], id, amt); return; }
    items.push({ sheet: 'change', id: id, amt: amt, date: impDate_(r['Ngày']), n: r._n, spec: { kind: 'transfer', date: impDate_(r['Ngày']), amount: amt, from_wallet: a, to_wallet: b, key: 'imp:change:' + id } });
  });
  items.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : (x.sheet === y.sheet ? x.n - y.n : (x.sheet < y.sheet ? -1 : 1)); });

  var st = buildState_(), plans = [], max = limit || 600;
  items.forEach(function (it) {
    var r = rep[it.sheet];
    try {
      // Số dư thực tế của 1 dòng "đối soát" phụ thuộc số dư NGAY TRƯỚC nó theo đúng trình tự replay
      // (st.walletBal đã được cập nhật tới đây), nên chỉ tính được tại thời điểm này, không tính trước.
      if (it.spec.kind === 'adjustment' && it.spec.needsBalanceDelta !== undefined) {
        var before = st.walletBal[it.spec.wallet_id] || 0;
        it.spec.actual_balance = before + it.spec.needsBalanceDelta;
      }
      var out = planPost_(st, m.member_id, it.spec);
      if (out.duplicate) { r.imported++; r.importedTotal += it.amt; return; }
      if (commit && plans.length >= max) { r.pending++; r.pendingTotal = (r.pendingTotal || 0) + it.amt; return; }
      plans.push(out.plan); r.imported++; r.importedTotal += it.amt; // "imported" includes planned in a dry run
    } catch (e) {
      if (e && e.ffCode) addErr(it.sheet, e.message, it.id, it.amt); else throw e;
    }
  });
  if (commit && plans.length) {
    commitPlans_(plans, 400);
    rep.written = plans.length;
    audit_('import:run', 'import', { written: plans.length });
  }
  return rep;
}

function impHasBlocked_(rep) { return Object.keys(rep.blockedCats).length > 0; }

function impText_(rep, title) {
  var f = rep.finance, c = rep.change, L = [];
  L.push(title);
  L.push('finance: nguồn ' + f.rows + ' dòng / ' + vnd_(f.total) + ' | nhập (hoặc sẽ nhập) ' + f.imported + ' / ' + vnd_(f.importedTotal) + ' | bỏ qua theo ImportMap ' + f.skipped + ' / ' + vnd_(f.skippedTotal) + ' | chưa quyết định ' + f.blocked + ' / ' + vnd_(f.blockedTotal) + ' | lỗi ' + f.errors + ' / ' + vnd_(f.errorTotal));
  L.push('change : nguồn ' + c.rows + ' dòng / ' + vnd_(c.total) + ' | nhập (hoặc sẽ nhập) ' + c.imported + ' / ' + vnd_(c.importedTotal) + ' | lỗi ' + c.errors);
  var okF = f.imported + f.pending + f.skipped + f.blocked + f.errors === f.rows && f.importedTotal + (f.pendingTotal || 0) + f.skippedTotal + f.blockedTotal + f.errorTotal === f.total;
  var okC = c.imported + c.pending + c.errors === c.rows && c.importedTotal + (c.pendingTotal || 0) + c.errorTotal === c.total;
  L.push('Đối chiếu số dòng và tổng tiền (finance): ' + (okF ? 'KHỚP' : 'LỆCH') + ' | (change): ' + (okC ? 'KHỚP' : 'LỆCH'));
  var bc = Object.keys(rep.blockedCats); if (bc.length) L.push('Danh mục còn "review" trong ImportMap (' + bc.length + '): ' + bc.join('; '));
  Object.keys(rep.errors).forEach(function (k) { L.push('LỖI x' + rep.errors[k].count + ': ' + k + ' (vd ' + rep.errors[k].sample.join(', ') + ')'); });
  if (rep.zero) L.push('Bỏ qua ' + rep.zero + ' dòng có số tiền 0 (không có tác động tài chính).');
  if (rep.written) L.push('Đã ghi lượt này: ' + rep.written + ' giao dịch.');
  if (f.pending + c.pending) L.push('CÒN ' + (f.pending + c.pending) + ' giao dịch chưa ghi. Chạy importRun() lần nữa.');
  return L.join('\n');
}

function impWriteReport_(text) {
  var ss = getSs_(), sh = ss.getSheetByName('ImportReport') || ss.insertSheet('ImportReport');
  var lines = text.split('\n'), last = sh.getLastRow();
  if (last > 0) sh.getRange(1, 1, last, 1).clearContent();
  if (sh.getMaxRows() < lines.length + 2) sh.insertRowsAfter(sh.getMaxRows(), lines.length + 2 - sh.getMaxRows());
  sh.getRange(1, 1, lines.length, 1).setNumberFormat('@').setValues(lines.map(function (x) { return [x]; }));
}

// ---------- entry points ----------
function importPrepare(sourceId) {
  var m = requireMember_();
  if (sourceId) PropertiesService.getScriptProperties().setProperty('IMPORT_SRC', String(sourceId));
  var data = impLoad_();
  var rows = impPrepareMap_(data.fin);
  var review = rows.filter(function (r) { return r[4] === 'review'; }).length;
  var msg = 'Đã đọc ' + data.fin.length + ' dòng finance, ' + data.chg.length + ' dòng change. Sheet "ImportMap" có ' + rows.length + ' nhóm danh mục, trong đó ' + review + ' nhóm cần bạn quyết định (cột action: expense / income / skip). Điền xong rồi chạy importDryRun().';
  Logger.log(msg);
  return msg;
}

function importDryRun() {
  var m = requireMember_();
  var rep = impPlan_(m, false);
  var text = impText_(rep, 'DRY RUN (chưa ghi gì) ' + nowIso_());
  impWriteReport_(text); Logger.log(text);
  return text;
}

function importRun(limit) {
  var m = requireMember_();
  var res = withLock_(function () {
    var pre = impPlan_(m, false);
    if (impHasBlocked_(pre)) throw ffErr_('IMPORT', 'Còn danh mục "review" trong ImportMap. Hãy quyết định hết rồi chạy lại.');
    if (pre.finance.errors + pre.change.errors > 0) throw ffErr_('IMPORT', 'Còn dòng lỗi (xem importDryRun). Sửa nguồn/ImportMap rồi chạy lại.');
    FF_CTX.cache = {};
    return impPlan_(m, true, Number(limit) || 600);
  });
  var text = impText_(res, 'IMPORT ' + nowIso_());
  impWriteReport_(text); Logger.log(text);
  return text;
}

function importDryRun_(m, p) { return { text: impText_(impPlan_(m, false), 'DRY RUN') }; }
function importRun_(m, p) { return { text: importRun(p && p.limit) }; }

// ---------- one-off: car-loan installments that exist only in oto.xlsx, not in the `finance` sheet ----------
// 18 real installments on "Vay mua xe Cx3" (2025-05-22 .. 2026-10-25) were never recorded in the old
// AppSheet system at all — the finance sheet only has the down payment + first 4 installments
// (handled above via FF_IMPORT_ROW_OVERRIDES). Confirmed 2026-11-07: all paid from "Vietinbank - Cục
// Thịt". Run importOtoInstallmentsDryRun() first, then importOtoInstallments() once the liability
// "Vay mua xe Cx3" exists. Idempotency key imp:oto:<date> makes re-running safe.
var FF_OTO_INSTALLMENTS = [
  ['2025-05-22', 6400000], ['2025-06-25', 6274766], ['2025-07-25', 6285305], ['2025-08-24', 6314839],
  ['2025-09-25', 6294217], ['2025-10-23', 6322464], ['2025-11-25', 6158468], ['2025-12-22', 6200000],
  ['2026-01-23', 6396298], ['2026-02-20', 6285612], ['2026-03-23', 5448000], ['2026-04-23', 6700000],
  ['2026-05-21', 6300000], ['2026-06-23', 6325000], ['2026-07-24', 6462678], ['2026-08-24', 6282583],
  ['2026-09-22', 6400000], ['2026-10-25', 6297000]
];
var FF_OTO_WALLET = 'Vietinbank - Cục Thịt', FF_OTO_LIABILITY = 'Vay mua xe Cx3';

function impOtoPlan_(m, commit) {
  var wid = null, lid = null;
  readAll_('Wallets').forEach(function (w) { if (impKey_(w.name) === impKey_(FF_OTO_WALLET)) wid = w.wallet_id; });
  readAll_('Liabilities').forEach(function (l) { if (impKey_(l.name) === impKey_(FF_OTO_LIABILITY)) lid = l.liability_id; });
  if (!wid) throw ffErr_('IMPORT', 'Chưa có ví "' + FF_OTO_WALLET + '". Tạo ví này trước.');
  if (!lid) throw ffErr_('IMPORT', 'Chưa có khoản vay "' + FF_OTO_LIABILITY + '". Tạo khoản vay này trước.');
  var st = buildState_(), plans = [], errors = [], imported = 0, importedTotal = 0;
  FF_OTO_INSTALLMENTS.forEach(function (row) {
    var date = row[0], amt = row[1], key = 'imp:oto:' + date;
    try {
      var out = planPost_(st, m.member_id, { kind: 'loan_payment', date: date, amount: amt, wallet_id: wid, liability_id: lid, key: key });
      if (out.duplicate) { imported++; importedTotal += amt; return; }
      plans.push(out.plan); imported++; importedTotal += amt;
    } catch (e) {
      if (e && e.ffCode) errors.push(date + ': ' + e.message); else throw e;
    }
  });
  if (commit && plans.length) { commitPlans_(plans, 100); audit_('import:oto', 'import', { written: plans.length }); }
  var L = ['nguồn 18 kỳ / ' + vnd_(FF_OTO_INSTALLMENTS.reduce(function (s, r) { return s + r[1]; }, 0)),
    'nhập (hoặc sẽ nhập) ' + imported + ' / ' + vnd_(importedTotal) + ' | lỗi ' + errors.length];
  errors.forEach(function (e) { L.push('LỖI: ' + e); });
  if (commit) L.push('Đã ghi: ' + plans.length + ' giao dịch.');
  return L.join('\n');
}

function importOtoInstallmentsDryRun() {
  var m = requireMember_();
  var text = 'DRY RUN kỳ trả góp xe (oto.xlsx) ' + nowIso_() + '\n' + impOtoPlan_(m, false);
  Logger.log(text); return text;
}

function importOtoInstallments() {
  var m = requireMember_();
  var text = withLock_(function () { return 'IMPORT kỳ trả góp xe (oto.xlsx) ' + nowIso_() + '\n' + impOtoPlan_(m, true); });
  Logger.log(text); return text;
}
