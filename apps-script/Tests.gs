// Tests.gs - automated tests. Run runAllTests() from the Apps Script editor.
// Safe by design: it creates a TEMPORARY spreadsheet (and temporary Drive folder), never touches the real data,
// sends no real email, and trashes everything at the end. Uses synthetic numbers only.
var FF_V = FF_V || {};
FF_V.Tests = '0.3.0';

var FF_TESTS = [];
function test_(name, fn) { FF_TESTS.push({ name: name, fn: fn }); }

function eq_(actual, expected, msg) {
  if (actual !== expected) throw new Error((msg || 'eq') + ': expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
}
function ok_(cond, msg) { if (!cond) throw new Error('ASSERT: ' + msg); }
function throws_(fn, code, msg) {
  try { fn(); } catch (e) {
    if (e && e.ffCode === code) return;
    throw new Error((msg || 'throws') + ': expected error ' + code + ' but got ' + (e && (e.ffCode || e.message)));
  }
  throw new Error((msg || 'throws') + ': expected error ' + code + ' but nothing was thrown');
}

var T_EMAIL_1 = 'thit@test.local', T_EMAIL_2 = 'ca@test.local';

function asUser_(email) { FF_CTX.asEmail = email; FF_CTX.cache = {}; return requireMember_(); }
function bal_(wid) { return walletBalances_()[wid]; }
function jarSpent_(jar, period) { var tx = readAll_('Transactions'); return spentByJar_(period, tx, txnMap_(tx))[jar] || 0; }
function flow_(period) { var tx = readAll_('Transactions'); return cashFlow_(period, tx, txnMap_(tx)); }
function lastTxn_() { var t = readAll_('Transactions'); return t[t.length - 1]; }

var T_D = '2026-11-02'; // fixed test date

// ---------- environment ----------
function testEnvBegin_() {
  var saved = { ss: FF_CTX.ss, asEmail: FF_CTX.asEmail, dryMail: FF_CTX.dryMail, mailLog: FF_CTX.mailLog, backupRootName: FF_CTX.backupRootName, cache: FF_CTX.cache };
  var ss = SpreadsheetApp.create('FF_TEST_' + Utilities.getUuid().slice(0, 6));
  FF_CTX.ss = ss; FF_CTX.cache = {}; FF_CTX.dryMail = true; FF_CTX.mailLog = []; FF_CTX.mailFail = 0;
  FF_CTX.backupRootName = 'FF_TEST_BACKUP_' + Utilities.getUuid().slice(0, 6);
  FF_CTX.asEmail = null;
  setupCore_(ss);
  var ms = readAll_('Members');
  updateRow_('Members', ms[0]._row, { email: T_EMAIL_1 });
  updateRow_('Members', ms[1]._row, { email: T_EMAIL_2 });
  readAll_('Wallets').forEach(function (w) { updateRow_('Wallets', w._row, { opening_date: '2000-01-01' }); });
  asUser_(T_EMAIL_1);
  return saved;
}

function testEnvEnd_(saved) {
  try { DriveApp.getFileById(FF_CTX.ss.getId()).setTrashed(true); } catch (e) { /* ignore */ }
  try { var it = DriveApp.getFoldersByName(FF_CTX.backupRootName); while (it.hasNext()) it.next().setTrashed(true); } catch (e) { /* ignore */ }
  FF_CTX.ss = saved.ss; FF_CTX.asEmail = saved.asEmail; FF_CTX.dryMail = saved.dryMail; FF_CTX.mailLog = saved.mailLog;
  FF_CTX.backupRootName = saved.backupRootName; FF_CTX.cache = saved.cache || {};
}

function inc_(m, w, amt, extra) { return postOne_(m, Object.assign({ kind: 'income', date: T_D, amount: amt, wallet_id: w }, extra || {})); }
function exp_(m, w, amt, jar, extra) { return postOne_(m, Object.assign({ kind: 'expense', date: T_D, amount: amt, wallet_id: w, jar_id: jar, paid_by: m.member_id }, extra || {})); }

// ---------- tests ----------
test_('Thu nhập tăng đúng ví', function () {
  var m = asUser_(T_EMAIL_1);
  inc_(m, 'W001', 5000000);
  eq_(bal_('W001'), 5000000, 'W001');
  eq_(bal_('W002'), 0, 'ví khác không đổi');
});

test_('Chi tiêu giảm ví, bắt buộc có lọ và người chi', function () {
  var m = asUser_(T_EMAIL_1);
  throws_(function () { postOne_(m, { kind: 'expense', date: T_D, amount: 1000, wallet_id: 'W001', paid_by: m.member_id }); }, 'JAR', 'thiếu lọ');
  throws_(function () { postOne_(m, { kind: 'expense', date: T_D, amount: 1000, wallet_id: 'W001', jar_id: 'J1' }); }, 'MEMBER', 'thiếu người chi');
  exp_(m, 'W001', 300000, 'J1');
  eq_(bal_('W001'), 4700000, 'W001 sau chi');
});

test_('Danh mục phải khớp lọ; lọ suy ra từ danh mục', function () {
  var m = asUser_(T_EMAIL_1);
  var cats = readAll_('Categories');
  var cat = cats.filter(function (c) { return c.name === 'Xăng dầu'; })[0]; // thuộc J3
  postOne_(m, { kind: 'expense', date: T_D, amount: 100000, wallet_id: 'W001', category_id: cat.category_id, paid_by: m.member_id });
  eq_(lastTxn_().jar_id, 'J3', 'lọ suy ra');
  throws_(function () { postOne_(m, { kind: 'expense', date: T_D, amount: 100000, wallet_id: 'W001', category_id: cat.category_id, jar_id: 'J1', paid_by: m.member_id }); }, 'JAR', 'danh mục sai lọ');
  var incomeCat = cats.filter(function (c) { return c.kind === 'income'; })[0];
  throws_(function () { postOne_(m, { kind: 'expense', date: T_D, amount: 1, wallet_id: 'W001', category_id: incomeCat.category_id, jar_id: 'J1', paid_by: m.member_id }); }, 'CATEGORY', 'danh mục thu dùng cho chi');
});

test_('Chuyển ví nguyên tử, tổng không đổi, không tính thu chi', function () {
  var m = asUser_(T_EMAIL_1);
  inc_(m, 'W005', 10000000);
  var before = bal_('W005') + bal_('W001');
  var f0 = flow_('2026-11');
  postOne_(m, { kind: 'transfer', date: T_D, amount: 1000000, from_wallet: 'W005', to_wallet: 'W001' });
  eq_(bal_('W005') + bal_('W001'), before, 'tổng hai ví');
  eq_(bal_('W005'), 9000000, 'nguồn');
  var f1 = flow_('2026-11');
  eq_(f1.income, f0.income, 'thu không đổi');
  eq_(f1.expense, f0.expense, 'chi không đổi');
  eq_(lastTxn_().entry_count, 2, 'hai dòng sổ cái');
});

test_('Chuyển ví: cùng ví, ví đóng, ví không tồn tại bị từ chối', function () {
  var m = asUser_(T_EMAIL_1);
  throws_(function () { postOne_(m, { kind: 'transfer', date: T_D, amount: 100, from_wallet: 'W001', to_wallet: 'W001' }); }, 'WALLET', 'cùng ví');
  throws_(function () { postOne_(m, { kind: 'transfer', date: T_D, amount: 100, from_wallet: 'W001', to_wallet: 'W999' }); }, 'WALLET', 'ví không tồn tại');
  throws_(function () { inc_(m, 'W008', 100); }, 'WALLET', 'ví Beo đã đóng');
});

test_('Chống ghi trùng bằng mã idempotency', function () {
  var m = asUser_(T_EMAIL_1);
  var b0 = bal_('W002');
  var a = inc_(m, 'W002', 777000, { key: 'k-dup-1' });
  var b = inc_(m, 'W002', 777000, { key: 'k-dup-1' });
  eq_(a.duplicate, false, 'lần 1'); eq_(b.duplicate, true, 'lần 2'); eq_(a.txn_id, b.txn_id, 'cùng giao dịch');
  eq_(bal_('W002'), b0 + 777000, 'chỉ cộng một lần');
});

test_('Số tiền không hợp lệ bị từ chối', function () {
  var m = asUser_(T_EMAIL_1);
  [0, -5, 1.5, 'abc', '', null, '1.5', '1,000', 9e15, NaN, {}].forEach(function (bad) {
    throws_(function () { inc_(m, 'W001', bad); }, 'AMOUNT', 'số tiền ' + JSON.stringify(bad));
  });
  var b0 = bal_('W001');
  inc_(m, 'W001', '2500'); // chuỗi toàn chữ số được chấp nhận
  eq_(bal_('W001'), b0 + 2500, 'chuỗi số');
});

test_('Ngày không hợp lệ bị từ chối', function () {
  var m = asUser_(T_EMAIL_1);
  ['2026-13-01', '2026-02-30', '26-11-02', '', null, '2026/11/02'].forEach(function (bad) {
    throws_(function () { inc_(m, 'W001', 100, { date: bad }); }, 'DATE', 'ngày ' + bad);
  });
});

test_('Điều chỉnh số dư: âm, dương, lý do, ghi số trước/sau', function () {
  var m = asUser_(T_EMAIL_1);
  var cur = bal_('W006');
  postOne_(m, { kind: 'adjustment', date: T_D, wallet_id: 'W006', actual_balance: cur + 500000, reason: 'Đối soát dương' });
  eq_(bal_('W006'), cur + 500000, 'dương');
  var t = lastTxn_();
  eq_(t.balance_before, cur, 'trước'); eq_(t.balance_after, cur + 500000, 'sau'); eq_(t.reason, 'Đối soát dương', 'lý do');
  postOne_(m, { kind: 'adjustment', date: T_D, wallet_id: 'W006', actual_balance: cur - 200000, reason: 'Đối soát âm' });
  eq_(bal_('W006'), cur - 200000, 'âm');
  throws_(function () { postOne_(m, { kind: 'adjustment', date: T_D, wallet_id: 'W006', actual_balance: 1, reason: '  ' }); }, 'TEXT', 'thiếu lý do');
  throws_(function () { postOne_(m, { kind: 'adjustment', date: T_D, wallet_id: 'W006', actual_balance: cur - 200000, reason: 'không đổi' }); }, 'ADJ0', 'không chênh lệch');
  var f = flow_('2026-11');
  ok_(f.adjustments_up >= 500000 && f.adjustments_down >= 200000, 'điều chỉnh tách riêng khỏi thu chi');
});

test_('Điều chỉnh không bị tính là thu hay chi', function () {
  var m = asUser_(T_EMAIL_1);
  var f0 = flow_('2026-11');
  postOne_(m, { kind: 'adjustment', date: T_D, wallet_id: 'W007', actual_balance: 123456, reason: 'Thử' });
  var f1 = flow_('2026-11');
  eq_(f1.income, f0.income, 'thu'); eq_(f1.expense, f0.expense, 'chi');
});

test_('Bút toán đảo: trả lại số dư, giữ giao dịch gốc, không đảo hai lần', function () {
  var m = asUser_(T_EMAIL_1);
  inc_(m, 'W003', 1000000);
  var b0 = bal_('W003');
  var e = exp_(m, 'W003', 400000, 'J2', { key: 'rev-src' });
  eq_(bal_('W003'), b0 - 400000, 'sau chi');
  var spent0 = jarSpent_('J2', '2026-11');
  var r = postOne_(m, { kind: 'reversal', date: todayYmd_(), txn_id: e.txn_id, reason: 'Nhập nhầm' });
  eq_(bal_('W003'), b0, 'sau đảo');
  eq_(jarSpent_('J2', '2026-11'), spent0 - 400000, 'chi lọ giảm đúng');
  ok_(readAll_('Transactions').some(function (t) { return t.txn_id === e.txn_id; }), 'giao dịch gốc còn');
  throws_(function () { postOne_(m, { kind: 'reversal', date: T_D, txn_id: e.txn_id, reason: 'Đảo lần 2' }); }, 'REV', 'đảo lần 2');
  throws_(function () { postOne_(m, { kind: 'reversal', date: T_D, txn_id: r.txn_id, reason: 'Đảo bút toán đảo' }); }, 'REV', 'đảo bút toán đảo');
  throws_(function () { postOne_(m, { kind: 'reversal', date: T_D, txn_id: 'T-khong-co', reason: 'x y z' }); }, 'REV', 'không có gốc');
  throws_(function () { postOne_(m, { kind: 'reversal', date: T_D, txn_id: e.txn_id, reason: '' }); }, 'REV', 'đã đảo, kiểm tra trước lý do');
});

test_('Đảo chuyển ví và thu nhập', function () {
  var m = asUser_(T_EMAIL_1);
  inc_(m, 'W004', 900000);
  var b4 = bal_('W004'), b3 = bal_('W003');
  var tr = postOne_(m, { kind: 'transfer', date: T_D, amount: 300000, from_wallet: 'W004', to_wallet: 'W003' });
  postOne_(m, { kind: 'reversal', date: T_D, txn_id: tr.txn_id, reason: 'Chuyển nhầm' });
  eq_(bal_('W004'), b4, 'nguồn'); eq_(bal_('W003'), b3, 'đích');
  var inc = inc_(m, 'W004', 111000);
  var f0 = flow_('2026-11').income;
  postOne_(m, { kind: 'reversal', date: T_D, txn_id: inc.txn_id, reason: 'Thu nhầm' });
  eq_(flow_('2026-11').income, f0 - 111000, 'thu giảm khi đảo');
});

test_('Giao dịch trước ngày bắt đầu của ví không đổi số dư hiện tại', function () {
  var m = asUser_(T_EMAIL_1);
  var w = readAll_('Wallets').filter(function (x) { return x.wallet_id === 'W001'; })[0];
  updateRow_('Wallets', w._row, { opening_date: '2026-11-01', opening_balance: 1000000 });
  var b0 = bal_('W001');
  inc_(m, 'W001', 999000, { date: '2026-10-15' });
  eq_(bal_('W001'), b0, 'lịch sử không đổi số dư');
  inc_(m, 'W001', 1000, { date: '2026-11-01' });
  eq_(bal_('W001'), b0 + 1000, 'từ ngày cắt có tính');
  throws_(function () { postOne_(m, { kind: 'adjustment', date: '2026-10-30', wallet_id: 'W001', actual_balance: 5, reason: 'Trước ngày cắt' }); }, 'DATE', 'điều chỉnh trước ngày cắt');
  updateRow_('Wallets', w._row, { opening_date: '2000-01-01', opening_balance: 0 });
});

test_('Hoàn tiền giảm chi tiêu của lọ', function () {
  var m = asUser_(T_EMAIL_1);
  var s0 = jarSpent_('J5', '2026-11'), f0 = flow_('2026-11');
  var b0 = bal_('W002');
  postOne_(m, { kind: 'refund', date: T_D, amount: 50000, wallet_id: 'W002', jar_id: 'J5', note: 'Hoàn' });
  eq_(bal_('W002'), b0 + 50000, 'ví tăng');
  eq_(jarSpent_('J5', '2026-11'), s0 - 50000, 'lọ giảm');
  eq_(flow_('2026-11').expense, f0.expense - 50000, 'chi ròng giảm');
  throws_(function () { postOne_(m, { kind: 'refund', date: T_D, amount: 5, wallet_id: 'W002' }); }, 'JAR', 'hoàn tiền cần lọ');
});

test_('Hình dạng giao dịch: bộ kiểm tra bắt các dữ liệu sai', function () {
  var base = { txn_id: 'T1', txn_date: T_D, amount: 100, category_id: '', jar_id: '', reason: '', balance_before: null, balance_after: null, reverses_id: '', ref_id: '', entry_count: 1 };
  function t(over) { return Object.assign({}, base, over); }
  ok_(shapeIssues_(t({ txn_kind: 'income' }), [{ wallet_id: 'W1', amount: 100 }], [], [], null).length === 0, 'thu hợp lệ');
  ok_(shapeIssues_(t({ txn_kind: 'income' }), [{ wallet_id: 'W1', amount: -100 }], [], [], null).length > 0, 'thu sai dấu');
  ok_(shapeIssues_(t({ txn_kind: 'income' }), [], [], [], null).length > 0, 'thu thiếu dòng');
  ok_(shapeIssues_(t({ txn_kind: 'expense', jar_id: '' }), [{ wallet_id: 'W1', amount: -100 }], [], [], null).length > 0, 'chi thiếu lọ');
  ok_(shapeIssues_(t({ txn_kind: 'income', jar_id: 'J1' }), [{ wallet_id: 'W1', amount: 100 }], [], [], null).length > 0, 'thu gắn lọ');
  ok_(shapeIssues_(t({ txn_kind: 'transfer', entry_count: 2 }), [{ wallet_id: 'W1', amount: -100 }, { wallet_id: 'W2', amount: 90 }], [], [], null).length > 0, 'chuyển lệch số tiền');
  ok_(shapeIssues_(t({ txn_kind: 'transfer', entry_count: 2 }), [{ wallet_id: 'W1', amount: -100 }, { wallet_id: 'W1', amount: 100 }], [], [], null).length > 0, 'chuyển cùng ví');
  ok_(shapeIssues_(t({ txn_kind: 'adjustment', reason: 'x', balance_before: 10, balance_after: 100 }), [{ wallet_id: 'W1', amount: 100 }], [], [], null).length > 0, 'điều chỉnh trước/sau lệch');
  ok_(shapeIssues_(t({ txn_kind: 'adjustment', reason: '', balance_before: 0, balance_after: 100 }), [{ wallet_id: 'W1', amount: 100 }], [], [], null).length > 0, 'điều chỉnh thiếu lý do');
  var orig = { txn: { txn_kind: 'expense', amount: 100 }, ents: [{ wallet_id: 'W1', amount: -100 }], lents: [], dents: [] };
  ok_(shapeIssues_(t({ txn_kind: 'reversal', reason: 'r', reverses_id: 'T0', jar_id: 'J1' }), [{ wallet_id: 'W1', amount: 100 }], [], [], orig).length === 0, 'đảo hợp lệ');
  ok_(shapeIssues_(t({ txn_kind: 'reversal', reason: 'r', reverses_id: 'T0', jar_id: 'J1' }), [{ wallet_id: 'W1', amount: -100 }], [], [], orig).length > 0, 'đảo không đối xứng');
  ok_(shapeIssues_(t({ txn_kind: 'reversal', reason: 'r', reverses_id: 'T0', jar_id: 'J1' }), [{ wallet_id: 'W2', amount: 100 }], [], [], orig).length > 0, 'đảo sai ví');
});

test_('Xử lý theo lô: số dư cập nhật trong lô, một lần ghi, chuỗi băm đúng', function () {
  var m = asUser_(T_EMAIL_1);
  FF_CTX.cache = {};
  var st = buildState_();
  var specs = [
    { kind: 'income', date: T_D, amount: 1000000, wallet_id: 'W007', key: 'batch-1' },
    { kind: 'expense', date: T_D, amount: 250000, wallet_id: 'W007', jar_id: 'J1', paid_by: m.member_id, key: 'batch-2' },
    { kind: 'adjustment', date: T_D, wallet_id: 'W007', actual_balance: st.walletBal.W007 + 750000 + 5000, reason: 'Điều chỉnh sau thu chi cùng lô' },
    { kind: 'income', date: T_D, amount: 1000000, wallet_id: 'W007', key: 'batch-1' } // trùng trong cùng lô
  ];
  var plans = [], dups = 0;
  specs.forEach(function (s) { var r = planPost_(st, m.member_id, s); if (r.duplicate) dups++; else plans.push(r.plan); });
  eq_(dups, 1, 'một giao dịch trùng trong lô');
  withLock_(function () { commitPlans_(plans, 2); });
  eq_(bal_('W007'), st.walletBal.W007, 'số dư khớp trạng thái trong bộ nhớ');
  var scan = integrityScan_();
  ok_(scan.ok, 'toàn vẹn sau lô: ' + JSON.stringify(scan.issues.slice(0, 3)));
});

test_('Khoản vay: trả nợ giảm dư nợ, không vượt dư nợ, điều chỉnh, đảo', function () {
  var m = asUser_(T_EMAIL_1);
  var l = createLiability_(m, { name: 'Vay thử', original_amount: 120000000, opening_balance: 100000000, opening_date: '2025-01-01' });
  var id = l.liability_id;
  inc_(m, 'W004', 50000000);
  var w0 = bal_('W004');
  var f0 = flow_('2026-11');
  postOne_(m, { kind: 'loan_payment', date: T_D, amount: 3000000, wallet_id: 'W004', liability_id: id });
  eq_(bal_('W004'), w0 - 3000000, 'ví giảm');
  eq_(liabilityBalances_()[id], 97000000, 'dư nợ giảm');
  eq_(flow_('2026-11').expense, f0.expense, 'trả nợ không phải chi tiêu');
  throws_(function () { postOne_(m, { kind: 'loan_payment', date: T_D, amount: 97000001, wallet_id: 'W004', liability_id: id }); }, 'LIAB', 'trả vượt dư nợ');
  throws_(function () { postOne_(m, { kind: 'loan_payment', date: '2024-12-31', amount: 1000, wallet_id: 'W004', liability_id: id }); }, 'DATE', 'trước ngày vay');
  postOne_(m, { kind: 'liability_adjustment', date: T_D, liability_id: id, actual_balance: 97500000, reason: 'Đối soát với ngân hàng' });
  eq_(liabilityBalances_()[id], 97500000, 'điều chỉnh dư nợ');
  eq_(bal_('W004'), w0 - 3000000, 'điều chỉnh nợ không đụng ví');
  throws_(function () { postOne_(m, { kind: 'liability_adjustment', date: T_D, liability_id: id, actual_balance: 97500000, reason: 'không đổi' }); }, 'ADJ0', 'không chênh lệch');
  var pay = readAll_('Transactions').filter(function (t) { return t.txn_kind === 'loan_payment'; })[0];
  postOne_(m, { kind: 'reversal', date: T_D, txn_id: pay.txn_id, reason: 'Trả nhầm kỳ' });
  eq_(liabilityBalances_()[id], 100500000, 'đảo trả nợ trả lại dư nợ');
  eq_(bal_('W004'), w0, 'đảo trả lại ví');
  var view = assetsView_().liabilities.filter(function (x) { return x.liability_id === id; })[0];
  eq_(view.paid, 0, 'tổng đã trả sau đảo');
});

test_('Khoản vay: kỳ hạn vay, lãi suất theo thời điểm (chỉ theo dõi), lịch sử trả', function () {
  var m = asUser_(T_EMAIL_1);
  eq_(monthsBetween_('2025-01-01', '2025-01-01'), 0, '0 tháng cùng ngày');
  eq_(monthsBetween_('2025-01-01', '2025-04-01'), 3, '3 tháng tròn');
  eq_(monthsBetween_('2025-01-15', '2025-04-01'), 2, 'chưa đủ tháng thứ 3 (14/01 mới tròn)');
  eq_(monthsBetween_('2025-01-01', '2026-01-01'), 12, '12 tháng = 1 năm');

  var l = createLiability_(m, { name: 'Vay kỳ hạn thử', original_amount: 100000000, opening_balance: 100000000, opening_date: '2025-01-01', term_months: 24 });
  var v = assetsView_().liabilities.filter(function (x) { return x.liability_id === l.liability_id; })[0];
  eq_(v.term_months, 24, 'kỳ hạn lưu đúng');
  eq_(v.remaining_months, Math.max(24 - monthsBetween_('2025-01-01', todayYmd_()), 0), 'số tháng còn lại tính đúng');

  throws_(function () { createLiability_(m, { name: 'Vay kỳ hạn sai', opening_balance: 1000000, opening_date: T_D, term_months: 0 }); }, 'LIAB', 'kỳ hạn phải dương');
  throws_(function () { createLiability_(m, { name: 'Vay kỳ hạn sai 2', opening_balance: 1000000, opening_date: T_D, term_months: 2000 }); }, 'LIAB', 'kỳ hạn quá lớn');

  updateLiability_(m, { liability_id: l.liability_id, term_months: 36, name: 'Vay kỳ hạn thử (đã sửa)' });
  var v2 = assetsView_().liabilities.filter(function (x) { return x.liability_id === l.liability_id; })[0];
  eq_(v2.term_months, 36, 'sửa kỳ hạn');
  eq_(v2.name, 'Vay kỳ hạn thử (đã sửa)', 'sửa tên');

  // Lãi suất: chỉ lưu lịch sử, không ảnh hưởng dư nợ.
  addLiabilityRate_(m, { liability_id: l.liability_id, effective_date: '2025-01-01', rate_percent: 8.5, note: 'Lãi suất năm đầu' });
  addLiabilityRate_(m, { liability_id: l.liability_id, effective_date: '2026-01-01', rate_percent: 9.2, note: 'Sau ưu đãi' });
  throws_(function () { addLiabilityRate_(m, { liability_id: l.liability_id, effective_date: T_D, rate_percent: -1 }); }, 'AMOUNT', 'lãi suất âm');
  var rates = liabilityRates_(l.liability_id);
  eq_(rates.length, 2, '2 lần đổi lãi suất');
  eq_(rates[0].rate_percent, 8.5, 'sắp theo ngày áp dụng tăng dần');
  eq_(rates[1].rate_percent, 9.2, 'mức mới nhất');
  eq_(liabilityBalances_()[l.liability_id], 100000000, 'lãi suất không đụng tới dư nợ');

  // Lịch sử trả: trả 2 kỳ rồi đảo 1 kỳ, kiểm tra dư nợ còn lại sau từng dòng.
  inc_(m, 'W004', 50000000);
  postOne_(m, { kind: 'loan_payment', date: '2025-02-01', amount: 3000000, wallet_id: 'W004', liability_id: l.liability_id });
  postOne_(m, { kind: 'loan_payment', date: '2025-03-01', amount: 2500000, wallet_id: 'W004', liability_id: l.liability_id });
  var h = liabilityHistory_(l.liability_id);
  eq_(h.entries.length, 2, '2 dòng lịch sử');
  eq_(h.entries[0].date, '2025-02-01', 'kỳ đầu đúng ngày');
  eq_(h.entries[0].balance_after, 97000000, 'dư nợ sau kỳ 1');
  eq_(h.entries[1].balance_after, 94500000, 'dư nợ sau kỳ 2');
  eq_(h.entries[0].wallet_name, 'BIDV - Cục Thịt', 'ví trả đúng tên (W004)');
  eq_(h.liability.remaining_months, 36 - monthsBetween_('2025-01-01', todayYmd_()), 'số tháng còn lại khớp');
  eq_(h.rates.length, 2, 'lịch sử lãi suất đi kèm');
  var pay2 = h.entries[1];
  postOne_(m, { kind: 'reversal', date: T_D, txn_id: pay2.txn_id, reason: 'Trả nhầm kỳ 2' });
  var h2 = liabilityHistory_(l.liability_id);
  eq_(h2.entries.filter(function (e) { return !e.reversed; }).length, 2, 'vẫn 2 dòng gốc (đảo tạo thêm 1 dòng LiabilityEntries riêng)');
  eq_(h2.liability.balance, 97000000, 'dư nợ hiện tại sau đảo kỳ 2');

  throws_(function () { liabilityHistory_('D999'); }, 'LIAB', 'khoản vay không tồn tại');
});

test_('Nợ cá nhân: cho vay/vay nợ trừ-cộng ví ngay, thu/trả nợ, điều chỉnh, đảo, tài sản ròng', function () {
  var m = asUser_(T_EMAIL_1);
  var nw0 = netWorth_();

  // Cho vay: trừ ví ngay, không tính chi tiêu, cộng vào tài sản ròng (khoản phải thu).
  var f0 = flow_('2026-11');
  var w0 = bal_('W001');
  var lend = svcDebtNew_(m, { direction: 'lend', date: T_D, amount: 2000000, wallet_id: 'W001', counterparty: 'Anh Tuấn', note: 'Cho mượn' });
  var lendId = lend.debt_id;
  eq_(bal_('W001'), w0 - 2000000, 'ví giảm khi cho vay');
  eq_(flow_('2026-11').expense, f0.expense, 'cho vay không phải chi tiêu');
  eq_(debtsView_().debts.filter(function (d) { return d.debt_id === lendId; })[0].balance, 2000000, 'số dư cho vay đúng');
  eq_(netWorth_().net_worth, nw0.net_worth, 'cho vay: tiền chuyển dạng (ví giảm, phải thu tăng), tài sản ròng không đổi');
  eq_(netWorth_().receivables, 2000000, 'phải thu tăng đúng số tiền cho vay');

  // Thu nợ một phần, không được thu vượt số dư.
  postOne_(m, { kind: 'debt_collect', date: T_D, amount: 500000, wallet_id: 'W001', debt_id: lendId });
  eq_(bal_('W001'), w0 - 2000000 + 500000, 'ví tăng khi thu nợ');
  eq_(debtsView_().debts.filter(function (d) { return d.debt_id === lendId; })[0].balance, 1500000, 'số dư cho vay giảm sau khi thu');
  eq_(flow_('2026-11').income, flow_('2026-11').income, 'thu nợ không tính thu nhập (so sánh nội bộ)');
  throws_(function () { postOne_(m, { kind: 'debt_collect', date: T_D, amount: 1500001, wallet_id: 'W001', debt_id: lendId }); }, 'DEBT', 'thu vượt số dư');
  throws_(function () { postOne_(m, { kind: 'debt_repay', date: T_D, amount: 1000, wallet_id: 'W001', debt_id: lendId }); }, 'DEBT', 'không trả được khoản đang cho vay');

  // Vay nợ: cộng ví ngay, không tính thu nhập, trừ vào tài sản ròng (gộp vào "Nợ").
  var finc0 = flow_('2026-11').income;
  var w1 = bal_('W002');
  var nwBeforeBorrow = netWorth_();
  var borrow = svcDebtNew_(m, { direction: 'borrow', date: T_D, amount: 3000000, wallet_id: 'W002', counterparty: 'Chị Lan' });
  var borrowId = borrow.debt_id;
  eq_(bal_('W002'), w1 + 3000000, 'ví tăng khi vay nợ');
  eq_(flow_('2026-11').income, finc0, 'vay nợ không phải thu nhập');
  eq_(netWorth_().net_worth, nwBeforeBorrow.net_worth, 'vay nợ: ví tăng, nợ phải trả tăng, tài sản ròng không đổi');
  eq_(netWorth_().liabilities, nwBeforeBorrow.liabilities + 3000000, 'nợ phải trả tăng đúng số tiền vay');

  // Trả nợ cá nhân một phần.
  var w2 = bal_('W002');
  postOne_(m, { kind: 'debt_repay', date: T_D, amount: 1000000, wallet_id: 'W002', debt_id: borrowId });
  eq_(bal_('W002'), w2 - 1000000, 'ví giảm khi trả nợ cá nhân');
  eq_(debtsView_().debts.filter(function (d) { return d.debt_id === borrowId; })[0].balance, 2000000, 'số dư vay nợ giảm sau khi trả');
  throws_(function () { postOne_(m, { kind: 'debt_repay', date: T_D, amount: 2000001, wallet_id: 'W002', debt_id: borrowId }); }, 'DEBT', 'trả vượt số dư');
  throws_(function () { postOne_(m, { kind: 'debt_collect', date: T_D, amount: 1000, wallet_id: 'W002', debt_id: borrowId }); }, 'DEBT', 'không thu được khoản đang vay nợ');

  // Điều chỉnh nợ cá nhân (đối soát).
  postOne_(m, { kind: 'debt_adjustment', date: T_D, debt_id: borrowId, actual_balance: 2200000, reason: 'Bạn nhắc còn nợ nhiều hơn' });
  eq_(debtsView_().debts.filter(function (d) { return d.debt_id === borrowId; })[0].balance, 2200000, 'điều chỉnh áp dụng đúng');
  throws_(function () { postOne_(m, { kind: 'debt_adjustment', date: T_D, debt_id: borrowId, actual_balance: 2200000, reason: 'không đổi' }); }, 'ADJ0', 'không chênh lệch');

  // Đảo bút toán tạo khoản nợ CHƯA có phát sinh gì thì đảo được, trả lại cả ví lẫn số dư nợ về 0.
  var w3 = bal_('W002');
  var smallLend = svcDebtNew_(m, { direction: 'lend', date: T_D, amount: 400000, wallet_id: 'W002', counterparty: 'Em Hoa' });
  postOne_(m, { kind: 'reversal', date: T_D, txn_id: smallLend.txn_id, reason: 'Ghi nhầm khoản cho vay' });
  eq_(bal_('W002'), w3, 'đảo cho vay (chưa phát sinh gì) trả lại ví');
  eq_(debtsView_().debts.filter(function (d) { return d.debt_id === smallLend.debt_id; })[0].balance, 0, 'đảo khoản chưa phát sinh gì: số dư về đúng 0');

  // Nhưng đảo bút toán tạo khoản nợ SAU KHI đã có thu/trả/điều chỉnh thì bị chặn (tránh số dư âm vô lý).
  var lendTxn = readAll_('Transactions').filter(function (t) { return t.txn_kind === 'debt_lend' && t.ref_id === lendId; })[0];
  throws_(function () { postOne_(m, { kind: 'reversal', date: T_D, txn_id: lendTxn.txn_id, reason: 'Ghi nhầm khoản cho vay' }); }, 'DEBT', 'không đảo được khoản đã phát sinh thu nợ');

  // Chiều nợ không khớp bị từ chối ngay từ bước tạo.
  throws_(function () { postOne_(m, { kind: 'debt_lend', date: T_D, amount: 1000, wallet_id: 'W001', debt_id: borrowId }); }, 'DEBT', 'debt_lend trên khoản borrow');
});

test_('Tài sản, tài sản ròng và tiền giữ hộ', function () {
  var m = asUser_(T_EMAIL_1);
  var nw0 = netWorth_();
  var a = createAsset_(m, { asset_type: 'house', name: 'Nhà thử', purchase_value: 800000000, purchase_date: '2025-06-01' });
  eq_(netWorth_().net_worth, nw0.net_worth + 800000000, 'tài sản cộng vào');
  var sav = saveWallet_(m, { name: 'Tiết kiệm thử', wallet_type: 'savings', owner_member_id: m.member_id, opening_balance: 0, opening_date: '2000-01-01' });
  inc_(m, 'W001', 6000000);
  var nw1 = netWorth_();
  postOne_(m, { kind: 'transfer', date: T_D, amount: 5000000, from_wallet: 'W001', to_wallet: sav.wallet_id });
  var nw2 = netWorth_();
  eq_(nw2.net_worth, nw1.net_worth, 'chuyển sang tiết kiệm không đổi tài sản ròng');
  eq_(nw2.savings, nw1.savings + 5000000, 'tiết kiệm tăng');
  eq_(nw2.cash, nw1.cash - 5000000, 'tiền khả dụng giảm');
  // giữ hộ: không tính vào tài sản ròng
  var trust = saveWallet_(m, { name: 'Giữ hộ thử', wallet_type: 'held_in_trust', holder_name: 'Người gửi thử', owner_member_id: m.member_id, opening_balance: 0, opening_date: '2000-01-01' });
  inc_(m, trust.wallet_id, 2000000);
  var nw3 = netWorth_();
  eq_(nw3.held_in_trust, nw2.held_in_trust + 2000000, 'giữ hộ ghi riêng');
  eq_(nw3.net_worth, nw2.net_worth, 'giữ hộ không vào tài sản ròng');
  // bán tài sản: tính là thu, tài sản không còn trong tài sản ròng
  var f0 = flow_('2026-11');
  postOne_(m, { kind: 'asset_sale', date: T_D, amount: 900000000, wallet_id: 'W001', asset_id: a.asset_id });
  eq_(flow_('2026-11').income, f0.income + 900000000, 'bán tài sản ghi nhận thu');
  eq_(netWorth_().assets, nw3.assets - 800000000, 'tài sản đã bán không còn');
  throws_(function () { postOne_(m, { kind: 'asset_sale', date: T_D, amount: 1, wallet_id: 'W001', asset_id: a.asset_id }); }, 'ASSET', 'bán lần 2');
  var sale = lastTxn_();
  postOne_(m, { kind: 'reversal', date: T_D, txn_id: sale.txn_id, reason: 'Nhập nhầm giao dịch bán' });
  eq_(netWorth_().assets, nw3.assets, 'đảo bán trả lại tài sản');
});

test_('Xoá tài sản: chỉ xoá được khi chưa có giao dịch, có giao dịch rồi thì chỉ ẩn', function () {
  var m = asUser_(T_EMAIL_1);
  var a = createAsset_(m, { asset_type: 'other', name: 'Tài sản thử xoá', purchase_value: 1000000, purchase_date: T_D });
  eq_(assetsView_().assets.filter(function (x) { return x.asset_id === a.asset_id; })[0].has_txn, false, 'chưa có giao dịch');
  deleteAsset_(m, { asset_id: a.asset_id });
  eq_(readAll_('Assets').filter(function (x) { return x.asset_id === a.asset_id; }).length, 0, 'đã xoá khỏi sheet Assets');
  var b = createAsset_(m, { asset_type: 'other', name: 'Tài sản thử xoá 2', purchase_value: 2000000, purchase_date: T_D });
  inc_(m, 'W001', 5000000);
  postOne_(m, { kind: 'asset_purchase', date: T_D, amount: 2000000, wallet_id: 'W001', asset_id: b.asset_id });
  eq_(assetsView_().assets.filter(function (x) { return x.asset_id === b.asset_id; })[0].has_txn, true, 'đã có giao dịch mua');
  throws_(function () { deleteAsset_(m, { asset_id: b.asset_id }); }, 'ASSET', 'không xoá được vì đã có giao dịch');
  updateAsset_(m, { asset_id: b.asset_id, active: 0 });
  eq_(readAll_('Assets').filter(function (x) { return x.asset_id === b.asset_id; })[0].active, 0, 'vẫn ẩn được bình thường');
});

test_('Mua tài sản trừ ví nhưng không tính là chi tiêu', function () {
  var m = asUser_(T_EMAIL_1);
  var a = createAsset_(m, { asset_type: 'car', name: 'Xe thử', purchase_value: 600000000, purchase_date: '2025-01-22' });
  inc_(m, 'W005', 300000000);
  var b0 = bal_('W005'), f0 = flow_('2026-11');
  postOne_(m, { kind: 'asset_purchase', date: T_D, amount: 190000000, wallet_id: 'W005', asset_id: a.asset_id });
  eq_(bal_('W005'), b0 - 190000000, 'ví giảm');
  eq_(flow_('2026-11').expense, f0.expense, 'không phải chi tiêu');
  eq_(jarSpent_('J3', '2026-11'), jarSpent_('J3', '2026-11'), 'lọ không đổi');
});

test_('Ngân sách: sao chép tháng trước, sửa tháng mới không đổi tháng cũ, chuyển lọ, vượt lọ', function () {
  var m = asUser_(T_EMAIL_1);
  var cur = currentPeriod_();
  var y = +cur.slice(0, 4), mo = +cur.slice(5, 7);
  var next = mo === 12 ? (y + 1) + '-01' : y + '-' + pad2_(mo + 1);
  var next2 = mo >= 11 ? (mo === 11 ? (y + 1) + '-01' : (y + 1) + '-02') : y + '-' + pad2_(mo + 2);
  withLock_(function () { ensurePeriod_(m, cur); });
  setJarBudget_(m, { period: cur, jar_id: 'J1', amount: 5000000 });
  setJarBudget_(m, { period: cur, jar_id: 'J2', amount: 2000000 });
  withLock_(function () { ensurePeriod_(m, next); });
  var v = budgetView_(m, next);
  eq_(v.jars.filter(function (j) { return j.jar_id === 'J1'; })[0].budget, 5000000, 'tháng mới kế thừa');
  setJarBudget_(m, { period: next, jar_id: 'J1', amount: 6000000 });
  eq_(budgetView_(m, cur).jars.filter(function (j) { return j.jar_id === 'J1'; })[0].budget, 5000000, 'tháng trước không đổi');
  eq_(budgetView_(m, next).jars.filter(function (j) { return j.jar_id === 'J1'; })[0].budget, 6000000, 'tháng mới đổi');
  throws_(function () { setJarBudget_(m, { period: '2000-01', jar_id: 'J1', amount: 1 }); }, 'PERIOD', 'sửa tháng đã qua');
  throws_(function () { setJarBudget_(m, { period: cur, jar_id: 'J1', amount: -1 }); }, 'AMOUNT', 'ngân sách âm');
  // chuyển giữa lọ: ngân sách hiệu lực thay đổi, không phải chi tiêu
  var f0 = flow_(cur);
  moveBudget_(m, { period: cur, from_jar: 'J1', to_jar: 'J2', amount: 1000000, reason: 'Cân đối' });
  var vc = budgetView_(m, cur);
  eq_(vc.jars.filter(function (j) { return j.jar_id === 'J1'; })[0].budget, 4000000, 'lọ nguồn');
  eq_(vc.jars.filter(function (j) { return j.jar_id === 'J2'; })[0].budget, 3000000, 'lọ đích');
  eq_(flow_(cur).expense, f0.expense, 'chuyển ngân sách không phải chi');
  throws_(function () { moveBudget_(m, { period: cur, from_jar: 'J1', to_jar: 'J2', amount: 99999999, reason: 'Quá lớn' }); }, 'BUDGET', 'vượt ngân sách nguồn');
  throws_(function () { moveBudget_(m, { period: cur, from_jar: 'J1', to_jar: 'J1', amount: 1, reason: 'Cùng lọ' }); }, 'JAR', 'cùng lọ');
  // vượt lọ vẫn ghi nhận và cảnh báo
  inc_(m, 'W001', 20000000, { date: todayYmd_() });
  postOne_(m, { kind: 'expense', date: todayYmd_(), amount: 2500000, wallet_id: 'W001', jar_id: 'J2', paid_by: m.member_id });
  var j2 = budgetView_(m, cur).jars.filter(function (j) { return j.jar_id === 'J2'; })[0];
  eq_(j2.status, 'warn', 'cảnh báo gần hết (>= 80%)');
  postOne_(m, { kind: 'expense', date: todayYmd_(), amount: 1000000, wallet_id: 'W001', jar_id: 'J2', paid_by: m.member_id });
  j2 = budgetView_(m, cur).jars.filter(function (j) { return j.jar_id === 'J2'; })[0];
  eq_(j2.status, 'over', 'vượt lọ'); eq_(j2.remaining, 3000000 - 3500000, 'còn lại âm');
});

test_('Báo cáo thu chi chỉ tính thu nhập và chi tiêu thật', function () {
  var m = asUser_(T_EMAIL_1);
  var p = '2026-09';
  var f0 = flow_(p);
  inc_(m, 'W002', 1000, { date: '2026-09-10' });
  exp_(m, 'W002', 400, 'J1', { date: '2026-09-11' });
  postOne_(m, { kind: 'transfer', date: '2026-09-12', amount: 100, from_wallet: 'W002', to_wallet: 'W001' });
  var f1 = flow_(p);
  eq_(f1.income - f0.income, 1000, 'thu'); eq_(f1.expense - f0.expense, 400, 'chi'); eq_(f1.net - f0.net, 600, 'dòng tiền ròng');
});

test_('Phân quyền: người ngoài, tài khoản bị tắt, hoa thường, không có email', function () {
  asUser_(T_EMAIL_1);
  FF_CTX.asEmail = 'khach@gmail.com'; FF_CTX.cache = {};
  throws_(function () { requireMember_(); }, 'AUTH', 'người ngoài');
  FF_CTX.asEmail = ''; FF_CTX.cache = {};
  throws_(function () { requireMember_(); }, 'AUTH', 'không có email');
  FF_CTX.asEmail = '  THIT@Test.Local '; FF_CTX.cache = {};
  eq_(requireMember_().member_id, 'M01', 'không phân biệt hoa thường');
  var row = readAll_('Members')[1];
  updateRow_('Members', row._row, { active: 0 });
  FF_CTX.asEmail = T_EMAIL_2; FF_CTX.cache = {};
  throws_(function () { requireMember_(); }, 'AUTH', 'thành viên bị tắt');
  updateRow_('Members', row._row, { active: 1 });
});

test_('API: chỉ gọi được hàm trong danh sách, người ngoài bị chặn', function () {
  asUser_(T_EMAIL_2);
  var boot = JSON.parse(apiCall('bootstrap', '{}'));
  ok_(boot.ok && boot.data.me.display_name === 'Cục Cá', 'bootstrap cho thành viên');
  ['nope', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'runAllTests'].forEach(function (n) {
    var r = JSON.parse(apiCall(n, '{}'));
    ok_(!r.ok && r.code === 'API', 'chặn tên ' + n + ' -> ' + JSON.stringify(r));
  });
  var bad = JSON.parse(apiCall('income', '{not json'));
  ok_(!bad.ok && bad.code === 'SYSTEM', 'JSON hỏng không làm sập');
  var r = JSON.parse(apiCall('income', JSON.stringify({ date: T_D, amount: 0, wallet_id: 'W001' })));
  ok_(!r.ok && r.code === 'AMOUNT', 'lỗi nghiệp vụ trả về mã lỗi');
  var good = JSON.parse(apiCall('income', JSON.stringify({ date: T_D, amount: 12345, wallet_id: 'W002', key: 'api-1' })));
  ok_(good.ok && good.data.duplicate === false, 'ghi qua API');
  eq_(readAll_('Transactions').filter(function (t) { return t.txn_id === good.data.txn_id; })[0].created_by, 'M02', 'người tạo là người đăng nhập, không do trình duyệt gửi');
  FF_CTX.asEmail = 'khach@gmail.com'; FF_CTX.cache = {};
  var out = JSON.parse(apiCall('bootstrap', '{}'));
  ok_(!out.ok && out.code === 'AUTH', 'người ngoài bị chặn');
  var out2 = JSON.parse(apiCall('income', JSON.stringify({ date: T_D, amount: 5, wallet_id: 'W001' })));
  ok_(!out2.ok && out2.code === 'AUTH', 'người ngoài không ghi được');
  asUser_(T_EMAIL_1);
});

test_('Cấu hình: ví, lọ, danh mục, cài đặt', function () {
  var m = asUser_(T_EMAIL_1);
  throws_(function () { saveWallet_(m, { name: 'bidv - cục cá', wallet_type: 'bank', owner_member_id: m.member_id }); }, 'WALLET', 'trùng tên ví (không phân biệt hoa thường)');
  throws_(function () { saveWallet_(m, { name: 'Ví lạ', wallet_type: 'xyz', owner_member_id: m.member_id }); }, 'WALLET', 'loại ví sai');
  throws_(function () { saveWallet_(m, { name: 'Giữ hộ thiếu tên', wallet_type: 'held_in_trust', owner_member_id: m.member_id }); }, 'TEXT', 'ví giữ hộ cần tên người gửi');
  var w = saveWallet_(m, { name: 'Ví mới thử', wallet_type: 'cash', owner_member_id: m.member_id, opening_date: '2000-01-01' });
  ok_(/^W\d{3}$/.test(w.wallet_id), 'mã ví tự sinh');
  inc_(m, w.wallet_id, 1000);
  throws_(function () { saveWallet_(m, { wallet_id: w.wallet_id, name: 'Ví mới thử', status: 'closed' }); }, 'WALLET', 'không đóng ví còn tiền');
  postOne_(m, { kind: 'adjustment', date: T_D, wallet_id: w.wallet_id, actual_balance: 0, reason: 'Rút hết để đóng' });
  saveWallet_(m, { wallet_id: w.wallet_id, name: 'Ví mới thử', status: 'closed' });
  throws_(function () { inc_(m, w.wallet_id, 1); }, 'WALLET', 'ví đã đóng');
  throws_(function () { setWalletOpening_(m, { wallet_id: 'W001', opening_balance: 5, opening_date: '2026-11-01', reason: '' }); }, 'TEXT', 'sửa số dư đầu cần lý do');
  setWalletOpening_(m, { wallet_id: 'W001', opening_balance: 0, opening_date: '2000-01-01', reason: 'Khôi phục thử' });
  var j = saveJar_(m, { name: 'Lọ thử' });
  ok_(/^J\d+$/.test(j.jar_id), 'mã lọ');
  throws_(function () { saveJar_(m, { name: 'lọ thử' }); }, 'JAR', 'trùng tên lọ');
  var c = saveCategory_(m, { name: 'Danh mục thử', kind: 'expense', jar_id: j.jar_id });
  throws_(function () { saveCategory_(m, { name: 'Chi không lọ', kind: 'expense' }); }, 'JAR', 'danh mục chi cần lọ');
  saveCategory_(m, { category_id: c.category_id, name: 'Danh mục thử', kind: 'expense', jar_id: j.jar_id, active: false });
  throws_(function () { postOne_(m, { kind: 'expense', date: T_D, amount: 1, wallet_id: 'W001', category_id: c.category_id, paid_by: m.member_id }); }, 'CATEGORY', 'danh mục đã tắt');
  throws_(function () { saveSettings_(m, { budget_warn_pct: 0 }); }, 'SETTING', 'ngưỡng sai');
  saveSettings_(m, { budget_warn_pct: 90 });
  eq_(getSetting_('budget_warn_pct'), '90', 'lưu ngưỡng');
  saveSettings_(m, { budget_warn_pct: 80 });
  ok_(readAll_('AuditLog').some(function (a) { return a.action === 'wallet:opening'; }), 'thay đổi cấu hình có nhật ký');
});

test_('Nhắc nhở: gửi một lần, thử lại khi lỗi, không vượt hạn mức', function () {
  var m = asUser_(T_EMAIL_1);
  FF_CTX.mailLog = [];
  var l = createLiability_(m, { name: 'Vay nhắc', opening_balance: 10000000, opening_date: '2025-01-01' });
  saveReminder_(m, { type: 'loan_payment', title: 'Trả góp thử', day_of_month: 10, days_before: 2, ref_id: l.liability_id });
  saveReminder_(m, { type: 'monthly_bill', title: 'Tiền điện thử', day_of_month: 15, days_before: 1 });
  throws_(function () { saveReminder_(m, { type: 'monthly_bill', title: 'Sai ngày', day_of_month: 31 }); }, 'REMINDER', 'ngày > 28');
  var r1 = remindersJob_('2026-12-08'); // trong cửa sổ 2 ngày trước hạn ngày 10
  var mails1 = FF_CTX.mailLog.filter(function (x) { return /Trả góp thử/.test(x.subject); });
  eq_(mails1.length, 2, 'gửi cho cả hai người');
  remindersJob_('2026-12-08');
  eq_(FF_CTX.mailLog.filter(function (x) { return /Trả góp thử/.test(x.subject); }).length, 2, 'chạy lại không gửi trùng');
  remindersJob_('2026-12-11'); // quá hạn, chưa trả
  ok_(FF_CTX.mailLog.some(function (x) { return /Quá hạn/.test(x.subject); }), 'nhắc quá hạn');
  // trả nợ rồi thì không nhắc quá hạn
  var overdueBefore = FF_CTX.mailLog.filter(function (x) { return /Quá hạn/.test(x.subject); }).length;
  inc_(m, 'W004', 5000000);
  postOne_(m, { kind: 'loan_payment', date: '2027-01-05', amount: 1000, wallet_id: 'W004', liability_id: l.liability_id });
  remindersJob_('2027-01-11');
  eq_(FF_CTX.mailLog.filter(function (x) { return /Quá hạn/.test(x.subject); }).length, overdueBefore, 'đã trả thì không nhắc quá hạn');
  // lỗi gửi mail: ghi trạng thái failed rồi thử lại lần sau
  FF_CTX.mailFail = 1;
  var n1 = notify_('test:retry', 'Chủ đề thử', 'nội dung');
  eq_(n1.failed, 1, 'một người lỗi'); eq_(n1.sent, 1, 'một người gửi được');
  var n2 = notify_('test:retry', 'Chủ đề thử', 'nội dung');
  eq_(n2.sent, 1, 'thử lại người lỗi'); eq_(n2.skipped, 1, 'người đã gửi bị bỏ qua');
  var st = readAll_('Notifications').filter(function (x) { return x.key.indexOf('test:retry') === 0; });
  ok_(st.every(function (x) { return x.status === 'sent'; }), 'cuối cùng đều đã gửi');
});

test_('Nhắc nhập liệu và ngân sách', function () {
  var m = asUser_(T_EMAIL_1);
  FF_CTX.mailLog = [];
  var today = todayYmd_();
  remindersJob_(addDays_(today, 10));
  ok_(FF_CTX.mailLog.some(function (x) { return /Nhắc nhập thu chi/.test(x.subject); }), 'nhắc nhập liệu sau nhiều ngày không có giao dịch mới');
});

test_('Sao lưu: bản sao tuần khớp dữ liệu, giữ N bản gần nhất, xuất Excel tháng', function () {
  var m = asUser_(T_EMAIL_1);
  inc_(m, 'W001', 1000);
  setSetting_('weekly_keep', 2);
  var r1 = weeklyBackup(); ok_(r1.ok, 'bản sao 1 khớp: ' + JSON.stringify(r1.check));
  var r2 = weeklyBackup(); ok_(r2.ok, 'bản sao 2');
  var r3 = weeklyBackup(); ok_(r3.ok, 'bản sao 3');
  eq_(r3.pruned, 1, 'xóa bản cũ nhất');
  var f = backupFolders_(), n = 0, it = f.weekly.getFiles();
  while (it.hasNext()) { it.next(); n++; }
  eq_(n, 2, 'còn đúng 2 bản');
  var x = monthlyExport();
  ok_(x.ok && x.size > 1000, 'xuất Excel: ' + JSON.stringify(x));
  ok_(/OK$/.test(getSetting_('last_backup_weekly')) && /OK$/.test(getSetting_('last_backup_monthly')), 'ghi trạng thái sao lưu');
  // bản sao không khớp phải bị phát hiện
  var ss = getSs_();
  var copy = DriveApp.getFileById(ss.getId()).makeCopy('lech', f.weekly);
  var cs = SpreadsheetApp.openById(copy.getId());
  var sh = cs.getSheetByName('Transactions');
  sh.getRange(sh.getLastRow(), 1, 1, schemaOf_('Transactions').cols.length).clearContent();
  eq_(verifyCopy_(ss, cs).ok, false, 'bản sao thiếu dòng bị phát hiện');
  copy.setTrashed(true);
});

test_('Ghi nhận sửa tay (onEdit)', function () {
  asUser_(T_EMAIL_1);
  var fakeSheet = { getName: function () { return 'Wallets'; } };
  var fakeRange = { getSheet: function () { return fakeSheet; }, getA1Notation: function () { return 'B2'; } };
  onEditAudit({ range: fakeRange, oldValue: 'a', value: 'b', user: { getEmail: function () { return 'x@test.local'; } } });
  var log = readAll_('AuditLog').filter(function (a) { return a.action === 'manual-edit'; });
  ok_(log.length >= 1 && /Wallets!B2/.test(log[log.length - 1].ref_id), 'ghi nhật ký sửa tay');
  var n = readAll_('AuditLog').length;
  onEditAudit({ range: { getSheet: function () { return { getName: function () { return 'KhongCo'; } }; }, getA1Notation: function () { return 'A1'; } } });
  eq_(readAll_('AuditLog').length, n, 'bỏ qua sheet lạ');
  onEditAudit(null);
});

test_('Trigger được cài đúng', function () {
  asUser_(T_EMAIL_1);
  var msg = installTriggers();
  ok_(/4 trigger/.test(msg), 'cài 4 trigger');
  var names = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  ['dailyJob', 'weeklyBackup', 'monthlyExport', 'onEditAudit'].forEach(function (n) { ok_(names.indexOf(n) >= 0, 'có trigger ' + n); });
  installTriggers();
  eq_(ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'dailyJob'; }).length, 1, 'cài lại không nhân đôi');
});

