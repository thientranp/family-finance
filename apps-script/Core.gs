// Core.gs - schema, sheet access, validation, auth, lock, hashing.
// Paste order does not matter in Apps Script (all files share one global scope).
var FF_V = FF_V || {};
FF_V.Core = '0.3.0';

var FF_TZ = 'Asia/Ho_Chi_Minh';
var FF_MAX_AMOUNT = 9000000000000; // 9 trillion VND, far below 2^53
var FF_CTX = FF_CTX || { ss: null, cache: {}, asEmail: null, dryMail: false, mailLog: [] };

// Column definitions: name:type  (t = text, n = number). Dates are stored as text yyyy-MM-dd.
// Booleans are stored as numbers 1/0 to avoid spreadsheet coercion.
var FF_SCHEMA = {
  Members: 'member_id:t,display_name:t,email:t,active:n',
  Wallets: 'wallet_id:t,name:t,wallet_type:t,bank_name:t,owner_member_id:t,holder_name:t,opening_balance:n,opening_date:t,status:t',
  Jars: 'jar_id:t,name:t,sort_order:n,active:n',
  Categories: 'category_id:t,name:t,kind:t,jar_id:t,active:n',
  Budgets: 'period:t,jar_id:t,amount:n,created_at:t,created_by:t',
  BudgetMoves: 'move_id:t,period:t,from_jar:t,to_jar:t,amount:n,reason:t,created_by:t,created_at:t',
  Transactions: 'txn_id:t,txn_kind:t,txn_date:t,amount:n,category_id:t,jar_id:t,paid_by:t,beneficiary:t,note:t,reason:t,balance_before:n,balance_after:n,reverses_id:t,ref_id:t,idempotency_key:t,entry_count:n,created_by:t,created_at:t,prev_hash:t,row_hash:t',
  Entries: 'entry_id:t,txn_id:t,wallet_id:t,amount:n',
  Assets: 'asset_id:t,asset_type:t,name:t,purchase_value:n,purchase_date:t,note:t,active:n',
  Liabilities: 'liability_id:t,name:t,original_amount:n,opening_balance:n,opening_date:t,status:t,term_months:n',
  LiabilityEntries: 'entry_id:t,txn_id:t,liability_id:t,amount:n',
  // Lãi suất chỉ để theo dõi (không dùng trong bất kỳ phép tính nào) — mỗi dòng là mức lãi suất áp
  // dụng kể từ effective_date; "lãi suất hiện tại" = dòng có effective_date gần nhất không vượt quá
  // hôm nay. Tách sheet riêng (không phải 1 cột trên Liabilities) vì lãi suất có thể đổi nhiều lần.
  LiabilityRates: 'rate_id:t,liability_id:t,effective_date:t,rate_percent:n,note:t,created_at:t',
  // direction: 'lend' (gia đình cho người khác vay, người đó nợ gia đình) | 'borrow' (gia đình vay của người khác).
  // Không có cột số dư/opening_balance ở đây: số dư còn nợ luôn tính từ DebtEntries (bắt đầu từ 0, bắt đầu nợ thì đi kèm bút toán debt_lend/debt_borrow) để tránh ghi trùng và để đảo được bút toán một cách nhất quán.
  Debts: 'debt_id:t,direction:t,counterparty:t,original_amount:n,opening_date:t,note:t',
  DebtEntries: 'entry_id:t,txn_id:t,debt_id:t,amount:n',
  // Sổ vàng riêng (các lô mua/bán độc lập, KHÔNG dùng chung với asset_type='gold' của Assets).
  // quantity = số chỉ (cho phép số thập phân, không phải tiền nên không qua toNumber_).
  // purchase_value có thể = 0 (vàng được tặng/nhận từ đám cưới, không rõ giá) — khi đó KHÔNG có
  // giao dịch ví nào gắn với lô (xem createGoldLot_/svcGoldBuy_). Thông tin bán (giá/ngày) không lưu
  // ở đây — suy ra từ giao dịch gold_sale (ref_id=lot_id), giống cách Assets suy ra "đã bán".
  // source_ref: mã chống trùng khi nhập dữ liệu cũ từ Excel (vd "imp:gold:<ID cũ>"), rỗng với lô tạo
  // tay qua UI — dùng để importGoldLots_ chạy lại nhiều lần không bị nhân đôi.
  GoldLots: 'lot_id:t,brand:t,quantity:n,purchase_value:n,purchase_date:t,note:t,active:n,source_ref:t',
  // Sổ cưới — sổ lưu trữ thuần, KHÔNG tạo giao dịch thu nhập / không ảnh hưởng dòng tiền gia đình
  // (quyết định 07/11/2026). side: 'Anh'|'Em' (bên nào mời khách này). repaid = đã trả lễ lại (đáp
  // lễ) hay chưa — chỉ để đánh dấu, không có nghiệp vụ tài chính nào đi kèm.
  // source_ref: mã chống trùng khi nhập dữ liệu cũ từ Excel (vd "imp:wedding:<STT cũ>"), rỗng với
  // dòng tạo tay qua UI — dùng để importWeddingGifts_ chạy lại nhiều lần không bị nhân đôi.
  WeddingGifts: 'gift_id:t,wedding_date:t,side:t,guest_name:t,address:t,cash_amount:n,gold_amount:n,usd_amount:n,relationship:t,payment_method:t,repaid:n,note:t,active:n,source_ref:t',
  Reminders: 'reminder_id:t,type:t,title:t,day_of_month:n,days_before:n,ref_id:t,active:n',
  Notifications: 'key:t,created_at:t,to:t,subject:t,status:t,attempts:n,last_error:t',
  AuditLog: 'ts:t,actor:t,action:t,ref_id:t,details:t',
  Settings: 'key:t,value:t'
};

