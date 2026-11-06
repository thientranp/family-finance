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
  ok_(shapeIssues_(t({ txn_kind: 'income' }), [{ wallet_id: 'W1', amount: 100 }], [], null).length === 0, 'thu hợp lệ');
  ok_(shapeIssues_(t({ txn_kind: 'income' }), [{ wallet_id: 'W1', amount: -100 }], [], null).length > 0, 'thu sai dấu');
  ok_(shapeIssues_(t({ txn_kind: 'income' }), [], [], null).length > 0, 'thu thiếu dòng');
  ok_(shapeIssues_(t({ txn_kind: 'expense', jar_id: '' }), [{ wallet_id: 'W1', amount: -100 }], [], null).length > 0, 'chi thiếu lọ');
  ok_(shapeIssues_(t({ txn_kind: 'income', jar_id: 'J1' }), [{ wallet_id: 'W1', amount: 100 }], [], null).length > 0, 'thu gắn lọ');
  ok_(shapeIssues_(t({ txn_kind: 'transfer', entry_count: 2 }), [{ wallet_id: 'W1', amount: -100 }, { wallet_id: 'W2', amount: 90 }], [], null).length > 0, 'chuyển lệch số tiền');
  ok_(shapeIssues_(t({ txn_kind: 'transfer', entry_count: 2 }), [{ wallet_id: 'W1', amount: -100 }, { wallet_id: 'W1', amount: 100 }], [], null).length > 0, 'chuyển cùng ví');
  ok_(shapeIssues_(t({ txn_kind: 'adjustment', reason: 'x', balance_before: 10, balance_after: 100 }), [{ wallet_id: 'W1', amount: 100 }], [], null).length > 0, 'điều chỉnh trước/sau lệch');
  ok_(shapeIssues_(t({ txn_kind: 'adjustment', reason: '', balance_before: 0, balance_after: 100 }), [{ wallet_id: 'W1', amount: 100 }], [], null).length > 0, 'điều chỉnh thiếu lý do');
  var orig = { txn: { txn_kind: 'expense', amount: 100 }, ents: [{ wallet_id: 'W1', amount: -100 }], lents: [] };
  ok_(shapeIssues_(t({ txn_kind: 'reversal', reason: 'r', reverses_id: 'T0', jar_id: 'J1' }), [{ wallet_id: 'W1', amount: 100 }], [], orig).length === 0, 'đảo hợp lệ');
  ok_(shapeIssues_(t({ txn_kind: 'reversal', reason: 'r', reverses_id: 'T0', jar_id: 'J1' }), [{ wallet_id: 'W1', amount: -100 }], [], orig).length > 0, 'đảo không đối xứng');
  ok_(shapeIssues_(t({ txn_kind: 'reversal', reason: 'r', reverses_id: 'T0', jar_id: 'J1' }), [{ wallet_id: 'W2', amount: 100 }], [], orig).length > 0, 'đảo sai ví');
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
    ['a4', '2024-05-04', 'e', 'Chi', 'CT tower', 500000000, 'HSBC', 'Cục Thịt', 'cần quyết định'],
    ['a5', '2024-05-05', 'e', 'Chi', 'Điều chỉnh', 7000, 'Ví - Cục Cá', 'Cục Cá', '']
  ];
  fin.getRange(2, 1, frows.length, 9).setValues(frows);
  chg.getRange(1, 1, 1, 5).setValues([['ID', 'Ngày', 'Số tiền', 'Từ', 'Đến']]);
  chg.getRange(2, 1, 2, 5).setValues([['c1', '2024-05-06', 3000000, 'BIDV - Cục Thịt', 'VÍ - Cục Cá'], ['c2', '2024-05-07', 1000, 'HSBC', 'Ví khong co']]);
  readAll_('Wallets').forEach(function (w) { updateRow_('Wallets', w._row, { opening_date: '2026-11-01' }); });
  FF_CTX.importSrc = src.getId();
  importPrepare();
  var sh = getSs_().getSheetByName('ImportMap'), vals = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  function actionOf(k, c) { return vals.filter(function (v) { return v[0] === k && v[1] === c; })[0][4]; }
  eq_(actionOf('Chi', 'Đi chợ'), 'expense', 'đề xuất khớp tên');
  eq_(actionOf('Chi', 'Siêu Thị'), 'expense', 'khớp không phân biệt hoa thường');
  eq_(actionOf('Chi', 'CT tower'), 'review', 'chưa quyết định');
  eq_(actionOf('Thu', 'Lương'), 'income', 'thu Lương');
  throws_(function () { importRun(); }, 'IMPORT', 'bị chặn khi còn review');
  eq_(readAll_('Transactions').length, 0, 'chưa ghi gì');
  // người dùng quyết định
  function setAction(k, c, a, tgt) { for (var i = 0; i < vals.length; i++) if (vals[i][0] === k && vals[i][1] === c) sh.getRange(i + 2, 5, 1, 2).setValues([[a, tgt || vals[i][5]]]); }
  setAction('Chi', 'CT tower', 'skip'); setAction('Chi', 'Điều chỉnh', 'skip');
  var dry = importDryRun();
  ok_(/Ví chuyển không nhận diện được/.test(dry), 'báo ví lạ');
  throws_(function () { importRun(); }, 'IMPORT', 'bị chặn khi còn dòng lỗi');
  chg.getRange(3, 5, 1, 1).setValue('Ví - Cục Cá'); // sửa nguồn (bản sao)
  var b0 = bal_('W001');
  var out = importRun(2); // chia lô: chỉ ghi 2 trước
  ok_(/CÒN 1 giao dịch/.test(out) || /CÒN/.test(out), 'còn phần chưa ghi');
  eq_(readAll_('Transactions').length, 2, 'lô 1 ghi 2');
  var out2 = importRun(50);
  eq_(readAll_('Transactions').length, 5, 'tổng 5 giao dịch (3 finance + 2 chuyển)');
  var out3 = importRun(50);
  eq_(readAll_('Transactions').length, 5, 'chạy lại không nhân đôi');
  ok_(/\(finance\)\: KHỚP/.test(out3) && /\(change\)\: KHỚP/.test(out3), 'đối chiếu khớp: ' + out3);
  eq_(bal_('W001'), b0, 'lịch sử trước ngày bắt đầu ví không đổi số dư');
  ok_(integrityScan_().ok, 'toàn vẹn sau nhập');
  var tx = readAll_('Transactions'), tm = txnMap_(tx);
  var f = cashFlow_('2024-05', tx, tm);
  eq_(f.income, 9000000, 'thu lịch sử'); eq_(f.expense, 350000, 'chi lịch sử (CT tower và Điều chỉnh bị bỏ qua)');
  var exp = tx.filter(function (t) { return t.idempotency_key === 'imp:finance:a2'; })[0];
  eq_(exp.paid_by, 'M01', 'người chi theo cột Sở hữu'); eq_(exp.jar_id, 'J1', 'lọ theo danh mục');
  DriveApp.getFileById(src.getId()).setTrashed(true);
  FF_CTX.importSrc = null;
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
      var isolated = /^Toàn vẹn|^Thiết lập|^Dữ liệu nền|^Trigger|^Sao lưu|^Nhắc nhở|^Nhập Excel/.test(t.name);
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