test_('Giao diện dựng được dữ liệu cho màn hình', function () {
  var m = asUser_(T_EMAIL_1);
  var d = dashboard_(m, currentPeriod_());
  ok_(typeof d.net_worth === 'number' && d.wallets.length >= 8, 'dashboard có dữ liệu');
  var l = listTxns_(m, { limit: 5 });
  ok_(l.rows.length > 0 && l.total >= l.rows.length, 'danh sách giao dịch');
  var byWallet = listTxns_(m, { wallet_id: 'W001', limit: 300 });
  ok_(byWallet.rows.every(function (r) { return r.lines.some(function (x) { return x.wallet_id === 'W001'; }); }), 'lọc theo ví');
  eq_(JSON.parse(JSON.stringify(d)).net_worth, d.net_worth, 'dữ liệu serialize được');
  ok_(Array.isArray(d.debts_open), 'dashboard có sổ nợ cá nhân chưa xong');
});

test_('Lịch sử: lọc theo khoảng ngày, danh mục, khoảng tiền', function () {
  var m = asUser_(T_EMAIL_1);
  var cats = readAll_('Categories');
  var cat = cats.filter(function (c) { return c.name === 'Xăng dầu'; })[0];
  exp_(m, 'W001', 50000, 'J3', { category_id: cat.category_id, date: '2026-11-01' });
  exp_(m, 'W001', 5000000, 'J3', { category_id: cat.category_id, date: '2026-11-03' });
  var byRange = listTxns_(m, { date_from: '2026-11-02', date_to: '2026-11-04', limit: 300 });
  ok_(byRange.rows.every(function (r) { return r.date >= '2026-11-02' && r.date <= '2026-11-04'; }), 'lọc theo khoảng ngày');
  var byCat = listTxns_(m, { category_id: cat.category_id, limit: 300 });
  ok_(byCat.rows.length >= 2 && byCat.rows.every(function (r) { return r.category === 'Xăng dầu'; }), 'lọc theo danh mục');
  var byAmt = listTxns_(m, { amount_min: 1000000, limit: 300 });
  ok_(byAmt.rows.length > 0 && byAmt.rows.every(function (r) { return r.amount >= 1000000; }), 'lọc theo số tiền tối thiểu');
  var byAmtMax = listTxns_(m, { amount_max: 100000, limit: 300 });
  ok_(byAmtMax.rows.every(function (r) { return r.amount <= 100000; }), 'lọc theo số tiền tối đa');
});