// Sheets that make up the immutable ledger (watched for manual edits).
var FF_LEDGER_SHEETS = ['Transactions', 'Entries', 'LiabilityEntries', 'DebtEntries', 'AuditLog'];

var FF_DEFAULT_SETTINGS = {
  env: 'DATA',
  schema_version: '1',
  cutoff_date: '2026-11-01',
  budget_warn_pct: '80',
  data_entry_days: '3',
  weekly_keep: '8',
  monthly_keep: '24'
};

// ---------- Errors ----------
function ffErr_(code, msg) {
  var e = new Error(msg);
  e.ffCode = code;
  return e;
}

// ---------- Schema helpers ----------
function schemaOf_(name) {
  var cache = FF_CTX.schemaCache || (FF_CTX.schemaCache = {});
  if (cache[name]) return cache[name];
  var spec = FF_SCHEMA[name];
  if (!spec) throw new Error('Unknown sheet ' + name);
  var cols = [], types = [];
  spec.split(',').forEach(function (p) {
    var kv = p.split(':');
    cols.push(kv[0]);
    types.push(kv[1]);
  });
  cache[name] = { cols: cols, types: types };
  return cache[name];
}

// ---------- Spreadsheet access ----------
function getSs_() {
  if (FF_CTX.ss) return FF_CTX.ss;
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (!id) throw ffErr_('CONFIG', 'Chưa cấu hình SS_ID trong Script Properties.');
  FF_CTX.ss = SpreadsheetApp.openById(id);
  return FF_CTX.ss;
}

function getSheet_(name) {
  var sh = getSs_().getSheetByName(name);
  if (!sh) throw ffErr_('SETUP', 'Thiếu sheet "' + name + '". Hãy chạy setupSpreadsheet().');
  return sh;
}

function invalidate_(name) {
  delete FF_CTX.cache[name];
}

function normText_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, FF_TZ, 'yyyy-MM-dd');
  return String(v);
}

function normNum_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

// Read all data rows of a sheet as objects (with _row = 1-based row number). Cached per execution.
function readAll_(name) {
  if (FF_CTX.cache[name]) return FF_CTX.cache[name];
  var sh = getSheet_(name);
  var def = schemaOf_(name);
  var last = sh.getLastRow();
  var rows = [];
  if (last > 1) {
    var vals = sh.getRange(2, 1, last - 1, def.cols.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      var empty = true;
      for (var c = 0; c < v.length; c++) { if (v[c] !== '' && v[c] !== null) { empty = false; break; } }
      if (empty) continue;
      var o = { _row: i + 2 };
      for (var j = 0; j < def.cols.length; j++) {
        o[def.cols[j]] = def.types[j] === 'n' ? normNum_(v[j]) : normText_(v[j]);
      }
      rows.push(o);
    }
  }
  FF_CTX.cache[name] = rows;
  return rows;
}

function toRowArray_(def, o) {
  return def.cols.map(function (c, i) {
    var v = o[c];
    if (v === null || v === undefined || v === '') return '';
    return def.types[i] === 'n' ? Number(v) : String(v);
  });
}

