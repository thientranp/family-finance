// Gold.gs - sổ vàng riêng: nhiều lô mua/bán độc lập (KHÔNG dùng chung với Assets.asset_type='gold').
// Mỗi lô ghi brand/số lượng/giá mua tại thời điểm tạo; việc mua thật sự trừ ví qua giao dịch
// gold_purchase, bán qua gold_sale (xem svcGoldBuy_/svcGoldSell_ trong Ledger.gs) — giống hệt mô
// hình Assets (tạo tài sản tách khỏi bút toán mua). Một lô bán nguyên lô (không bán lẻ theo chỉ).
var FF_V = FF_V || {};
FF_V.Gold = '0.3.0';

// purchase_value có thể = 0 (vàng được tặng/nhận từ đám cưới, không rõ giá mua) — vẫn tạo được lô để
// theo dõi số lượng, chỉ là sẽ không có bước "ghi giao dịch mua" nào gắn với lô này (vì hệ thống
// không cho tạo giao dịch 0đ).
function createGoldLot_(m, p) {
  return withLock_(function () {
    var row = {
      lot_id: nextCode_('GoldLots', 'lot_id', 'G', 3),
      brand: reqText_(p.brand, 'Thương hiệu / nơi mua', 1, 120),
      quantity: qty_(p.quantity, 'Số lượng (chỉ)', 100000),
      purchase_value: signed_(p.purchase_value === undefined || p.purchase_value === '' ? 0 : p.purchase_value, 'Giá mua'),
      purchase_date: ymd_(p.purchase_date, 'Ngày mua'), note: clip_(p.note, 300), active: 1,
      source_ref: p.source_ref ? clip_(p.source_ref, 60) : ''
    };
    if (row.purchase_value < 0) throw ffErr_('AMOUNT', 'Giá mua không được âm.');
    appendRows_('GoldLots', [row]);
    audit_('gold:create', row.lot_id, { brand: row.brand, quantity: row.quantity, value: row.purchase_value });
    return { lot_id: row.lot_id };
  });
}

// Nhập lô vàng cũ từ Excel — mỗi lô có source_ref riêng (vd "imp:gold:<ID cũ>"); chạy lại không nhân
// đôi (bỏ qua lô đã có source_ref trùng). rows: [{brand,quantity,purchase_value,purchase_date,note,
// source_ref}]. Trả về {created:[lot_id...], skipped:[source_ref...]}.
// Tách lõi (không tự khoá) để ImportGoldWedding.gs gọi được từ bên trong 1 withLock_ ngoài cùng của
// nó mà không bị khoá lồng khoá (LockService không tái vào được).
function importGoldLots_(m, p) { return withLock_(function () { return importGoldLotsCore_(m, p); }); }
function importGoldLotsCore_(m, p) {
    var existing = {};
    readAll_('GoldLots').forEach(function (g) { if (g.source_ref) existing[g.source_ref] = g.lot_id; });
    var created = [], skipped = [], rows = p.rows || [];
    var toAppend = [];
    rows.forEach(function (r) {
      if (r.source_ref && existing[r.source_ref]) { skipped.push(r.source_ref); return; }
      var row = {
        lot_id: '', // assigned below, once we know the full batch size
        brand: reqText_(r.brand, 'Thương hiệu / nơi mua', 1, 120),
        quantity: qty_(r.quantity, 'Số lượng (chỉ)', 100000),
        purchase_value: signed_(r.purchase_value === undefined || r.purchase_value === '' ? 0 : r.purchase_value, 'Giá mua'),
        purchase_date: ymd_(r.purchase_date, 'Ngày mua'), note: clip_(r.note, 300), active: 1,
        source_ref: r.source_ref ? clip_(r.source_ref, 60) : ''
      };
      toAppend.push(row);
      if (row.source_ref) existing[row.source_ref] = true;
    });
    // Assign real sequential lot_ids now that we know how many are being added in this batch.
    var base = 0;
    readAll_('GoldLots').forEach(function (g) { var mm = String(g.lot_id).match(/(\d+)$/); if (mm && +mm[1] > base) base = +mm[1]; });
    toAppend.forEach(function (row, i) {
      var n = String(base + i + 1); while (n.length < 3) n = '0' + n;
      row.lot_id = 'G' + n;
      created.push(row.lot_id);
    });
    if (toAppend.length) {
      appendRows_('GoldLots', toAppend);
      audit_('gold:import', '', { count: toAppend.length });
    }
    return { created: created, skipped: skipped };
}

// True if any transaction (buy or sell, even reversed) ever referenced this lot — gates hard-delete
// the same way assetHasTxn_ does for Assets.
function goldLotHasTxn_(lotId) {
  return readAll_('Transactions').some(function (t) {
    return t.ref_id === lotId && (t.txn_kind === 'gold_purchase' || t.txn_kind === 'gold_sale');
  });
}

function updateGoldLot_(m, p) {
  return withLock_(function () {
    var g = goldLotOrThrow_(p.lot_id);
    var patch = {};
    if (p.brand !== undefined) patch.brand = reqText_(p.brand, 'Thương hiệu / nơi mua', 1, 120);
    if (p.note !== undefined) patch.note = clip_(p.note, 300);
    if (p.active !== undefined) patch.active = p.active ? 1 : 0;
    if (p.quantity !== undefined) patch.quantity = qty_(p.quantity, 'Số lượng (chỉ)', 100000);
    if (p.purchase_value !== undefined) {
      patch.purchase_value = signed_(p.purchase_value, 'Giá mua');
      if (patch.purchase_value < 0) throw ffErr_('AMOUNT', 'Giá mua không được âm.');
    }
    updateRow_('GoldLots', g._row, patch);
    audit_('gold:update', g.lot_id, { before: { brand: g.brand, quantity: g.quantity, value: g.purchase_value, active: g.active }, patch: patch });
    return { lot_id: g.lot_id };
  });
}

function deleteGoldLot_(m, p) {
  return withLock_(function () {
    var g = goldLotOrThrow_(p.lot_id);
    if (goldLotHasTxn_(g.lot_id)) throw ffErr_('GOLD', 'Lô vàng này đã có giao dịch (mua/bán) — không xoá được, chỉ có thể ẩn.');
    deleteRow_('GoldLots', g._row);
    audit_('gold:delete', g.lot_id, { brand: g.brand });
    return { ok: true };
  });
}

function goldLotsView_() {
  var st = buildState_();
  var lots = readAll_('GoldLots').map(function (g) {
    return {
      lot_id: g.lot_id, brand: g.brand, quantity: g.quantity, purchase_value: g.purchase_value,
      purchase_date: g.purchase_date, note: g.note, active: g.active,
      sold: !!st.goldSale[g.lot_id], has_txn: goldLotHasTxn_(g.lot_id)
    };
  });
  var totalQuantity = 0, totalValue = 0;
  lots.forEach(function (g) { if (g.active === 1 && !g.sold) { totalQuantity += g.quantity; totalValue += g.purchase_value; } });
  return { lots: lots, summary: { total_quantity: totalQuantity, total_value: totalValue } };
}

// Tổng giá trị vàng đang giữ (lô chưa bán, đang active) theo giá mua — dùng để cộng vào Tài sản ròng,
// cùng triết lý với Assets: "không tự định giá lại", dùng giá mua đã nhập.
function goldHoldingsValue_(st) {
  var total = 0;
  readAll_('GoldLots').forEach(function (g) {
    if (g.active === 1 && !st.goldSale[g.lot_id]) total += g.purchase_value;
  });
  return total;
}