// Destructive tests (tamper with the sheets by hand) run last, each in its own environment.
test_('Toàn vẹn: dữ liệu sạch thì quét đạt', function () {
  var m = asUser_(T_EMAIL_1);
  inc_(m, 'W001', 1000); exp_(m, 'W001', 100, 'J1'); inc_(m, 'W002', 2000);
  var s = integrityScan_();
  ok_(s.ok, 'sạch: ' + JSON.stringify(s.issues.slice(0, 3)));
  ok_(s.counts.txns >= 3, 'đếm giao dịch');
});

test_('Toàn vẹn: phát hiện sửa tay số tiền, ghi chú, xóa dòng, chèn dòng giả', function () {
  var m = asUser_(T_EMAIL_1);
  inc_(m, 'W001', 1000); var e = exp_(m, 'W001', 100, 'J1'); inc_(m, 'W002', 2000);
  ok_(integrityScan_().ok, 'ban đầu sạch');
  var ents = getSheet_('Entries'), def = schemaOf_('Entries');
  var amtCol = def.cols.indexOf('amount') + 1;
  var rows = readAll_('Entries'), target = rows[1];
  var old = ents.getRange(target._row, amtCol).getValue();
  ents.getRange(target._row, amtCol).setValue(999999);
  FF_CTX.cache = {};
  var s1 = integrityScan_();
  ok_(!s1.ok && s1.issues.some(function (i) { return i.code === 'hash'; }), 'sửa số tiền dòng sổ cái bị phát hiện');
  ents.getRange(target._row, amtCol).setValue(old);
  FF_CTX.cache = {};
  ok_(integrityScan_().ok, 'trả lại thì sạch');
  var tx = getSheet_('Transactions'), tdef = schemaOf_('Transactions');
  var noteCol = tdef.cols.indexOf('note') + 1, tr = readAll_('Transactions')[0];
  tx.getRange(tr._row, noteCol).setValue('bị sửa tay');
  FF_CTX.cache = {};
  ok_(integrityScan_().issues.some(function (i) { return i.code === 'hash'; }), 'sửa ghi chú giao dịch bị phát hiện');
  tx.getRange(tr._row, noteCol).setValue('');
  FF_CTX.cache = {};
  ok_(integrityScan_().ok, 'khôi phục ghi chú thì sạch');
  ents.getRange(target._row, 1, 1, def.cols.length).clearContent();
  FF_CTX.cache = {};
  var s2 = integrityScan_();
  ok_(!s2.ok, 'xóa dòng sổ cái bị phát hiện');
  appendRows_('Entries', [{ entry_id: 'FAKE-1', txn_id: 'T-khong-ton-tai', wallet_id: 'W001', amount: 5 }]);
  ok_(integrityScan_().issues.some(function (i) { return i.code === 'orphan_entry'; }), 'dòng sổ cái mồ côi bị phát hiện');
});

