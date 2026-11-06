// Import.gs - one-time, repeatable import of the old AppSheet workbook (history only).
// How it works (see the deployment guide): upload Appsheet_Finance.xlsx to Google Drive, open it as a Google Sheet,
// copy its ID, run importPrepare('<ID>'), review/edit the ImportMap sheet, run importDryRun(), then importRun().
// Safe by design: the source is only read; every row has an idempotency key (imp:finance:<ID>, imp:change:<ID>),
// so re-running never duplicates; rows whose category needs a business decision stay blocked until you decide.
var FF_V = FF_V || {};
FF_V.Import = '0.3.0';

var FF_IMP_ACTIONS = ['expense', 'income', 'skip', 'review'];

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

// Final decisions for the 32 ambiguous category groups, confirmed by the user on 2026-11-06
// (reviewed from Ra_soat_giao_dich_chua_ro.xlsx: blank cells -> skip, classified where possible,
// otherwise skip; the user may adjust later directly in the ImportMap sheet before re-running).
var FF_IMPORT_DECISIONS = {
  'Chi|CT tower': { action: 'skip' },
  'Thu|Tiết kiệm': { action: 'skip' },
  'Thu|Gia đình': { action: 'skip' },
  'Chi|Chứng khoán': { action: 'skip' },
  'Thu|Chứng khoán': { action: 'skip' },
  'Chi|Ô tô': { action: 'skip' },
  'Thu|Thưởng': { action: 'income', target: 'Thu khác' },
  'Chi|Tiết kiệm': { action: 'skip' },
  'Chi|Điều chỉnh': { action: 'skip' },
  'Thu|Điều chỉnh': { action: 'skip' },
  'Thu|Cheppy': { action: 'income', target: 'Thu khác' },
  'Chi|Coin': { action: 'skip' },
  'Thu|Vending': { action: 'income', target: 'Thu nhập chung (Vending, Coin)' },
  'Chi|Vending': { action: 'skip' },
  'Thu|Khác': { action: 'income', target: 'Thu khác' },
  'Chi|Trả góp': { action: 'skip' },
  'Chi|Gia đình': { action: 'skip' },
  'Thu|Được tặng': { action: 'income', target: 'Thu khác' },
  'Chi|Em - Ba': { action: 'skip' },
  'Chi|Em - Mẹ': { action: 'skip' },
  'Thu|Cưới hỏi': { action: 'income', target: 'Thu khác' },
  'Thu|Kinh doanh': { action: 'income', target: 'Thu khác' },
  'Chi|Thuê xe': { action: 'expense', target: 'Di chuyển' },
  'Chi|Chi phí': { action: 'skip' },
  'Chi|Em - Hùng': { action: 'skip' },
  'Chi|Cho vay': { action: 'skip' },
  'Thu|Lì xì': { action: 'income', target: 'Thu khác' },
  'Thu|Họ hàng': { action: 'income', target: 'Thu khác' },
  'Thu|Mượn tiền': { action: 'skip' },
  'Chi|Ba - Điện': { action: 'expense', target: 'Hoá đơn điện' },
  'Chi|Phí thẻ': { action: 'expense', target: 'Phí chung cư' },
  'Thu|Tiền lãi': { action: 'income', target: 'Lãi tiết kiệm' }
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
  var wallets = {}, members = {};
  readAll_('Wallets').forEach(function (w) { wallets[impKey_(w.name)] = w.wallet_id; });
  readAll_('Members').forEach(function (x) { members[impKey_(x.display_name)] = x.member_id; });

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
    if (!mp || mp.action === 'review' || mp.action === '') { rep.finance.blocked++; rep.finance.blockedTotal += amt || 0; rep.blockedCats[kind + '|' + cat] = true; return; }
    if (mp.action === 'skip') { rep.finance.skipped++; rep.finance.skippedTotal += amt || 0; return; }
    if (FF_IMP_ACTIONS.indexOf(mp.action) < 0) { addErr('finance', 'Hành động không hợp lệ trong ImportMap: ' + mp.action, id, amt); return; }
    if (!id) { addErr('finance', 'Thiếu ID', r._n, amt); return; }
    var wid = wallets[impKey_(r['Ví'])], mid = members[impKey_(r['Sở hữu'])];
    if (!amt) { addErr('finance', 'Số tiền không hợp lệ', id, 0); return; }
    if (!wid) { addErr('finance', 'Ví không nhận diện được: ' + r['Ví'], id, amt); return; }
    var c = mp.target ? cats[(mp.action === 'expense' ? 'expense' : 'income') + '|' + impKey_(mp.target)] : null;
    if (mp.action === 'expense' && !c) { addErr('finance', 'Danh mục đích không tồn tại: ' + mp.target, id, amt); return; }
    if (mp.target && !c) { addErr('finance', 'Danh mục đích không tồn tại: ' + mp.target, id, amt); return; }
    var spec = { kind: mp.action, date: impDate_(r['Ngày']), amount: amt, wallet_id: wid, category_id: c ? c.category_id : '', note: String(r['Ghi chú'] || ''), key: 'imp:finance:' + id };
    if (mp.action === 'expense') { if (!mid) { addErr('finance', 'Người sở hữu không nhận diện được: ' + r['Sở hữu'], id, amt); return; } spec.paid_by = mid; }
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