function appendRows_(name, objs) {
  if (!objs.length) return;
  var sh = getSheet_(name);
  var def = schemaOf_(name);
  var arr = objs.map(function (o) { return toRowArray_(def, o); });
  var start = sh.getLastRow() + 1;
  var need = start + arr.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 200);
  sh.getRange(start, 1, arr.length, def.cols.length).setValues(arr);
  invalidate_(name);
}

function updateRow_(name, rowNum, patch) {
  var sh = getSheet_(name);
  var def = schemaOf_(name);
  var cur = sh.getRange(rowNum, 1, 1, def.cols.length).getValues()[0];
  var o = {};
  def.cols.forEach(function (c, i) { o[c] = def.types[i] === 'n' ? normNum_(cur[i]) : normText_(cur[i]); });
  Object.keys(patch).forEach(function (k) { o[k] = patch[k]; });
  sh.getRange(rowNum, 1, 1, def.cols.length).setValues([toRowArray_(def, o)]);
  invalidate_(name);
}

// Hard-deletes a row. Reserved for reference rows that have never been referenced by any
// transaction (e.g. an asset/liability created by mistake, zero history) — financial history
// itself is never hard-deleted anywhere in this system (CLAUDE.md 2.3/15: prefer reversal/
// correction entries, never delete financial records). Callers must verify "no history" first.
function deleteRow_(name, rowNum) {
  getSheet_(name).deleteRow(rowNum);
  invalidate_(name);
}

// ---------- Time / validation ----------
function todayYmd_() { return Utilities.formatDate(new Date(), FF_TZ, 'yyyy-MM-dd'); }
function nowIso_() { return Utilities.formatDate(new Date(), FF_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }

function isYmd_(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  var dim = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dim;
}

function ymd_(v, label) {
  if (!isYmd_(v)) throw ffErr_('DATE', (label || 'Ngày') + ' không hợp lệ (cần dạng năm-tháng-ngày).');
  return v;
}

function isPeriod_(s) { return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }

function toNumber_(v, label) {
  // Strict on purpose: only real numbers or plain digit strings. Never guess at "1.5" or "1,000".
  if (typeof v === 'string') {
    v = v.trim();
    if (!/^-?\d+$/.test(v)) throw ffErr_('AMOUNT', (label || 'Số tiền') + ' phải là số nguyên đồng.');
  }
  if (v === '' || v === null || v === undefined) throw ffErr_('AMOUNT', (label || 'Số tiền') + ' không được để trống.');
  if (typeof v !== 'number' && typeof v !== 'string') throw ffErr_('AMOUNT', (label || 'Số tiền') + ' không hợp lệ.');
  var n = Number(v);
  if (!isFinite(n) || Math.floor(n) !== n || !Number.isSafeInteger(n)) {
    throw ffErr_('AMOUNT', (label || 'Số tiền') + ' phải là số nguyên đồng.');
  }
  return n;
}

// Positive integer amount.
function amount_(v, label) {
  var n = toNumber_(v, label);
  if (n <= 0) throw ffErr_('AMOUNT', (label || 'Số tiền') + ' phải lớn hơn 0.');
  if (n > FF_MAX_AMOUNT) throw ffErr_('AMOUNT', (label || 'Số tiền') + ' quá lớn.');
  return n;
}

// Signed integer (balances can be any integer).
function signed_(v, label) {
  var n = toNumber_(v, label);
  if (Math.abs(n) > FF_MAX_AMOUNT) throw ffErr_('AMOUNT', (label || 'Số tiền') + ' quá lớn.');
  return n;
}

// Decimal number within [0, max] — for values that are NOT money (e.g. lãi suất %), where
// toNumber_'s "integer đồng only" rule doesn't apply.
function pct_(v, label, max) {
  if (v === '' || v === null || v === undefined) throw ffErr_('AMOUNT', (label || 'Giá trị') + ' không được để trống.');
  var n = Number(v);
  if (!isFinite(n)) throw ffErr_('AMOUNT', (label || 'Giá trị') + ' không hợp lệ.');
  if (n < 0 || n > (max === undefined ? 100 : max)) throw ffErr_('AMOUNT', (label || 'Giá trị') + ' không hợp lệ.');
  return n;
}

// Decimal number > 0 — for non-money quantities (e.g. số chỉ vàng), where toNumber_'s
// "integer đồng only" rule doesn't apply and 0 is not a valid quantity (unlike pct_).
function qty_(v, label, max) {
  if (v === '' || v === null || v === undefined) throw ffErr_('AMOUNT', (label || 'Số lượng') + ' không được để trống.');
  var n = Number(v);
  if (!isFinite(n) || n <= 0 || n > (max === undefined ? 100000 : max)) throw ffErr_('AMOUNT', (label || 'Số lượng') + ' không hợp lệ.');
  return n;
}

function clip_(s, max) {
  s = (s === null || s === undefined) ? '' : String(s);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (s.length > (max || 500)) s = s.slice(0, max || 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // never let a note start like a formula
  return s;
}

function reqText_(s, label, min, max) {
  var t = clip_(s, max || 200);
  if (t.length < (min || 1)) throw ffErr_('TEXT', (label || 'Nội dung') + ' không được để trống.');
  return t;
}

// ---------- Ids / hashing ----------
function newId_(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 12); }

function nextCode_(sheetName, col, prefix, width) {
  var max = 0;
  readAll_(sheetName).forEach(function (r) {
    var m = String(r[col]).match(/(\d+)$/);
    if (m && +m[1] > max) max = +m[1];
  });
  var s = String(max + 1);
  while (s.length < width) s = '0' + s;
  return prefix + s;
}

function sha256Hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { b = b < 0 ? b + 256 : b; return ('0' + b.toString(16)).slice(-2); }).join('');
}