test_('Toàn vẹn: công việc hằng ngày gửi cảnh báo một lần', function () {
  var m = asUser_(T_EMAIL_1);
  inc_(m, 'W001', 1000);
  var ents = getSheet_('Entries'), amtCol = schemaOf_('Entries').cols.indexOf('amount') + 1;
  ents.getRange(readAll_('Entries')[0]._row, amtCol).setValue(123);
  FF_CTX.cache = {}; FF_CTX.mailLog = [];
  dailyJob();
  var n1 = FF_CTX.mailLog.filter(function (x) { return /toàn vẹn/.test(x.subject); }).length;
  eq_(n1, 2, 'cảnh báo gửi cho cả hai');
  dailyJob();
  eq_(FF_CTX.mailLog.filter(function (x) { return /toàn vẹn/.test(x.subject); }).length, n1, 'không gửi lặp');
  ok_(/LỖI/.test(getSetting_('last_integrity')), 'ghi trạng thái lỗi');
});

test_('Thiết lập chạy lại không làm mất dữ liệu và kiểm tra cấu trúc', function () {
  var m = asUser_(T_EMAIL_1);
  inc_(m, 'W001', 1000);
  var before = readAll_('Transactions').length;
  var rep = setupCore_(getSs_());
  eq_(rep.created.length, 0, 'không tạo lại sheet'); eq_(rep.seeded.length, 0, 'không gieo lại dữ liệu');
  eq_(readAll_('Transactions').length, before, 'giao dịch còn nguyên');
  eq_(readAll_('Wallets').length >= 8, true, 'ví còn nguyên');
  eq_(checkSetup(), 'Mọi thứ đã sẵn sàng.', 'checkSetup');
  var sh = getSheet_('Wallets'); sh.getRange(1, 2).setValue('doi_ten');
  throws_(function () { setupCore_(getSs_()); }, 'SETUP', 'tiêu đề cột bị đổi');
});

test_('Thiết lập tự vá cột mới thêm sau (vd term_months) mà không mất dữ liệu cũ', function () {
  var m = asUser_(T_EMAIL_1);
  var liab = createLiability_(m, { name: 'Vay giả lập sheet cũ', original_amount: 100000000, opening_balance: 90000000, opening_date: '2026-11-01' });
  // Giả lập 1 spreadsheet cũ (trước khi có cột term_months): xoá nội dung cột cuối ở MỌI dòng, kể cả
  // tiêu đề, giống hệt 1 sheet được tạo bởi phiên bản schema trước đó.
  var sh = getSheet_('Liabilities'), lastCol = schemaOf_('Liabilities').cols.length;
  var lastRow = sh.getLastRow();
  sh.getRange(1, lastCol, lastRow, 1).clearContent();
  eq_(sh.getLastColumn(), lastCol - 1, 'giả lập header thiếu cột cuối');
  var rep = setupCore_(getSs_());
  ok_(rep.created.indexOf('Liabilities.term_months') >= 0, 'đã vá thêm cột term_months');
  eq_(sh.getRange(1, lastCol).getValue(), 'term_months', 'tiêu đề cột mới đúng tên');
  eq_(readAll_('Liabilities').filter(function (l) { return l.liability_id === liab.liability_id; })[0].name, 'Vay giả lập sheet cũ', 'dữ liệu cũ còn nguyên');
  eq_(checkSetup(), 'Mọi thứ đã sẵn sàng.', 'checkSetup sau khi vá');
});