// ---------- Settings ----------
function getSetting_(key, dflt) {
  var rows = readAll_('Settings');
  for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i].value;
  return dflt === undefined ? (FF_DEFAULT_SETTINGS[key] || '') : dflt;
}

function setSetting_(key, value) {
  var rows = readAll_('Settings');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === key) { updateRow_('Settings', rows[i]._row, { value: String(value) }); return; }
  }
  appendRows_('Settings', [{ key: key, value: String(value) }]);
}

// ---------- Auth ----------
function currentEmail_() {
  var e = FF_CTX.asEmail;
  if (e === null || e === undefined) {
    try { e = Session.getActiveUser().getEmail(); } catch (x) { e = ''; }
  }
  return String(e || '').trim().toLowerCase();
}

// Returns the active member row for the signed-in Google account, or throws.
// opts.allowEmpty: allow when no member has an email yet (first-time setup by the owner).
function requireMember_(opts) {
  // Bootstrap case: brand-new spreadsheet, setupSpreadsheet() has not run yet, so the
  // Members sheet does not exist. Only allowed to pass through when allowEmpty is set.
  if (opts && opts.allowEmpty && !getSs_().getSheetByName('Members')) return null;
  var email = currentEmail_();
  var members = readAll_('Members');
  var withEmail = members.filter(function (m) { return m.email; });
  if (opts && opts.allowEmpty && withEmail.length === 0) return null;
  if (!email) throw ffErr_('AUTH', 'Không xác định được tài khoản Google. Hãy đăng nhập Google rồi mở lại.');
  for (var i = 0; i < members.length; i++) {
    if (members[i].active === 1 && members[i].email.toLowerCase() === email) return members[i];
  }
  throw ffErr_('AUTH', 'Tài khoản này chưa được cấp quyền sử dụng.');
}

function actorLabel_() { return currentEmail_() || 'system'; }

// ---------- Lock + audit ----------
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { throw ffErr_('BUSY', 'Hệ thống đang bận, hãy thử lại sau vài giây.'); }
  try {
    FF_CTX.cache = {};
    return fn();
  } finally {
    FF_CTX.cache = {};
    lock.releaseLock();
  }
}

function audit_(action, refId, details) {
  appendRows_('AuditLog', [{
    ts: nowIso_(), actor: actorLabel_(), action: action, ref_id: refId || '',
    details: details === null || details === undefined ? '' : (typeof details === 'string' ? details : JSON.stringify(details))
  }]);
}

// ---------- Mail (single place so tests can run without sending) ----------
function sendMail_(to, subject, body) {
  if (FF_CTX.dryMail) {
    if (FF_CTX.mailFail > 0) { FF_CTX.mailFail--; throw new Error('simulated mail failure'); }
    FF_CTX.mailLog.push({ to: to, subject: subject, body: body });
    return;
  }
  MailApp.sendEmail({ to: to, subject: subject, body: body, name: 'Family Finance' });
}

function showVersions() {
  var out = JSON.stringify(FF_V);
  Logger.log(out);
  return out;
}