test_('Dữ liệu nền theo đặc tả', function () {
  asUser_(T_EMAIL_1);
  var ms = readAll_('Members'), jars = readAll_('Jars'), ws = readAll_('Wallets');
  eq_(ms[0].display_name, 'Cục Thịt', 'tên 1'); eq_(ms[1].display_name, 'Cục Cá', 'tên 2');
  eq_(jars.length, 6, '6 lọ');
  eq_(ws.length, 8, '8 ví');
  eq_(ws.filter(function (w) { return w.wallet_type === 'held_in_trust'; })[0].status, 'closed', 'ví Beo đã đóng');
  ok_(ws.every(function (w) { return /^W\d{3}$/.test(w.wallet_id); }), 'mã ví');
  ok_(readAll_('Categories').filter(function (c) { return c.kind === 'expense'; }).every(function (c) { return !!c.jar_id; }), 'mọi danh mục chi thuộc một lọ');
  eq_(getSetting_('cutoff_date'), '2026-11-01', 'ngày cắt');
});


test_('Nhập Excel cũ: ImportMap bắt buộc quyết định, chống trùng, đối chiếu khớp', function () {
  var m = asUser_(T_EMAIL_1);
  var src = SpreadsheetApp.create('SRC_TEST');
  var fin = src.insertSheet('finance'), chg = src.insertSheet('change');
  fin.getRange(1, 1, 1, 9).setValues([['ID', 'Ngày', 'Sự kiện', 'Loại', 'Mục', 'Số tiền', 'Ví', 'Sở hữu', 'Ghi chú']]);
  var frows = [
    ['a1', '2024-05-01', 'e', 'Chi', 'Đi chợ', 100000, 'VÍ - Cục Cá', 'Cục Cá', 'chợ'],
    ['a2', '2024-05-02', 'e', 'Chi', 'Siêu Thị', 250000, 'Ví - Cục Thịt', 'Cục Thịt', ''],
    ['a3', '2024-05-03', 'e', 'Thu', 'Lương', 9000000, 'BIDV - Cục Thịt', 'Cục Thịt', ''],
    ['a4', '2024-05-04', 'e', 'Chi', 'Mục lạ XYZ', 500000000, 'HSBC', 'Cục Thịt', 'cần quyết định'],
    ['a5', '2024-05-05', 'e', 'Chi', 'Điều chỉnh', 7000, 'Ví - Cục Cá', 'Cục Cá', '']
  ];
  fin.getRange(2, 1, frows.length, 9).setValues(frows);
  chg.getRange(1, 1, 1, 5).setValues([['ID', 'Ngày', 'Số tiền', 'Từ', 'Đến']]);
  chg.getRange(2, 1, 2, 5).setValues([['c1', '2024-05-06', 3000000, 'BIDV - Cục Thịt', 'VÍ - Cục Cá'], ['c2', '2024-05-07', 1000, 'HSBC', 'Ví khong co']]);
  readAll_('Wallets').forEach(function (w) { updateRow_('Wallets', w._row, { opening_date: '2026-11-01' }); });
  saveCategory_(m, { name: 'Đối soát cũ (lịch sử) - thiếu hụt', kind: 'expense', jar_id: 'J1' });
  FF_CTX.importSrc = src.getId();
  importPrepare();
  var sh = getSs_().getSheetByName('ImportMap'), vals = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  function actionOf(k, c) { return vals.filter(function (v) { return v[0] === k && v[1] === c; })[0][4]; }
  eq_(actionOf('Chi', 'Đi chợ'), 'expense', 'đề xuất khớp tên');
  eq_(actionOf('Chi', 'Siêu Thị'), 'expense', 'khớp không phân biệt hoa thường');
  eq_(actionOf('Chi', 'Mục lạ XYZ'), 'review', 'chưa quyết định (danh mục lạ)');
  eq_(actionOf('Chi', 'Điều chỉnh'), 'expense', 'áp dụng quyết định 07/11/2026: không dùng được adjustment (chặn ngày trước opening_date), chuyển sang chi tiêu lịch sử');
  eq_(actionOf('Thu', 'Lương'), 'income', 'thu Lương');
  throws_(function () { importRun(); }, 'IMPORT', 'bị chặn khi còn review');
  eq_(readAll_('Transactions').length, 0, 'chưa ghi gì');
  // người dùng quyết định phần còn lại (danh mục lạ không có trong bảng quyết định)
  function setAction(k, c, a, tgt) { for (var i = 0; i < vals.length; i++) if (vals[i][0] === k && vals[i][1] === c) sh.getRange(i + 2, 5, 1, 2).setValues([[a, tgt || vals[i][5]]]); }
  setAction('Chi', 'Mục lạ XYZ', 'skip');
  var dry = importDryRun();
  ok_(/Ví chuyển không nhận diện được/.test(dry), 'báo ví lạ');
  throws_(function () { importRun(); }, 'IMPORT', 'bị chặn khi còn dòng lỗi');
  chg.getRange(3, 5, 1, 1).setValue('Ví - Cục Cá'); // sửa nguồn (bản sao)
  var b0 = bal_('W001');
  var out = importRun(2); // chia lô: chỉ ghi 2 trước
  ok_(/CÒN 1 giao dịch/.test(out) || /CÒN/.test(out), 'còn phần chưa ghi');
  eq_(readAll_('Transactions').length, 2, 'lô 1 ghi 2');
  var out2 = importRun(50);
  eq_(readAll_('Transactions').length, 6, 'tổng 6 giao dịch (4 finance + 2 chuyển)');
  var out3 = importRun(50);
  eq_(readAll_('Transactions').length, 6, 'chạy lại không nhân đôi');
  ok_(/\(finance\)\: KHỚP/.test(out3) && /\(change\)\: KHỚP/.test(out3), 'đối chiếu khớp: ' + out3);
  eq_(bal_('W001'), b0, 'lịch sử trước ngày bắt đầu ví không đổi số dư');
  ok_(integrityScan_().ok, 'toàn vẹn sau nhập');
  var tx = readAll_('Transactions'), tm = txnMap_(tx);
  var f = cashFlow_('2024-05', tx, tm);
  eq_(f.income, 9000000, 'thu lịch sử'); eq_(f.expense, 357000, 'chi lịch sử (Mục lạ XYZ bị bỏ qua; Điều chỉnh 7.000 nay tính là chi tiêu lịch sử)');
  var exp = tx.filter(function (t) { return t.idempotency_key === 'imp:finance:a2'; })[0];
  eq_(exp.paid_by, 'M01', 'người chi theo cột Sở hữu'); eq_(exp.jar_id, 'J1', 'lọ theo danh mục');
  DriveApp.getFileById(src.getId()).setTrashed(true);
  FF_CTX.importSrc = null;
});


test_('Chạy thiết lập lần đầu trên bảng tính hoàn toàn trống (chưa có sheet nào)', function () {
  var savedSs = FF_CTX.ss, savedEmail = FF_CTX.asEmail, savedCache = FF_CTX.cache;
  var blank = SpreadsheetApp.create('FF_BLANK_TEST');
  FF_CTX.ss = blank; FF_CTX.cache = {}; FF_CTX.asEmail = T_EMAIL_1;
  try {
    var r = setupSpreadsheet(); // phải không bị lỗi dù chưa có sheet Members
    ok_(r.created.indexOf('Members') >= 0, 'tạo sheet Members');
    eq_(checkSetup().indexOf('Chưa nhập email') >= 0, true, 'checkSetup báo thiếu email (chưa crash)');
    setupSpreadsheet(); // chạy lại lần 2 không được lỗi, không tạo trùng
    eq_(readAll_('Wallets').length, 8, 'ví đã gieo đúng 1 lần');
  } finally {
    try { DriveApp.getFileById(blank.getId()).setTrashed(true); } catch (e) { /* ignore */ }
    FF_CTX.ss = savedSs; FF_CTX.asEmail = savedEmail; FF_CTX.cache = savedCache;
  }
});

test_('Vàng: lô mua/bán độc lập, trừ/cộng ví, không tính là chi tiêu, bán rồi tính thu nhập', function () {
  var m = asUser_(T_EMAIL_1);
  var nwBefore = netWorth_();
  var g = createGoldLot_(m, { brand: 'PNJ', quantity: 2, purchase_value: 13000000, purchase_date: T_D });
  eq_(goldLotsView_().lots.filter(function (x) { return x.lot_id === g.lot_id; })[0].has_txn, false, 'chưa có giao dịch');
  inc_(m, 'W001', 20000000);
  var nw0 = netWorth_();
  eq_(nw0.assets, nwBefore.assets + 13000000, 'tạo lô đã cộng ngay vào tài sản ròng theo giá mua (độc lập với việc đã ghi giao dịch ví hay chưa)');
  var b0 = bal_('W001'), f0 = flow_('2026-11');
  postOne_(m, { kind: 'gold_purchase', date: T_D, amount: 13000000, wallet_id: 'W001', lot_id: g.lot_id });
  eq_(bal_('W001'), b0 - 13000000, 'ví giảm đúng số tiền mua vàng');
  eq_(flow_('2026-11').expense, f0.expense, 'mua vàng không tính là chi tiêu');
  eq_(netWorth_().assets, nw0.assets, 'ghi giao dịch mua không đổi tài sản ròng (giá trị lô đã tính từ lúc tạo lô)');

  var f1 = flow_('2026-11');
  postOne_(m, { kind: 'gold_sale', date: T_D, amount: 15000000, wallet_id: 'W001', lot_id: g.lot_id });
  eq_(bal_('W001'), b0 - 13000000 + 15000000, 'ví tăng đúng số tiền bán vàng');
  eq_(flow_('2026-11').income, f1.income + 15000000, 'bán vàng tính là thu nhập');
  eq_(netWorth_().assets, nwBefore.assets, 'lô đã bán không còn tính vào tài sản ròng');
  throws_(function () { postOne_(m, { kind: 'gold_sale', date: T_D, amount: 1, wallet_id: 'W001', lot_id: g.lot_id }); }, 'GOLD', 'bán lần 2');

  var sale = lastTxn_();
  postOne_(m, { kind: 'reversal', date: T_D, txn_id: sale.txn_id, reason: 'Nhập nhầm giao dịch bán vàng' });
  eq_(netWorth_().assets, nw0.assets, 'đảo bán trả lại lô vàng vào tài sản ròng');
});

test_('Vàng: lô giá 0 (nhận tặng/không rõ giá) không cần giao dịch ví; xoá chỉ được khi chưa có giao dịch', function () {
  var m = asUser_(T_EMAIL_1);
  var gift = createGoldLot_(m, { brand: 'Nhận từ đám cưới', quantity: 0.5, purchase_date: T_D, note: 'Không rõ giá mua' });
  eq_(readAll_('GoldLots').filter(function (x) { return x.lot_id === gift.lot_id; })[0].purchase_value, 0, 'giá mua mặc định 0');
  eq_(goldLotHasTxn_(gift.lot_id), false, 'lô giá 0 không có giao dịch nào gắn với nó');
  deleteGoldLot_(m, { lot_id: gift.lot_id });
  eq_(readAll_('GoldLots').filter(function (x) { return x.lot_id === gift.lot_id; }).length, 0, 'xoá được vì chưa có giao dịch');

  var g = createGoldLot_(m, { brand: 'SJC', quantity: 1, purchase_value: 7000000, purchase_date: T_D });
  inc_(m, 'W001', 10000000);
  postOne_(m, { kind: 'gold_purchase', date: T_D, amount: 7000000, wallet_id: 'W001', lot_id: g.lot_id });
  throws_(function () { deleteGoldLot_(m, { lot_id: g.lot_id }); }, 'GOLD', 'không xoá được vì đã có giao dịch');
  updateGoldLot_(m, { lot_id: g.lot_id, active: 0 });
  eq_(readAll_('GoldLots').filter(function (x) { return x.lot_id === g.lot_id; })[0].active, 0, 'vẫn ẩn được bình thường');
});

test_('Nhập lô vàng cũ từ Excel: chống trùng theo source_ref, chạy lại không nhân đôi', function () {
  var m = asUser_(T_EMAIL_1);
  var rows = [
    { brand: 'Cùa', quantity: 3.5, purchase_value: 0, purchase_date: '2022-12-30', note: 'Nhận từ đám cưới', source_ref: 'imp:gold:test_unit_1' },
    { brand: 'Tuấn Kim Long', quantity: 3.5, purchase_value: 22050000, purchase_date: '2024-01-10', source_ref: 'imp:gold:test_unit_2' }
  ];
  var r1 = importGoldLots_(m, { rows: rows });
  eq_(r1.created.length, 2, 'nhập được 2 lô');
  eq_(r1.skipped.length, 0, 'chưa có gì để bỏ qua lần đầu');
  var r2 = importGoldLots_(m, { rows: rows });
  eq_(r2.created.length, 0, 'chạy lại không tạo thêm');
  eq_(r2.skipped.length, 2, 'cả 2 dòng bị bỏ qua vì đã có source_ref trùng');
  eq_(readAll_('GoldLots').filter(function (x) { return x.source_ref === 'imp:gold:test_unit_2'; }).length, 1, 'không nhân đôi trong sheet');
});

test_('Sổ cưới: thêm/sửa/xoá, lọc & tổng hợp, KHÔNG tạo giao dịch nào (sổ lưu trữ thuần)', function () {
  var m = asUser_(T_EMAIL_1);
  var txnCountBefore = readAll_('Transactions').length;
  var g1 = createWeddingGift_(m, { wedding_date: '2022-12-30', side: 'Anh', guest_name: 'Bác Ba', address: 'Quảng Ngãi', cash_amount: 4000000, relationship: 'Nội', payment_method: 'Tiền mặt' });
  var g2 = createWeddingGift_(m, { wedding_date: '2022-12-30', side: 'Em', guest_name: 'GĐ Thanh - Nhung', address: 'Hoàn Cát', gold_amount: 0.5, relationship: 'Gia đình', payment_method: 'Vàng', repaid: true });
  var g3 = createWeddingGift_(m, { wedding_date: '2023-02-11', side: 'Anh', guest_name: 'Mỹ', address: 'Mĩ', usd_amount: 100, relationship: 'Bạn bè', payment_method: 'Tiền mặt' });
  eq_(readAll_('Transactions').length, txnCountBefore, 'sổ cưới không tạo bất kỳ giao dịch sổ cái nào');

  var all = weddingGiftsView_({});
  eq_(all.totals.count, 3, 'tổng số dòng');
  eq_(all.totals.cash, 4000000, 'tổng tiền mừng');
  eq_(all.totals.gold, 0.5, 'tổng vàng (chỉ)');
  eq_(all.totals.usd, 100, 'tổng USD');

  var golden = weddingGiftsView_({ side: 'Em' });
  eq_(golden.totals.count, 1, 'lọc theo bên Em');
  var repaidOnly = weddingGiftsView_({ repaid: '1' });
  eq_(repaidOnly.totals.count, 1, 'lọc đã trả lễ lại');
  var searched = weddingGiftsView_({ q: 'thanh' });
  eq_(searched.totals.count, 1, 'tìm theo tên không phân biệt hoa thường');

  updateWeddingGift_(m, { gift_id: g1.gift_id, cash_amount: 4500000, note: 'Sửa lại số tiền' });
  eq_(readAll_('WeddingGifts').filter(function (x) { return x.gift_id === g1.gift_id; })[0].cash_amount, 4500000, 'sửa được số tiền');

  deleteWeddingGift_(m, { gift_id: g3.gift_id });
  eq_(readAll_('WeddingGifts').filter(function (x) { return x.gift_id === g3.gift_id; }).length, 0, 'xoá tự do (không phải sổ cái, không cần kiểm tra giao dịch)');
  eq_(readAll_('Transactions').length, txnCountBefore, 'xoá/sửa sổ cưới vẫn không đụng tới sổ cái');
});

test_('Sổ cưới: dòng chỉ ghi tên (không rõ số tiền mừng) vẫn lưu được, không mất dữ liệu lịch sử', function () {
  var m = asUser_(T_EMAIL_1);
  var g = createWeddingGift_(m, { wedding_date: '2022-12-30', side: 'Em', guest_name: 'Khách không rõ tiền mừng', relationship: 'Hàng xóm' });
  var row = readAll_('WeddingGifts').filter(function (x) { return x.gift_id === g.gift_id; })[0];
  eq_(row.cash_amount, 0, 'mặc định 0');
  eq_(row.gold_amount, 0, 'mặc định 0');
  eq_(row.usd_amount, 0, 'mặc định 0');
});

test_('Nhập sổ cưới cũ từ Excel: chống trùng theo source_ref, chạy lại không nhân đôi', function () {
  var m = asUser_(T_EMAIL_1);
  var rows = [
    { wedding_date: '2022-12-30', side: 'Anh', guest_name: 'Bác Ba', address: 'Quảng Ngãi', cash_amount: 4000000, relationship: 'Nội', payment_method: 'Tiền mặt', source_ref: 'imp:wedding:test_unit_1' },
    { wedding_date: '2022-12-30', side: 'Em', guest_name: 'GĐ Thanh - Nhung', address: 'Hoàn Cát', gold_amount: 0.5, relationship: 'Gia đình', payment_method: 'Vàng', source_ref: 'imp:wedding:test_unit_4' }
  ];
  var r1 = importWeddingGifts_(m, { rows: rows });
  eq_(r1.created.length, 2, 'nhập được 2 dòng');
  var r2 = importWeddingGifts_(m, { rows: rows });
  eq_(r2.created.length, 0, 'chạy lại không tạo thêm');
  eq_(r2.skipped.length, 2, 'bỏ qua vì source_ref đã tồn tại');
  eq_(readAll_('WeddingGifts').filter(function (x) { return x.source_ref === 'imp:wedding:test_unit_4'; }).length, 1, 'không nhân đôi trong sheet');
  eq_(readAll_('Transactions').length, readAll_('Transactions').length, 'import sổ cưới không bao giờ tạo giao dịch');
});

test_('Nhập vàng + sổ cưới cũ từ Excel (ImportGoldWedding): đối chiếu khớp, chống trùng, ghi đúng giao dịch mua vàng', function () {
  asUser_(T_EMAIL_1);
  var dry = importGoldWeddingDryRun();
  ok_(dry.indexOf('60.415.000') >= 0, 'dry run nêu đúng tổng giá trị vàng nguồn');
  var txnBefore = readAll_('Transactions').length;
  var real = importGoldWedding();
  ok_(real.indexOf('9 lô vàng mới') >= 0, 'đã ghi đúng 9 lô vàng');
  ok_(real.indexOf('4 giao dịch mua vàng') >= 0, 'đã ghi đúng 4 giao dịch mua vàng (4 lô có giá)');
  ok_(real.indexOf('487 dòng sổ cưới') >= 0, 'đã ghi đúng 487 dòng sổ cưới');
  // Chỉ đếm theo đúng source_ref có trong FF_GOLD_SEED/FF_WEDDING_SEED — môi trường test dùng chung
  // (không cô lập) nên có thể còn vài lô/dòng nguồn giả từ các test khác ở trên.
  function isSeedGold(g) { return FF_GOLD_SEED.some(function (s) { return s.source_ref === g.source_ref; }); }
  function isSeedWedding(g) { return FF_WEDDING_SEED.some(function (s) { return s.source_ref === g.source_ref; }); }
  eq_(readAll_('GoldLots').filter(isSeedGold).length, 9, 'đủ 9 lô vàng trong sheet');
  eq_(readAll_('WeddingGifts').filter(isSeedWedding).length, 487, 'đủ 487 dòng sổ cưới trong sheet');
  eq_(readAll_('Transactions').length, txnBefore + 4, 'chỉ 4 giao dịch mua vàng được ghi (sổ cưới không tạo giao dịch nào)');
  var srcQty = 0; readAll_('GoldLots').filter(isSeedGold).forEach(function (g) { srcQty += g.quantity; });
  eq_(srcQty, 26, 'tổng số lượng vàng nhập đúng 26 chỉ');
  var srcCash = 0, srcGold = 0, srcUsd = 0;
  readAll_('WeddingGifts').filter(isSeedWedding).forEach(function (g) { srcCash += g.cash_amount; srcGold += g.gold_amount; srcUsd += g.usd_amount; });
  eq_(srcCash, 213279111, 'tổng tiền mừng đúng');
  eq_(Math.round(srcGold * 10) / 10, 12.2, 'tổng vàng mừng cưới đúng');
  eq_(srcUsd, 300, 'tổng USD mừng cưới đúng');

  // chạy lại không nhân đôi
  var r2 = importGoldWedding();
  ok_(r2.indexOf('0 lô vàng mới') >= 0, 'chạy lại không tạo thêm lô vàng');
  ok_(r2.indexOf('0 dòng sổ cưới') >= 0, 'chạy lại không tạo thêm dòng sổ cưới');
  eq_(readAll_('Transactions').length, txnBefore + 4, 'chạy lại không ghi thêm giao dịch mua vàng');
  eq_(readAll_('GoldLots').filter(isSeedGold).length, 9, 'vẫn đúng 9 lô, không nhân đôi');
  eq_(readAll_('WeddingGifts').filter(isSeedWedding).length, 487, 'vẫn đúng 487 dòng, không nhân đôi');
});

test_('Sự kiện: gắn vào Chi tiêu, không gắn được Thu nhập, khoá khi kết thúc, xoá bị khoá khi có giao dịch', function () {
  var m = asUser_(T_EMAIL_1);
  var ev = createEvent_(m, { name: 'Du lịch Đà Lạt', start_date: '2026-11-01', end_date: '2026-11-05' });
  eq_(readAll_('Events').filter(function (x) { return x.event_id === ev.event_id; })[0].status, 'ongoing', 'mặc định đang diễn ra');

  var t1 = exp_(m, 'W001', 200000, 'J1', { event_id: ev.event_id });
  eq_(lastTxn_().event_id, ev.event_id, 'giao dịch chi tiêu được gắn đúng sự kiện');

  // Thu nhập không nhận event_id (bị bỏ qua lặng lẽ vì spec.event_id chỉ được đọc ở nhánh 'expense').
  inc_(m, 'W001', 100000, { event_id: ev.event_id, category_id: '' });
  eq_(lastTxn_().event_id, '', 'thu nhập không gắn sự kiện (quyết định: sự kiện chỉ áp dụng Chi tiêu)');

  eq_(eventHasTxn_(ev.event_id), true, 'đã có giao dịch gắn vào');
  throws_(function () { deleteEvent_(m, { event_id: ev.event_id }); }, 'EVENT', 'không xoá được vì đã có giao dịch');
  updateEvent_(m, { event_id: ev.event_id, active: 0 });
  eq_(readAll_('Events').filter(function (x) { return x.event_id === ev.event_id; })[0].active, 0, 'vẫn ẩn được bình thường');
  updateEvent_(m, { event_id: ev.event_id, active: 1 });

  endEvent_(m, { event_id: ev.event_id });
  eq_(readAll_('Events').filter(function (x) { return x.event_id === ev.event_id; })[0].status, 'ended', 'đã kết thúc');
  throws_(function () { exp_(m, 'W001', 50000, 'J1', { event_id: ev.event_id }); }, 'EVENT', 'sự kiện đã kết thúc không gắn thêm được, dù chọn tay');

  var ev2 = createEvent_(m, { name: 'Chưa có giao dịch gì' });
  deleteEvent_(m, { event_id: ev2.event_id });
  eq_(readAll_('Events').filter(function (x) { return x.event_id === ev2.event_id; }).length, 0, 'xoá được vì chưa có giao dịch nào');
});

test_('Sự kiện: "bật tự gắn" theo từng thành viên (độc lập, không ảnh hưởng người khác), kết thúc sự kiện tự tắt cho mọi người đang bật', function () {
  var m1 = asUser_(T_EMAIL_1), m2 = asUser_(T_EMAIL_2);
  var evA = createEvent_(m1, { name: 'Về quê Tết A' });
  var evB = createEvent_(m1, { name: 'Về quê Tết B' });

  asUser_(T_EMAIL_1);
  setCurrentEvent_(m1, { event_id: evA.event_id });
  eq_(readAll_('Members').filter(function (x) { return x.member_id === m1.member_id; })[0].current_event_id, evA.event_id, 'member1 đã bật A');

  asUser_(T_EMAIL_2);
  setCurrentEvent_(m2, { event_id: evB.event_id });
  eq_(readAll_('Members').filter(function (x) { return x.member_id === m2.member_id; })[0].current_event_id, evB.event_id, 'member2 bật B độc lập');
  eq_(readAll_('Members').filter(function (x) { return x.member_id === m1.member_id; })[0].current_event_id, evA.event_id, 'member1 không bị ảnh hưởng');

  // Bật sự kiện mới tự tắt sự kiện cũ CỦA CHÍNH người đó.
  asUser_(T_EMAIL_1);
  setCurrentEvent_(m1, { event_id: evB.event_id });
  eq_(readAll_('Members').filter(function (x) { return x.member_id === m1.member_id; })[0].current_event_id, evB.event_id, 'bật B thì tự tắt A cho chính mình');

  // Kết thúc sự kiện B: tự tắt current_event_id của mọi người đang bật nó (cả member1 và member2).
  endEvent_(m1, { event_id: evB.event_id });
  eq_(readAll_('Members').filter(function (x) { return x.member_id === m1.member_id; })[0].current_event_id, '', 'member1 tự tắt vì B đã kết thúc');
  eq_(readAll_('Members').filter(function (x) { return x.member_id === m2.member_id; })[0].current_event_id, '', 'member2 cũng tự tắt vì B đã kết thúc');

  throws_(function () { setCurrentEvent_(m1, { event_id: evB.event_id }); }, 'EVENT', 'không bật lại được sự kiện đã kết thúc');
});

test_('Sự kiện: ngân sách dự kiến — tổng chi và còn lại/vượt tính đúng theo sự kiện', function () {
  var m = asUser_(T_EMAIL_1);
  var ev = createEvent_(m, { name: 'Du lịch Phú Quốc', planned_budget: 10000000 });
  exp_(m, 'W001', 4000000, 'J1', { event_id: ev.event_id });
  exp_(m, 'W001', 3000000, 'J2', { event_id: ev.event_id });
  exp_(m, 'W001', 1000000, 'J1', {}); // không gắn sự kiện, không được tính vào

  var detail = eventDetailView_(m, { event_id: ev.event_id });
  eq_(detail.total, 7000000, 'tổng chi đúng, không tính giao dịch không gắn sự kiện');
  eq_(detail.remaining, 3000000, 'còn lại = 10tr - 7tr');
  eq_(detail.transactions.length, 2, 'đúng 2 giao dịch gắn vào sự kiện này');
  var jarTotal = 0; detail.by_jar.forEach(function (x) { jarTotal += x.amount; });
  eq_(jarTotal, 7000000, 'tổng theo lọ khớp tổng chi');

  var view = eventsView_(m);
  var row = view.events.filter(function (x) { return x.event_id === ev.event_id; })[0];
  eq_(row.spent, 7000000, 'eventsView_ tính đúng tổng chi');
  eq_(row.remaining, 3000000, 'eventsView_ tính đúng còn lại');

  exp_(m, 'W001', 5000000, 'J1', { event_id: ev.event_id });
  eq_(eventDetailView_(m, { event_id: ev.event_id }).remaining, -2000000, 'vượt ngân sách thì còn lại là số âm');
});

test_('Nhập sự kiện cũ (ImportEvents) từ Excel: tạo sự kiện + gắn event_id vào giao dịch đã nhập trước đây, an toàn với chuỗi row_hash, chống trùng', function () {
  var m = asUser_(T_EMAIL_1);
  // Dựng sẵn 2 giao dịch "đã nhập từ trước" giống hệt cách Import.gs gắn idempotency_key.
  var r1 = exp_(m, 'W001', 300000, 'J1', { key: 'imp:finance:test_evt_1' });
  var r2 = exp_(m, 'W001', 150000, 'J1', { key: 'imp:finance:test_evt_2' });
  ok_(integrityScan_().ok, 'sổ cái sạch trước khi nhập sự kiện');

  var rows = [
    { source_ref: 'imp:event:test_unit_1', name: 'Du lịch Nha Trang (test)', start_date: '2023-01-01', end_date: '2023-01-03', status: 'ended', finance_ids: ['test_evt_1', 'test_evt_2'] }
  ];
  var res = importEventsCore_(m, rows);
  eq_(res.created.length, 1, 'tạo được 1 sự kiện mới');
  eq_(res.tagged, 2, 'gắn được đúng 2 giao dịch');
  var ev = readAll_('Events').filter(function (x) { return x.source_ref === 'imp:event:test_unit_1'; })[0];
  eq_(readAll_('Transactions').filter(function (t) { return t.idempotency_key === 'imp:finance:test_evt_1'; })[0].event_id, ev.event_id, 'giao dịch 1 đã được gắn đúng event_id');
  eq_(readAll_('Transactions').filter(function (t) { return t.idempotency_key === 'imp:finance:test_evt_2'; })[0].event_id, ev.event_id, 'giao dịch 2 đã được gắn đúng event_id');

  ok_(integrityScan_().ok, 'ghi bổ sung event_id vào dòng sổ cái đã tồn tại KHÔNG làm hỏng chuỗi row_hash chống sửa');

  // Chạy lại không nhân đôi: sự kiện đã có source_ref thì bỏ qua tạo mới, giao dịch đã có event_id thì bỏ qua gắn lại.
  var res2 = importEventsCore_(m, rows);
  eq_(res2.created.length, 0, 'chạy lại không tạo thêm sự kiện');
  eq_(res2.skipped.length, 1, 'bỏ qua sự kiện đã có source_ref trùng');
  eq_(res2.tagged, 0, 'chạy lại không gắn lại giao dịch đã có event_id');
  eq_(res2.tagged_skipped, 2, 'cả 2 giao dịch bị bỏ qua vì đã có event_id từ trước');
  eq_(readAll_('Events').filter(function (x) { return x.source_ref === 'imp:event:test_unit_1'; }).length, 1, 'không nhân đôi sự kiện trong sheet');
});

// ---------- runner ----------
function runAllTests() { return runTests_(null); }

function runTests_(onlyNames) {
  var saved = testEnvBegin_();
  var results = { pass: 0, fail: [] }, started = new Date().getTime();
  try {
    FF_TESTS.forEach(function (t) {
      if (onlyNames && onlyNames.indexOf(t.name) < 0) return;
      // tamper tests mutate sheets, so give each one a fresh environment
      var isolated = /^Toàn vẹn|^Thiết lập|^Dữ liệu nền|^Trigger|^Sao lưu|^Nhắc nhở|^Nhập Excel|^Chạy thiết lập/.test(t.name);
      var inner = null;
      if (isolated) { inner = testEnvBegin_(); }
      try { t.fn(); results.pass++; }
      catch (e) { results.fail.push(t.name + ' -> ' + (e && e.message || e)); }
      finally { if (isolated) testEnvEnd_(inner); }
    });
  } finally {
    testEnvEnd_(saved);
  }
  var secs = Math.round((new Date().getTime() - started) / 1000);
  var out = (results.fail.length ? 'THẤT BẠI' : 'TẤT CẢ ĐẠT') + ': ' + results.pass + ' đạt, ' + results.fail.length + ' lỗi (' + secs + 's)';
  if (results.fail.length) out += '\n' + results.fail.join('\n');
  Logger.log(out);
  return out;
}
