// ══════════════════════════════════════════════════════════════
//  THE DREAM RESIDENCY — Google Apps Script (Production v5.2)
//
//  UPDATED IN v5.2:
//    • Booking IDs are now RANDOM 4-digit numbers (1000–9999).
//      No more sequential counter — every booking (manual OR
//      website) gets a unique random ID that is checked against
//      ALL existing sheets + Dump before being assigned, so
//      duplicates are impossible.
//    • Website bookings previously all showed "1" as Booking ID
//      because the webhook trusted whatever the site sent. Fixed:
//      the webhook now ALWAYS generates a fresh unique ID and
//      ignores whatever Booking ID the website payload contains.
//    • _BookingCounter sheet is no longer used. It can be deleted
//      manually from the spreadsheet (leaving it causes no harm).
//    • peekNextBookingId() now returns a random sample preview
//      (the real ID is assigned fresh on actual submit, so the
//      preview number may differ — that is expected and correct).
//
//  CARRIED OVER FROM v5.1:
//    • Goodbye-email delay is GOODBYE_DELAY_MINUTES (default 5).
//    • Confirmation + goodbye email tables are responsive.
//    • Status dropdown includes "checked_in" and "checked_out".
//    • "checked_out" schedules a thank-you / Google-review email.
//    • Confirmation email hotel address is a clickable Maps link.
//    • Scheduled goodbye triggers tracked in _PendingCheckouts.
//
//  ONE-TIME SETUP (run in order after pasting this script):
//    1. Open Apps Script editor → Run → "initialSetup"
//    2. Approve all permission prompts.
//    3. Done. Everything else is automatic.
//
//  MANUAL UTILITIES (🏨 Dream Residency menu):
//    • "🔧 One-Time Setup (Run First!)"
//    • "➕ Add Manual Booking"
//    • "🗑️ Delete Selected Row"
//    • "🔒 Lock Confirmed Rows"
//    • "✅ Apply Dropdowns (All Sheets)"
//    • "🔄 Refresh Dashboard"
//    • "🔢 Fix Phone Formatting"
//    • "📧 Send Goodbye Email Now (Test)"
//    • "🔁 Force-Reset Edit Trigger (Fix)"
// ══════════════════════════════════════════════════════════════


// ── CONFIG ─────────────────────────────────────────────────────
var PORTAL_URL     = 'https://the-dream-residency-v5.onrender.com';
var WEBHOOK_SECRET = 'dream-sheets-secret';

// ── USERS WHO CAN DELETE ROWS AND EDIT CONFIRMED BOOKINGS ──────
var AUTHORISED_DELETERS = [
  'amitjha84700@gmail.com',
  'harshraia@gmail.com'
];

// ── ROOM TYPES & PRICING ───────────────────────────────────────
var ROOM_TYPES = [
  { name: 'Twin Bed', price: 0 },
  { name: 'Suite',    price: 0 },
  { name: 'Deluxe',   price: 0 }
];

// ── HOTEL CONTACT / LOCATION INFO ───────────────────────────────
var HOTEL_NAME    = 'The Dream Residency';
var HOTEL_EMAIL   = 'thedreamresidency.mumbai@gmail.com';
var HOTEL_PHONE   = '+91-9324796576';
var HOTEL_ADDRESS_TEXT = 'Gala No.13, Navjivan Society, Saki Vihar Road, Near Sakinaka Metro, Sakinaka, Andheri East, Mumbai - 400072';

var HOTEL_MAPS_DIRECTIONS_URL =
  'https://www.google.com/maps/dir//The+Dream+Residency,+The+Dream+Residency,+Plot+No+13,+Opposite+Ansa+Industrial+Estate+(G-Wing),+Saki+Vihar+Road,+Near+Sakinaka+Metro+Station,+On+the+Powai%E2%80%93Sakinaka,+main+road+route,+near+L%26T+Gate,+Navajeevan+Society,+Saki+Naka,+Mumbai,+Maharashtra+400072/@19.1090072,72.8876171,17z/data=!4m19!1m10!3m9!1s0x3be7c9d2cb7aaf55:0x9b8707ce1e814550!2sThe+Dream+Residency!5m2!4m1!1i2!8m2!3d19.1090072!4d72.8876171!16s%2Fg%2F11tjg7m6x3!4m7!1m0!1m5!1m1!1s0x3be7c9d2cb7aaf55:0x9b8707ce1e814550!2m2!1d72.8876171!2d19.1090072?entry=ttu&g_ep=EgoyMDI2MDYxNi4wIKXMDSoASAFQAw%3D%3D';

var HOTEL_GOOGLE_REVIEW_URL =
  'https://g.page/r/CVBFgR7OB4ebEBM/review';

var HOTEL_LOGO_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAEeAbgDASIAAhEBAxEB/8QAHQABAAMAAgMBAAAAAAAAAAAAAAYHCAQFAQMJAv/EAF0QAAEDAwICBgQGDQcFDwQDAAECAwQABREGBxIhCBMxQVFhFCJxgRUyN3WRoRYjQlJWYnKClbGys9Mzc3SSk8HRFzVDotIYJDQ2OERTVGN2g4WUtMMlJifwVcLh/8QAGwEBAAIDAQEAAAAAAAAAAAAAAAQFAgMGAQf/xAA7EQABAwIDBQMLBAMAAgMAAAABAAIDBBEFITESE0FRYXGBsQYUIjIzkaHB0eHwFTRS8SNCciRTYoKy/9oADAMBAAIRAxEAPwDKNKUrJYpSlKIlKUoiUpSiJSlKIlKUoiUpSiJSlKIlKUoiUpSiJSlKIlKUoiUpSiL2xJMmI+H4kl6O6AQHGXChQz28wQa9a1KWtS1qUtajlSlHJJ8ST2mvFK8svUpSlerxKUpREpSlESlKURKUpREpSlESlKURKUpREpSlESlKURKUpREpSlESlKURKUpREpSlESlKURf/2Q==';

// ── COLUMN DEFINITIONS ─────────────────────────────────────────
var HEADERS = [
  'Booking ID',        // col 1
  'Submitted Date',    // col 2
  'Full Name',         // col 3
  'Email',             // col 4
  'Phone',             // col 5
  'Guests',            // col 6
  'Rooms Required',    // col 7
  'Room Type',         // col 8
  'Room Number',       // col 9
  'Check-In Date',     // col 10
  'Check-Out Date',    // col 11
  'Nights',            // col 12
  'Total Amount (₹)',  // col 13
  'Status',            // col 14
  'Notes',             // col 15
  'Source'             // col 16
];

var MONTH_NAMES   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var STATUS_COL    = 14;
var SOURCE_COL    = 16;
var DUMP_SHEET_NAME = '🗑️ Dump';
var DUMP_EXTRA_HEADERS = ['Deleted By', 'Deleted At', 'Deleted From Sheet'];

var PENDING_CHECKOUTS_SHEET = '_PendingCheckouts';

// ═══════════════════════════════════════════════════════════════
//  ⏱  GOODBYE EMAIL DELAY
// ═══════════════════════════════════════════════════════════════
var GOODBYE_DELAY_MINUTES = 5;


// ═══════════════════════════════════════════════════════════════
//  SAFE ALERT HELPER
// ═══════════════════════════════════════════════════════════════

function _safeAlert(msg) {
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    // Running from script editor — UI not available.
  }
}


// ═══════════════════════════════════════════════════════════════
//  ONE-TIME INITIAL SETUP
// ═══════════════════════════════════════════════════════════════

function initialSetup() {
  Logger.log('=== Dream Residency Setup Starting ===');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var failedSteps = [];

  // 1. Install the handleEdit installable trigger
  try {
    _installHandleEditTrigger();
    Logger.log('✅ Step 1/5 — Trigger installed');
  } catch (err) {
    failedSteps.push('1 (Trigger install)');
    Logger.log('❌ Step 1/5 FAILED — Trigger install: ' + err.message);
  }

  // 2. (Counter sheet no longer used — Booking IDs are now random 4-digit)
  Logger.log('✅ Step 2/5 — Skipped (counter replaced by random ID generator)');

  // 3. Ensure Dump sheet exists at the end
  try {
    getOrCreateDumpSheet(ss);
    Logger.log('✅ Step 3/5 — Dump sheet ready');
  } catch (err) {
    failedSteps.push('3 (Dump sheet)');
    Logger.log('❌ Step 3/5 FAILED — Dump sheet: ' + err.message);
  }

  // 4. Ensure Dashboard sheet exists
  try {
    _ensureDashboard(ss);
    Logger.log('✅ Step 4/5 — Dashboard ready');
  } catch (err) {
    failedSteps.push('4 (Dashboard)');
    Logger.log('❌ Step 4/5 FAILED — Dashboard: ' + err.message);
  }

  // 5. Ensure _PendingCheckouts hidden sheet exists
  try {
    _ensurePendingCheckoutsSheet(ss);
    Logger.log('✅ Step 5/5 — PendingCheckouts sheet ready');
  } catch (err) {
    failedSteps.push('5 (PendingCheckouts)');
    Logger.log('❌ Step 5/5 FAILED — PendingCheckouts: ' + err.message);
  }

  if (failedSteps.length) {
    Logger.log('=== Setup finished WITH ERRORS in step(s): ' + failedSteps.join(', ') + ' ===');
  } else {
    Logger.log('=== Setup Complete! Reload your spreadsheet. ===');
  }
}

function _installHandleEditTrigger() {
  var triggers = [];
  try {
    triggers = ScriptApp.getProjectTriggers();
  } catch (err) {
    Logger.log('⚠️ Could not list project triggers: ' + err.message);
  }

  var removed = 0, skipped = 0;
  triggers.forEach(function(t) {
    try {
      if (t.getHandlerFunction() === 'handleEdit') {
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    } catch (err) {
      skipped++;
      Logger.log('⚠️ Skipped a trigger we don\'t own: ' + err.message);
    }
  });
  Logger.log('Old handleEdit triggers removed: ' + removed + (skipped ? (', skipped: ' + skipped) : ''));

  var alreadyHaveOurs = false;
  try {
    ScriptApp.getProjectTriggers().forEach(function(t) {
      try {
        if (t.getHandlerFunction() === 'handleEdit') alreadyHaveOurs = true;
      } catch (e) {}
    });
  } catch (err) {
    Logger.log('⚠️ Could not re-check triggers: ' + err.message);
  }

  if (!alreadyHaveOurs) {
    ScriptApp.newTrigger('handleEdit')
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onEdit()
      .create();
    Logger.log('✅ handleEdit trigger created');
  } else {
    Logger.log('✅ handleEdit trigger already present — skipped');
  }
}

function forceResetHandleEditTrigger() {
  var triggers = [];
  try {
    triggers = ScriptApp.getProjectTriggers();
  } catch (err) {
    _safeAlert('❌ Could not list triggers: ' + err.message);
    return;
  }

  var removed = 0, skipped = 0;
  triggers.forEach(function(t) {
    try {
      if (t.getHandlerFunction() === 'handleEdit') {
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    } catch (err) {
      skipped++;
    }
  });

  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  _safeAlert('✅ Edit trigger rebuilt.\nRemoved: ' + removed + '\nCreated: 1 fresh handleEdit trigger.');
}

function _ensureDashboard(ss) {
  var dash = ss.getSheetByName('Dashboard');
  if (!dash) {
    dash = ss.insertSheet('Dashboard', 0);
    dash.getRange('A1').setValue('Dashboard').setFontWeight('bold').setFontSize(14);
    dash.getRange('A2').setValue('Last updated: ' + new Date().toLocaleString());
  }
  return dash;
}

function _ensurePendingCheckoutsSheet(ss) {
  var sheet = ss.getSheetByName(PENDING_CHECKOUTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PENDING_CHECKOUTS_SHEET);
    sheet.appendRow(['TriggerUID', 'SheetName', 'Row', 'BookingID', 'ScheduledFor', 'Status']);
    sheet.hideSheet();
  }
  return sheet;
}


// ═══════════════════════════════════════════════════════════════
//  BOOKING ID GENERATOR  ← UPDATED IN v5.2
//
//  Random 4-digit number (1000–9999), unique across ALL sheets
//  including the Dump sheet so deleted IDs are never reused.
// ═══════════════════════════════════════════════════════════════

/**
 * Returns a set (plain object keyed by ID string) of every Booking ID
 * that already exists across all sheets, so we never assign a duplicate.
 */
function _getAllExistingBookingIds(ss) {
  var used   = {};
  var sheets = ss.getSheets();
  var SKIP   = ['Dashboard', '_BookingCounter', PENDING_CHECKOUTS_SHEET];
  var idCol  = HEADERS.indexOf('Booking ID') + 1;

  sheets.forEach(function(sheet) {
    if (SKIP.indexOf(sheet.getName()) !== -1 || sheet.isSheetHidden()) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var vals = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
    vals.forEach(function(r) {
      var v = String(r[0]).trim();
      if (v) used[v] = true;
    });
  });

  // Also scan the Dump sheet so deleted IDs are never reused
  var dumpSheet = ss.getSheetByName(DUMP_SHEET_NAME);
  if (dumpSheet) {
    var lastRow = dumpSheet.getLastRow();
    if (lastRow >= 2) {
      var vals = dumpSheet.getRange(2, idCol, lastRow - 1, 1).getValues();
      vals.forEach(function(r) {
        var v = String(r[0]).trim();
        if (v) used[v] = true;
      });
    }
  }
  return used;
}

/**
 * Generates a random unique 4-digit Booking ID (1000–9999).
 * Retries up to 50 times to avoid any collision.
 */
function getNextBookingId() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var usedIds = _getAllExistingBookingIds(ss);

  for (var attempt = 0; attempt < 50; attempt++) {
    var candidate = String(Math.floor(1000 + Math.random() * 9000));
    if (!usedIds[candidate]) return candidate;
  }
  throw new Error('Could not generate a unique Booking ID after 50 attempts. Check for stale data.');
}

/**
 * Returns a sample random ID for the dialog preview.
 * The real unique ID is assigned fresh on actual submit, so this
 * preview number may differ — that is intentional and correct.
 */
function peekNextBookingId() {
  return String(Math.floor(1000 + Math.random() * 9000));
}


// ═══════════════════════════════════════════════════════════════
//  DUMP SHEET
// ═══════════════════════════════════════════════════════════════

function getOrCreateDumpSheet(ss) {
  var sheet = ss.getSheetByName(DUMP_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DUMP_SHEET_NAME, ss.getNumSheets());
    _styleDumpSheet(sheet);
  }
  return sheet;
}

function _styleDumpSheet(sheet) {
  var allHeaders = HEADERS.concat(DUMP_EXTRA_HEADERS);
  sheet.clearContents();
  sheet.appendRow(allHeaders);

  var hRange = sheet.getRange(1, 1, 1, allHeaders.length);
  hRange.setFontWeight('bold')
    .setBackground('#5c1a1a')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setFontSize(10);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
}

function _dumpRow(sheet, row, userEmail) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var rowData  = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  var dumpSheet = getOrCreateDumpSheet(ss);

  var dumpRow = rowData.concat([
    userEmail,
    new Date().toLocaleString(),
    sheet.getName()
  ]);

  dumpSheet.appendRow(dumpRow);
  var dumpLastRow = dumpSheet.getLastRow();
  dumpSheet.getRange(dumpLastRow, 1, 1, dumpRow.length)
    .setBackground('#f5f5f5')
    .setFontColor('#888888');

  sheet.getRange(row, 1, 1, HEADERS.length).clearContent().clearFormat();
  sheet.getRange(row, 1, 1, HEADERS.length).setBackground('#ffffff');
  unprotectRow(sheet, row);
  _cancelPendingGoodbye(sheet.getName(), row);
}


// ═══════════════════════════════════════════════════════════════
//  ROLE-GATED DELETE
// ═══════════════════════════════════════════════════════════════

function deleteSelectedBooking() {
  var userEmail = Session.getActiveUser().getEmail().toLowerCase();

  if (AUTHORISED_DELETERS.indexOf(userEmail) === -1) {
    SpreadsheetApp.getUi().alert(
      '⛔ Access Denied',
      'Only authorised users can delete bookings.\n\nYour email: ' + userEmail,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  var ss        = SpreadsheetApp.getActiveSpreadsheet();
  var sheet     = ss.getActiveSheet();
  var sheetName = sheet.getName();

  var SKIP = ['Dashboard', DUMP_SHEET_NAME, '_BookingCounter', PENDING_CHECKOUTS_SHEET];
  if (SKIP.indexOf(sheetName) !== -1) {
    SpreadsheetApp.getUi().alert('Cannot delete rows from this sheet.');
    return;
  }

  var row = sheet.getActiveCell().getRow();
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('Please select a data row (not the header).');
    return;
  }

  var confirm = SpreadsheetApp.getUi().alert(
    '🗑️ Confirm Delete',
    'Move row ' + row + ' to the Dump sheet? This cannot be undone.',
    SpreadsheetApp.getUi().ButtonSet.YES_NO
  );
  if (confirm !== SpreadsheetApp.getUi().Button.YES) return;

  _dumpRow(sheet, row, userEmail);
  sheet.deleteRow(row);
  refreshDashboard(ss);

  SpreadsheetApp.getUi().alert('✅ Row moved to Dump sheet successfully.');
}


// ═══════════════════════════════════════════════════════════════
//  MANUAL BOOKING DIALOG
// ═══════════════════════════════════════════════════════════════

function showManualBookingDialog() {
  var html = HtmlService.createHtmlOutput(_getManualBookingHtml())
    .setWidth(560)
    .setHeight(780)
    .setTitle('➕ Add Manual Booking');
  SpreadsheetApp.getUi().showModalDialog(html, '➕ Add Manual Booking');
}

function submitManualBooking(formData) {
  if (!formData.name || !String(formData.name).trim()) {
    throw new Error('Full Name is required.');
  }
  var phoneDigits = String(formData.phone || '').replace(/\D/g, '');
  if (phoneDigits.length !== 10) {
    throw new Error('Phone number must be exactly 10 digits (numbers only).');
  }
  formData.phone = phoneDigits;

  if (formData.email && String(formData.email).trim()) {
    var em = String(formData.email).toLowerCase().trim();
    if (em.indexOf('@') === -1 || em.indexOf('.com') === -1) {
      throw new Error('Please enter a valid email address (must contain @ and .com).');
    }
  }

  if (formData.checkIn && formData.checkOut) {
    var ci = new Date(formData.checkIn);
    var co = new Date(formData.checkOut);
    if (!isNaN(ci) && !isNaN(co) && co < ci) {
      throw new Error('Check-Out date cannot be before Check-In date.');
    }
  }

  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var tabName = currentMonthTabName();
  var sheet   = getOrCreateMonthSheet(ss, tabName);

  var bookingId = getNextBookingId();
  var today     = new Date();
  var nights    = calculateNights(formData.checkIn, formData.checkOut);

  var rowData = {
    'Booking ID':       bookingId,
    'Submitted Date':   Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    'Full Name':        String(formData.name        || '').trim(),
    'Email':            String(formData.email       || '').trim(),
    'Phone':            formData.phone,
    'Guests':           formData.guests      || 1,
    'Rooms Required':   formData.rooms       || 1,
    'Room Type':        formData.roomType    || '',
    'Room Number':      formData.roomNumber  || '',
    'Check-In Date':    formData.checkIn     || '',
    'Check-Out Date':   formData.checkOut    || '',
    'Nights':           nights !== '' ? nights : (formData.nights || ''),
    'Total Amount (₹)': formData.total       || '',
    'Status':           formData.status      || 'pending',
    'Notes':            formData.notes       || '',
    'Source':           formData.source      || 'Manual'
  };

  appendBookingRow(sheet, rowData);

  var savedRow    = sheet.getLastRow();
  var statusLower = String(rowData['Status']).toLowerCase();

  if (statusLower === 'confirmed') {
    protectConfirmedRow(sheet, savedRow);
    if (rowData['Email']) {
      sendConfirmationEmail({
        name:     rowData['Full Name'],
        email:    rowData['Email'],
        phone:    rowData['Phone'],
        guests:   rowData['Guests'],
        roomType: rowData['Room Type'],
        roomNum:  rowData['Room Number'],
        checkIn:  rowData['Check-In Date'],
        checkOut: rowData['Check-Out Date'],
        total:    rowData['Total Amount (₹)']
      });
    }
  } else if (statusLower === 'checked_out') {
    _scheduleGoodbyeEmail(sheet, savedRow, rowData);
  }

  try { refreshDashboard(ss); } catch(e) {}

  return { ok: true, bookingId: bookingId, name: rowData['Full Name'] };
}

function calculateNights(checkInStr, checkOutStr) {
  if (!checkInStr || !checkOutStr) return '';
  var inDate  = new Date(checkInStr);
  var outDate = new Date(checkOutStr);
  if (isNaN(inDate) || isNaN(outDate)) return '';
  var diff = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : '';
}


// ── HTML for the manual booking dialog ─────────────────────────

function _getManualBookingHtml() {
  var nextId = peekNextBookingId();

  var roomTypeOptionsHtml = ROOM_TYPES.map(function(rt) {
    return '<option value="' + rt.name + '">' + rt.name + '</option>';
  }).join('');

  var roomPriceMapJson = JSON.stringify(
    ROOM_TYPES.reduce(function(acc, rt) { acc[rt.name] = rt.price; return acc; }, {})
  );

  var today  = new Date();
  var todayY = today.getFullYear();
  var todayM = today.getMonth();
  var todayD = today.getDate();

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:13px;padding:16px 18px;background:#f9fafb;margin:0;}' +
    'h3{color:#1a3a5c;margin:0 0 12px;}' +
    'label{display:block;margin-top:10px;font-weight:bold;color:#1a3a5c;}' +
    'input,select,textarea{width:100%;padding:7px 9px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;margin-top:3px;font-size:13px;font-family:Arial,sans-serif;}' +
    'input:disabled,input[readonly]{background:#eef1f4;color:#5a6b7d;font-weight:bold;cursor:not-allowed;}' +
    'textarea{height:58px;resize:vertical;}' +
    '.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}' +
    '.err{color:#c0392b;font-size:11px;margin-top:3px;display:none;}' +
    '.hint{font-weight:normal;font-size:11px;color:#888;margin-top:2px;}' +
    'button.submit-btn{margin-top:16px;width:100%;padding:10px;background:#1a3a5c;color:#fff;border:none;border-radius:5px;font-size:14px;cursor:pointer;}' +
    'button.submit-btn:hover{background:#0f2540;}' +
    '#msg{margin-top:10px;text-align:center;font-weight:bold;}' +
    '.dateWrap{position:relative;}' +
    '.calPopup{display:none;position:absolute;top:calc(100% + 4px);left:0;z-index:100;background:#fff;border:1px solid #cbd5e0;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.15);padding:10px;width:234px;}' +
    '.calPopup.open{display:block;}' +
    '.calHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}' +
    '.calHead button{all:unset;cursor:pointer;padding:4px 8px;border-radius:4px;font-weight:bold;color:#1a3a5c;margin:0;width:auto;}' +
    '.calHead button:hover{background:#eef1f4;}' +
    '.calTitle{font-weight:bold;color:#1a3a5c;font-size:12px;}' +
    '.calGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;}' +
    '.calGrid .dow{font-size:10px;color:#888;font-weight:bold;padding:2px 0;}' +
    '.calGrid .day{font-size:12px;padding:5px 0;border-radius:4px;cursor:pointer;}' +
    '.calGrid .day:hover:not(.disabled){background:#dce6f0;}' +
    '.calGrid .day.empty,.calGrid .day.disabled{cursor:default;color:#ccc;}' +
    '.calGrid .day.disabled:hover{background:none;}' +
    '.calGrid .day.today{outline:1px solid #c9a96e;}' +
    '.calGrid .day.selected{background:#1a3a5c;color:#fff;}' +
    '</style></head><body>' +
    '<h3>Manual Booking Entry</h3>' +

    '<div class="row2">' +
    '<label>Booking ID<input id="bookingId" value="' + nextId + '" readonly><div class="hint">final ID assigned on save</div></label>' +
    '<label>Source<select id="source">' +
    '<option value="Manual" selected>Manual</option>' +
    '<option value="Website">Website</option>' +
    '</select></label>' +
    '</div>' +

    '<label>Full Name *<input id="name" placeholder="e.g. Rahul Sharma"><div class="err" id="err_name">Name is required.</div></label>' +

    '<div class="row2">' +
    '<label>Email<input id="email" type="email" placeholder="guest@gmail.com"><div class="err" id="err_email">Must contain @ and .com</div></label>' +
    '<label>Phone * (10 digits)<input id="phone" placeholder="9876543210" maxlength="10"><div class="err" id="err_phone">Exactly 10 digits required.</div></label>' +
    '</div>' +

    '<div class="row2">' +
    '<label>Guests<input id="guests" type="number" min="1" value="1"></label>' +
    '<label>Rooms Required<input id="rooms" type="number" min="1" value="1"></label>' +
    '</div>' +

    '<div class="row2">' +
    '<label>Room Type<select id="roomType" onchange="recalcTotal()">' +
    '<option value="" disabled selected>Select room type</option>' +
    roomTypeOptionsHtml +
    '</select></label>' +
    '<label>Room Number<input id="roomNumber" placeholder="e.g. 204"></label>' +
    '</div>' +

    '<div class="row2">' +
    '<label>Check-In Date *' +
    '<div class="dateWrap">' +
    '<input id="checkIn" placeholder="Click to select" readonly onclick="toggleCal(\'checkIn\')" style="cursor:pointer;">' +
    '<div class="calPopup" id="calPopup_checkIn"></div>' +
    '</div>' +
    '<div class="err" id="err_checkIn">Please select a check-in date.</div>' +
    '</label>' +
    '<label>Check-Out Date *' +
    '<div class="dateWrap">' +
    '<input id="checkOut" placeholder="Click to select" readonly onclick="toggleCal(\'checkOut\')" style="cursor:pointer;">' +
    '<div class="calPopup" id="calPopup_checkOut"></div>' +
    '</div>' +
    '<div class="err" id="err_checkOut">Must be on or after Check-In.</div>' +
    '</label>' +
    '</div>' +

    '<div class="row2">' +
    '<label>Nights<input id="nights" readonly placeholder="auto"><div class="hint">auto-calculated</div></label>' +
    '<label>Total Amount (₹)<input id="total" type="number" min="0" placeholder="0"></label>' +
    '</div>' +

    '<label>Status' +
    '<select id="status">' +
    '<option value="pending" selected>Pending</option>' +
    '<option value="confirmed">Confirmed</option>' +
    '<option value="checked_in">Checked In</option>' +
    '<option value="checked_out">Checked Out</option>' +
    '<option value="cancelled">Cancelled</option>' +
    '</select>' +
    '<div class="hint">Confirmed locks the row + sends a confirmation email. Checked Out schedules a thank-you email 5 minutes later.</div>' +
    '</label>' +

    '<label>Notes<textarea id="notes" placeholder="Any special requests or remarks..."></textarea></label>' +
    '<button class="submit-btn" onclick="submitForm()">✅ Add Booking</button>' +
    '<div id="msg"></div>' +

    '<script>' +
    'var ROOM_PRICE_MAP=' + roomPriceMapJson + ';' +
    'var TODAY_Y=' + todayY + ', TODAY_M=' + todayM + ', TODAY_D=' + todayD + ';' +
    'var calView={checkIn:{y:TODAY_Y,m:TODAY_M},checkOut:{y:TODAY_Y,m:TODAY_M}};' +
    'var DOWS=["Su","Mo","Tu","We","Th","Fr","Sa"];' +
    'var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];' +
    'function pad2(n){return n<10?"0"+n:""+n;}' +
    'function fmt(y,m,d){return y+"-"+pad2(m+1)+"-"+pad2(d);}' +
    'function toggleCal(id){' +
    '  var popup=document.getElementById("calPopup_"+id);' +
    '  var isOpen=popup.classList.contains("open");' +
    '  document.querySelectorAll(".calPopup").forEach(function(p){p.classList.remove("open");});' +
    '  if(isOpen) return;' +
    '  if(id==="checkOut"){' +
    '    var ciVal=document.getElementById("checkIn").value;' +
    '    if(ciVal){var parts=ciVal.split("-");calView.checkOut={y:parseInt(parts[0]),m:parseInt(parts[1])-1};}' +
    '  }' +
    '  renderCal(id);popup.classList.add("open");' +
    '}' +
    'function renderCal(id){' +
    '  var popup=document.getElementById("calPopup_"+id);' +
    '  var year=calView[id].y, month=calView[id].m;' +
    '  var firstDay=new Date(year,month,1).getDay();' +
    '  var daysInMonth=new Date(year,month+1,0).getDate();' +
    '  var ciVal=document.getElementById("checkIn").value;' +
    '  var minStr=(id==="checkOut" && ciVal) ? ciVal : fmt(TODAY_Y,TODAY_M,TODAY_D);' +
    '  var selectedVal=document.getElementById(id).value;' +
    '  var html="";' +
    '  html+=\'<div class="calHead">\';' +
    '  html+=\'<button type="button" onclick="navMonth(\\\'\'+id+\'\\\', -1)">&#8249;</button>\';' +
    '  html+=\'<span class="calTitle">\'+MONTHS[month]+" "+year+\'</span>\';' +
    '  html+=\'<button type="button" onclick="navMonth(\\\'\'+id+\'\\\', 1)">&#8250;</button>\';' +
    '  html+=\'</div><div class="calGrid">\';' +
    '  DOWS.forEach(function(d){html+=\'<div class="dow">\'+d+"</div>";});' +
    '  for(var i=0;i<firstDay;i++){html+=\'<div class="day empty"></div>\';}' +
    '  for(var day=1;day<=daysInMonth;day++){' +
    '    var thisStr=fmt(year,month,day);' +
    '    var cls="day";' +
    '    if(thisStr===fmt(TODAY_Y,TODAY_M,TODAY_D)) cls+=" today";' +
    '    if(thisStr===selectedVal) cls+=" selected";' +
    '    if(thisStr<minStr) cls+=" disabled";' +
    '    if(cls.indexOf("disabled")===-1){' +
    '      html+=\'<div class="\'+cls+\'" onclick="pickDate(\\\'\'+id+\'\\\',\'+year+\',\'+month+\',\'+day+\')">\'+ day +"</div>";' +
    '    } else {html+=\'<div class="\'+cls+\'">\'+day+"</div>";}' +
    '  }' +
    '  html+="</div>";popup.innerHTML=html;' +
    '}' +
    'function navMonth(id,delta){' +
    '  var v=calView[id];var newM=v.m+delta;var newY=v.y;' +
    '  if(newM>11){newM=0;newY++;}if(newM<0){newM=11;newY--;}' +
    '  calView[id]={y:newY,m:newM};renderCal(id);' +
    '}' +
    'function pickDate(id,year,month,day){' +
    '  var str=fmt(year,month,day);' +
    '  document.getElementById(id).value=str;' +
    '  document.getElementById("calPopup_"+id).classList.remove("open");' +
    '  if(id==="checkIn"){var coVal=document.getElementById("checkOut").value;if(coVal&&coVal<str){document.getElementById("checkOut").value="";}}' +
    '  recalcNights();showErr("err_checkIn",false);showErr("err_checkOut",false);' +
    '}' +
    'document.addEventListener("click",function(e){if(!e.target.closest(".dateWrap")){document.querySelectorAll(".calPopup").forEach(function(p){p.classList.remove("open");});}});' +
    'function recalcNights(){' +
    '  var ci=document.getElementById("checkIn").value;' +
    '  var co=document.getElementById("checkOut").value;' +
    '  var out=document.getElementById("nights");' +
    '  if(!ci||!co){out.value="";recalcTotal();return;}' +
    '  var d1=new Date(ci),d2=new Date(co);' +
    '  var diff=Math.round((d2-d1)/(1000*60*60*24));' +
    '  out.value=(diff>0)?diff:"";' +
    '  if(diff<0) out.placeholder="check-out must be after check-in";else out.placeholder="auto";' +
    '  recalcTotal();' +
    '}' +
    'function recalcTotal(){' +
    '  var typeSel=document.getElementById("roomType").value;' +
    '  var nights=Number(document.getElementById("nights").value)||0;' +
    '  var rooms=Number(document.getElementById("rooms").value)||1;' +
    '  if(!typeSel||!nights) return;' +
    '  var price=ROOM_PRICE_MAP[typeSel];if(!price) return;' +
    '  document.getElementById("total").value=price*nights*rooms;' +
    '}' +
    'document.getElementById("rooms").addEventListener("input",recalcTotal);' +
    'document.getElementById("phone").addEventListener("input",function(){this.value=this.value.replace(/[^0-9]/g,"").slice(0,10);});' +
    'function showErr(id,show,msg){var el=document.getElementById(id);if(msg)el.textContent=msg;el.style.display=show?"block":"none";}' +
    'function v(id){var el=document.getElementById(id);return el?el.value.trim():"";}' +
    'function submitForm(){' +
    '  var valid=true;' +
    '  if(!v("name")){showErr("err_name",true);valid=false;}else{showErr("err_name",false);}' +
    '  var ph=v("phone").replace(/[^0-9]/g,"");' +
    '  if(ph.length!==10){showErr("err_phone",true);valid=false;}else{showErr("err_phone",false);}' +
    '  var em=v("email");' +
    '  if(em&&(em.indexOf("@")===-1||em.toLowerCase().indexOf(".com")===-1)){showErr("err_email",true);valid=false;}else{showErr("err_email",false);}' +
    '  var ci=v("checkIn"),co=v("checkOut");' +
    '  if(!ci){showErr("err_checkIn",true);valid=false;}else{showErr("err_checkIn",false);}' +
    '  if(co&&ci&&co<ci){showErr("err_checkOut",true,"Check-Out must be on or after Check-In.");valid=false;}' +
    '  else if(!co){showErr("err_checkOut",true,"Please select a check-out date.");valid=false;}' +
    '  else{showErr("err_checkOut",false);}' +
    '  if(!valid) return;' +
    '  var data={source:v("source"),name:v("name"),email:v("email"),phone:ph,guests:v("guests"),rooms:v("rooms"),roomType:v("roomType"),roomNumber:v("roomNumber"),checkIn:ci,checkOut:co,nights:v("nights"),total:v("total"),status:v("status"),notes:v("notes")};' +
    '  var guestName=v("name");' +
    '  var btn=document.querySelector(".submit-btn");' +
    '  var msgEl=document.getElementById("msg");' +
    '  btn.disabled=true;btn.textContent="⏳ Saving...";' +
    '  msgEl.style.color="#1a3a5c";msgEl.textContent="Saving booking for "+guestName+"...";' +
    '  google.script.run' +
    '    .withSuccessHandler(function(r){' +
    '      msgEl.style.color="green";msgEl.style.fontSize="15px";' +
    '      msgEl.textContent="✅ "+r.name+" — Booking #"+r.bookingId+" saved!";' +
    '      btn.textContent="✅ Done";btn.disabled=true;' +
    '      setTimeout(function(){google.script.host.close();},2200);' +
    '    })' +
    '    .withFailureHandler(function(err){' +
    '      msgEl.style.color="red";msgEl.textContent="❌ "+err.message;' +
    '      btn.textContent="✅ Add Booking";btn.disabled=false;' +
    '    })' +
    '    .submitManualBooking(data);' +
    '}' +
    '<\/script></body></html>';
}


// ═══════════════════════════════════════════════════════════════
//  MENU
// ═══════════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏨 Dream Residency')
    .addItem('🔧 One-Time Setup (Run First!)', 'initialSetup')
    .addSeparator()
    .addItem('➕ Add Manual Booking', 'showManualBookingDialog')
    .addSeparator()
    .addItem('🗑️ Delete Selected Row', 'deleteSelectedBooking')
    .addSeparator()
    .addItem('🔒 Lock Confirmed Rows (Run Once)', 'applyProtectionToAllSheets')
    .addItem('✅ Apply Dropdowns (All Sheets)',   'applyDropdownsToAllRows')
    .addItem('🔄 Refresh Dashboard',             'refreshDashboardManual')
    .addItem('🔢 Fix Phone Formatting',          'fixExistingPhoneErrors')
    .addSeparator()
    .addItem('📧 Send Goodbye Email Now (Test)', 'sendGoodbyeEmailForSelectedRow')
    .addItem('🔁 Force-Reset Edit Trigger (Fix)', 'forceResetHandleEditTrigger')
    .addToUi();
}


// ═══════════════════════════════════════════════════════════════
//  onEdit / handleEdit
// ═══════════════════════════════════════════════════════════════

function onEdit(e) {
  try { handleEdit(e); } catch(err) { Logger.log('onEdit error: ' + err.message); }
}

function handleEdit(e) {
  try {
    var sheet     = e.source.getActiveSheet();
    var sheetName = sheet.getName();

    var SKIP = ['Dashboard', DUMP_SHEET_NAME, '_BookingCounter', PENDING_CHECKOUTS_SHEET];
    if (SKIP.indexOf(sheetName) !== -1) return;

    var col     = e.range.getColumn();
    var row     = e.range.getRow();
    var numRows = e.range.getNumRows();

    if (row === 1) {
      _reapplyHeaders(sheet);
      return;
    }

    var firstDataRow    = Math.max(row, 2);
    var lastAffectedRow = row + numRows - 1;

    if (numRows > 1) {
      for (var r = firstDataRow; r <= lastAffectedRow; r++) {
        var vals = sheet.getRange(r, 1, 1, HEADERS.length).getValues()[0];
        var isEmpty = vals.every(function(v) { return v === '' || v === null || v === undefined; });
        if (isEmpty) {
          sheet.getRange(r, 1, 1, HEADERS.length).setBackground('#ffffff');
          unprotectRow(sheet, r);
          _cancelPendingGoodbye(sheetName, r);
        }
      }
      return;
    }

    var checkInCol  = HEADERS.indexOf('Check-In Date') + 1;
    var checkOutCol = HEADERS.indexOf('Check-Out Date') + 1;
    var nightsCol   = HEADERS.indexOf('Nights') + 1;

    if (col === checkInCol || col === checkOutCol) {
      var ciVal = sheet.getRange(row, checkInCol).getValue();
      var coVal = sheet.getRange(row, checkOutCol).getValue();
      var ciStr = ciVal instanceof Date
        ? Utilities.formatDate(ciVal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : ciVal;
      var coStr = coVal instanceof Date
        ? Utilities.formatDate(coVal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : coVal;
      var nights = calculateNights(ciStr, coStr);
      if (nights !== '') sheet.getRange(row, nightsCol).setValue(nights);
    }

    if (col === STATUS_COL) {
      var newStatus = String(sheet.getRange(row, STATUS_COL).getValue() || '').toLowerCase();
      styleDataRow(sheet, row, newStatus);

      if (newStatus === 'confirmed') {
        var rowData = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
        protectConfirmedRow(sheet, row);
        if (rowData[3]) {
          sendConfirmationEmail({
            name:     rowData[2],
            email:    rowData[3],
            phone:    rowData[4],
            guests:   rowData[5],
            roomType: rowData[7],
            roomNum:  rowData[8],
            checkIn:  rowData[9],
            checkOut: rowData[10],
            total:    rowData[12]
          });
        }
        _cancelPendingGoodbye(sheetName, row);

      } else if (newStatus === 'checked_out') {
        var rowDataObj = _rowToObject(sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0]);
        _scheduleGoodbyeEmail(sheet, row, rowDataObj);
        unprotectRow(sheet, row);

      } else {
        unprotectRow(sheet, row);
        _cancelPendingGoodbye(sheetName, row);
      }
    }

    var rowVals = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    if (rowVals.every(function(v) { return v === '' || v === null; })) {
      sheet.getRange(row, 1, 1, HEADERS.length).setBackground('#ffffff');
      unprotectRow(sheet, row);
      _cancelPendingGoodbye(sheetName, row);
    }

  } catch (err) {
    Logger.log('handleEdit error: ' + err.message);
  }
}

function _rowToObject(valuesArr) {
  var obj = {};
  HEADERS.forEach(function(h, i) { obj[h] = valuesArr[i]; });
  return obj;
}


// ═══════════════════════════════════════════════════════════════
//  WEBHOOK (doGet / doPost)  ← UPDATED IN v5.2
//
//  doPost now ALWAYS generates a fresh unique Booking ID and
//  ignores whatever ID the website payload sends. This fixes
//  website bookings all showing "1" as their Booking ID.
// ═══════════════════════════════════════════════════════════════

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true, msg: 'Dream Residency Sheets Sync v5.2'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss   = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === 'append' || data.action === 'upsert') {
      // Always generate a fresh unique random ID — never trust whatever
      // the website sends (it may send "1" or repeat the same value).
      data.rowData['Booking ID'] = getNextBookingId();
      data.rowData['Source'] = 'Website';
      if (!data.rowData['Nights'] && data.rowData['Check-In Date'] && data.rowData['Check-Out Date']) {
        data.rowData['Nights'] = calculateNights(data.rowData['Check-In Date'], data.rowData['Check-Out Date']);
      }
      if (!data.rowData['Status']) data.rowData['Status'] = 'pending';

      var sheet = getOrCreateMonthSheet(ss, data.tab);

      if (data.action === 'append') {
        appendBookingRow(sheet, data.rowData);
      } else {
        upsertBookingRow(sheet, data.rowData, data.matchKey, data.matchVal);
      }
      refreshDashboard(ss);

    } else if (data.action === 'update_status') {
      var sheet = getOrCreateMonthSheet(ss, data.tab);
      updateStatusInSheet(sheet, data.matchKey, data.matchVal, data.newStatus);
      refreshDashboard(ss);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ═══════════════════════════════════════════════════════════════
//  ROW WRITE HELPERS
// ═══════════════════════════════════════════════════════════════

function appendBookingRow(sheet, rowData) {
  var idCol    = HEADERS.indexOf('Booking ID') + 1;
  var phoneCol = HEADERS.indexOf('Phone') + 1;

  var nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, idCol,    1, 1).setNumberFormat('@STRING@');
  sheet.getRange(nextRow, phoneCol, 1, 1).setNumberFormat('@STRING@');

  var row = HEADERS.map(function(h) {
    return rowData[h] !== undefined ? rowData[h] : '';
  });
  sheet.appendRow(row);

  styleDataRow(sheet, nextRow, String(rowData['Status'] || 'pending'));
  applyDropdown(sheet, nextRow);
}

function upsertBookingRow(sheet, rowData, matchKey, matchVal) {
  var colIndex = HEADERS.indexOf(matchKey) + 1;
  if (colIndex < 1) { appendBookingRow(sheet, rowData); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { appendBookingRow(sheet, rowData); return; }

  var colVals = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  for (var i = 0; i < colVals.length; i++) {
    if (String(colVals[i][0]).trim() === String(matchVal).trim()) {
      var targetRow = i + 2;
      var row = HEADERS.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ''; });
      sheet.getRange(targetRow, 1, 1, HEADERS.length).setValues([row]);

      var phoneCol = HEADERS.indexOf('Phone') + 1;
      sheet.getRange(targetRow, phoneCol).setNumberFormat('@STRING@').setValue(String(rowData['Phone'] || ''));

      styleDataRow(sheet, targetRow, String(rowData['Status'] || 'pending'));
      applyDropdown(sheet, targetRow);
      _autoResize(sheet);

      if (String(rowData['Status']).toLowerCase() === 'checked_out') {
        _scheduleGoodbyeEmail(sheet, targetRow, rowData);
      }
      return;
    }
  }
  appendBookingRow(sheet, rowData);
}

function updateStatusInSheet(sheet, matchKey, matchVal, newStatus) {
  var statusCol = HEADERS.indexOf('Status') + 1;
  var matchCol  = HEADERS.indexOf(matchKey) + 1;
  if (matchCol < 1) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var colVals = sheet.getRange(2, matchCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < colVals.length; i++) {
    if (String(colVals[i][0]).trim() === String(matchVal).trim()) {
      var targetRow = i + 2;
      sheet.getRange(targetRow, statusCol).setValue(newStatus);
      styleDataRow(sheet, targetRow, newStatus);

      if (String(newStatus).toLowerCase() === 'checked_out') {
        var rowDataObj = _rowToObject(sheet.getRange(targetRow, 1, 1, HEADERS.length).getValues()[0]);
        _scheduleGoodbyeEmail(sheet, targetRow, rowDataObj);
      } else {
        _cancelPendingGoodbye(sheet.getName(), targetRow);
      }
      return;
    }
  }
}


// ═══════════════════════════════════════════════════════════════
//  STYLING
// ═══════════════════════════════════════════════════════════════

var STATUS_COLOURS = {
  'pending':    '#FFF9C4',
  'confirmed':  '#C8E6C9',
  'booked':     '#C8E6C9',
  'rejected':   '#FFCDD2',
  'cancelled':  '#FFCDD2',
  'checked_in': '#BBDEFB',
  'checked_out':'#D7CCC8',
  'completed':  '#E1BEE7',
  'spam':       '#d3d3d3'
};

function styleDataRow(sheet, rowNum, status) {
  var bg = STATUS_COLOURS[String(status).toLowerCase()] || '#ffffff';
  sheet.getRange(rowNum, 1, 1, HEADERS.length).setBackground(bg);
}

function applyDropdown(sheet, row) {
  if (!sheet || typeof sheet.getRange !== 'function') return;
  var nameVal = sheet.getRange(row, 3).getValue();
  if (!nameVal) return;

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'spam'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, STATUS_COL).setDataValidation(rule);
}

function _autoResize(sheet) {
  try {
    sheet.autoResizeColumns(1, HEADERS.length);
    var lr = sheet.getLastRow();
    if (lr >= 2) {
      sheet.autoResizeRows(Math.max(2, lr - 4), Math.min(5, lr - 1));
    }
  } catch (err) {
    Logger.log('autoResize skipped: ' + err.message);
  }
}


// ═══════════════════════════════════════════════════════════════
//  SHEET HELPERS
// ═══════════════════════════════════════════════════════════════

function getOrCreateMonthSheet(ss, tabName) {
  if (!tabName || tabName === 'Unknown') tabName = currentMonthTabName();
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    _styleMonthSheet(sheet);
  }
  return sheet;
}

function _styleMonthSheet(sheet) {
  var hRange = sheet.getRange(1, 1, 1, HEADERS.length);
  hRange.setValues([HEADERS]);
  hRange.setFontWeight('bold')
    .setBackground('#1a1a2e')
    .setFontColor('#c9a84c')
    .setHorizontalAlignment('center')
    .setFontSize(10)
    .setWrap(false);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  var widths = [70, 110, 160, 200, 120, 60, 110, 120, 90, 110, 110, 60, 130, 100, 200, 90];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  try {
    var existingFilter = sheet.getFilter();
    if (existingFilter) existingFilter.remove();
    sheet.getRange(1, 1, 1, HEADERS.length).createFilter();
  } catch (err) {
    Logger.log('Filter creation skipped: ' + err.message);
  }
}

function _reapplyHeaders(sheet) {
  var headerRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var isMissing = headerRow[0] !== HEADERS[0];
  if (isMissing) {
    _styleMonthSheet(sheet);
  } else {
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1a1a2e')
      .setFontColor('#c9a84c')
      .setHorizontalAlignment('center')
      .setFontSize(10);
  }
}

function currentMonthTabName() {
  var d = new Date();
  return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
}


// ═══════════════════════════════════════════════════════════════
//  ROW PROTECTION
// ═══════════════════════════════════════════════════════════════

function protectConfirmedRow(sheet, row) {
  try {
    var rangeA1 = sheet.getRange(row, 1, 1, HEADERS.length).getA1Notation();
    sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function(p) {
      if (p.getRange().getA1Notation() === rangeA1 && p.getDescription() === 'Confirmed booking — locked') {
        p.remove();
      }
    });
    var protection = sheet.getRange(row, 1, 1, HEADERS.length)
      .protect()
      .setDescription('Confirmed booking — locked');
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
    protection.addEditors(AUTHORISED_DELETERS);
  } catch (err) {
    Logger.log('protectConfirmedRow error on row ' + row + ': ' + err.message);
  }
}

function unprotectRow(sheet, row) {
  try {
    var rangeA1 = sheet.getRange(row, 1, 1, HEADERS.length).getA1Notation();
    sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function(p) {
      if (p.getRange().getA1Notation() === rangeA1 && p.getDescription() === 'Confirmed booking — locked') {
        p.remove();
      }
    });
  } catch (err) {
    Logger.log('unprotectRow error on row ' + row + ': ' + err.message);
  }
}

function applyProtectionToAllSheets() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var sheets      = ss.getSheets();
  var SKIP        = ['Dashboard', DUMP_SHEET_NAME, '_BookingCounter', PENDING_CHECKOUTS_SHEET];
  var statusCol   = HEADERS.indexOf('Status') + 1;
  var lockedCount = 0;

  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (SKIP.indexOf(name) !== -1 || sheet.isSheetHidden()) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var statusVals = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
    for (var i = 0; i < statusVals.length; i++) {
      if (String(statusVals[i][0]).toLowerCase() === 'confirmed') {
        protectConfirmedRow(sheet, i + 2);
        lockedCount++;
      }
    }
  });

  _safeAlert('🔒 Done. Locked ' + lockedCount + ' confirmed row(s).\n\nAuthorised editors:\n' + AUTHORISED_DELETERS.join('\n'));
}


// ═══════════════════════════════════════════════════════════════
//  GOODBYE / THANK-YOU EMAIL — SCHEDULING
// ═══════════════════════════════════════════════════════════════

function _scheduleGoodbyeEmail(sheet, row, rowDataObj) {
  try {
    var ss        = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = sheet.getName();

    _cancelPendingGoodbye(sheetName, row);

    var trigger = ScriptApp.newTrigger('_runScheduledGoodbye')
      .timeBased()
      .after(GOODBYE_DELAY_MINUTES * 60 * 1000)
      .create();

    var triggerUid   = trigger.getUniqueId();
    var scheduledFor = new Date(Date.now() + GOODBYE_DELAY_MINUTES * 60 * 1000);

    var pendingSheet = _ensurePendingCheckoutsSheet(ss);
    pendingSheet.appendRow([
      triggerUid, sheetName, row, rowDataObj['Booking ID'],
      scheduledFor.toLocaleString(), 'pending'
    ]);

    Logger.log('📧 Goodbye email scheduled for row ' + row + ' (' + sheetName + ') at ' + scheduledFor.toLocaleString());
  } catch (err) {
    Logger.log('_scheduleGoodbyeEmail error: ' + err.message);
  }
}

function _cancelPendingGoodbye(sheetName, row) {
  try {
    var ss           = SpreadsheetApp.getActiveSpreadsheet();
    var pendingSheet = _ensurePendingCheckoutsSheet(ss);
    var lastRow      = pendingSheet.getLastRow();
    if (lastRow < 2) return;

    var data        = pendingSheet.getRange(2, 1, lastRow - 1, 6).getValues();
    var allTriggers = null;

    for (var i = 0; i < data.length; i++) {
      var uid = data[i][0], sName = data[i][1], r = data[i][2], status = data[i][5];
      if (sName === sheetName && Number(r) === Number(row) && status === 'pending') {
        if (!allTriggers) {
          try { allTriggers = ScriptApp.getProjectTriggers(); }
          catch (e) { allTriggers = []; }
        }
        allTriggers.forEach(function(t) {
          try { if (t.getUniqueId() === uid) ScriptApp.deleteTrigger(t); }
          catch (e) { Logger.log('⚠️ Could not delete goodbye trigger: ' + e.message); }
        });
        pendingSheet.getRange(i + 2, 6).setValue('cancelled');
      }
    }
  } catch (err) {
    Logger.log('_cancelPendingGoodbye error: ' + err.message);
  }
}

function _runScheduledGoodbye(e) {
  try {
    var ss           = SpreadsheetApp.getActiveSpreadsheet();
    var pendingSheet = _ensurePendingCheckoutsSheet(ss);
    var lastRow      = pendingSheet.getLastRow();
    if (lastRow < 2) return;

    var triggerUid = e && e.triggerUid ? e.triggerUid : null;
    var data       = pendingSheet.getRange(2, 1, lastRow - 1, 6).getValues();

    for (var i = 0; i < data.length; i++) {
      var uid = data[i][0], sheetName = data[i][1], row = Number(data[i][2]), status = data[i][5];
      if (status !== 'pending') continue;
      if (triggerUid && uid !== triggerUid) continue;

      var targetSheet = ss.getSheetByName(sheetName);
      if (!targetSheet) { pendingSheet.getRange(i + 2, 6).setValue('cancelled'); continue; }

      var rowVals    = targetSheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
      var rowDataObj = _rowToObject(rowVals);
      var currentStatus = String(rowDataObj['Status'] || '').toLowerCase();

      if (currentStatus === 'checked_out' && rowDataObj['Email']) {
        sendGoodbyeEmail({
          name:     rowDataObj['Full Name'],
          email:    rowDataObj['Email'],
          roomType: rowDataObj['Room Type'],
          roomNum:  rowDataObj['Room Number'],
          checkIn:  rowDataObj['Check-In Date'],
          checkOut: rowDataObj['Check-Out Date']
        });
        pendingSheet.getRange(i + 2, 6).setValue('sent');
      } else {
        pendingSheet.getRange(i + 2, 6).setValue('cancelled');
      }

      if (triggerUid) {
        try {
          ScriptApp.getProjectTriggers().forEach(function(t) {
            try { if (t.getUniqueId() === triggerUid) ScriptApp.deleteTrigger(t); }
            catch (e) { Logger.log('⚠️ Could not delete fired goodbye trigger: ' + e.message); }
          });
        } catch (e) { Logger.log('⚠️ Could not list triggers during cleanup: ' + e.message); }
      }
      return;
    }
  } catch (err) {
    Logger.log('_runScheduledGoodbye error: ' + err.message);
  }
}

function sendGoodbyeEmailForSelectedRow() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var SKIP  = ['Dashboard', DUMP_SHEET_NAME, '_BookingCounter', PENDING_CHECKOUTS_SHEET];

  if (SKIP.indexOf(sheet.getName()) !== -1) {
    _safeAlert('Select a row on a month sheet first.');
    return;
  }

  var row = sheet.getActiveCell().getRow();
  if (row <= 1) { _safeAlert('Please select a data row (not the header).'); return; }

  var rowDataObj = _rowToObject(sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0]);
  if (!rowDataObj['Email']) { _safeAlert('This row has no email address — cannot send.'); return; }

  sendGoodbyeEmail({
    name:     rowDataObj['Full Name'],
    email:    rowDataObj['Email'],
    roomType: rowDataObj['Room Type'],
    roomNum:  rowDataObj['Room Number'],
    checkIn:  rowDataObj['Check-In Date'],
    checkOut: rowDataObj['Check-Out Date']
  });

  _safeAlert('✅ Test goodbye email sent to ' + rowDataObj['Email']);
}


// ═══════════════════════════════════════════════════════════════
//  CONFIRMATION EMAIL
// ═══════════════════════════════════════════════════════════════

function sendConfirmationEmail(d) {
  if (!d.email) { Logger.log('sendConfirmationEmail: no email provided'); return; }

  var formattedCheckIn  = _formatDateProfessional(d.checkIn)  || d.checkIn  || '';
  var formattedCheckOut = _formatDateProfessional(d.checkOut) || d.checkOut || '';
  var confirmSubject = 'Booking Confirmed for ' + _firstName(d.name) +
    (formattedCheckOut ? ' — Check-Out on ' + formattedCheckOut : '') +
    ' — ' + HOTEL_NAME;

  var logoBlob   = _getHotelLogoBlob();
  var logoImgTag = logoBlob
    ? '<img src="cid:hotelLogo" alt="' + HOTEL_NAME + '" width="180" style="display:block;margin:0 auto 18px;max-width:180px;height:auto;">'
    : '';

  var mailOptions = {
    from:     HOTEL_EMAIL,
    name:     HOTEL_NAME,
    htmlBody:
      '<div style="background:#f4f1ea;padding:24px 12px;">' +
      '<style>@media only screen and (max-width:480px){.drTable td{font-size:13px!important;padding:8px 8px!important;}.drBody{padding:22px 18px!important;}}</style>' +
      '<div style="font-family:Georgia,\'Times New Roman\',serif;max-width:560px;width:100%;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">' +
      '<div style="background:#14141a;padding:34px 30px 28px;text-align:center;">' +
      logoImgTag +
      '<p style="color:#d4af6a;margin:0;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;text-transform:uppercase;">Booking Confirmation</p>' +
      '</div>' +
      '<div class="drBody" style="padding:34px 36px;color:#2b2b2b;font-size:15px;line-height:1.65;">' +
      '<p style="margin:0 0 16px;">Dear ' + _firstName(d.name) + ',</p>' +
      '<p style="margin:0 0 22px;">We are delighted to confirm your upcoming stay with us. Below is a summary of your reservation for your records.</p>' +
      '<table class="drTable" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;">' +
      _emailRow('Guest Name', d.name, true) +
      _emailRow('Phone', d.phone, false) +
      _emailRow('Guests', d.guests, true) +
      _emailRow('Room Type', d.roomType, false) +
      _emailRow('Room Number', d.roomNum, true) +
      _emailRow('Check-In', formattedCheckIn, false) +
      _emailRow('Check-Out', formattedCheckOut, true) +
      _emailRow('Total Amount', '&#8377;' + d.total, false) +
      '</table>' +
      '<div style="background:#fbf6ea;border-left:3px solid #d4af6a;padding:14px 16px;margin:0 0 26px;font-family:Arial,sans-serif;font-size:13px;color:#5a4a2a;">' +
      '<b>Please note:</b> a valid Government-issued Photo ID (Aadhaar / Passport) is required at check-in.' +
      '</div>' +
      '<p style="margin:0 0 4px;">We look forward to welcoming you.</p>' +
      '<p style="margin:0 0 28px;">Warm regards,<br>Team,<br><b>' + HOTEL_NAME + '</b></p>' +
      '<hr style="border:none;border-top:1px solid #e8e3d8;margin:0 0 20px;">' +
      '<table style="width:100%;font-family:Arial,sans-serif;font-size:13px;color:#555;">' +
      '<tr><td style="padding:3px 0;word-break:break-word;">&#9742;&nbsp; ' + HOTEL_PHONE + '</td></tr>' +
      '<tr><td style="padding:3px 0;word-break:break-word;">&#9993;&nbsp; ' + HOTEL_EMAIL + '</td></tr>' +
      '<tr><td style="padding:3px 0;word-break:break-word;">&#127968;&nbsp; <a href="' + HOTEL_MAPS_DIRECTIONS_URL + '" style="color:#8a6d2f;text-decoration:underline;" target="_blank">' + HOTEL_ADDRESS_TEXT + '</a></td></tr>' +
      '</table>' +
      '</div>' +
      '<div style="background:#14141a;padding:14px;text-align:center;">' +
      '<p style="color:#9a8a5a;margin:0;font-size:11px;font-family:Arial,sans-serif;letter-spacing:1px;">Comfort Matters</p>' +
      '</div>' +
      '</div></div>'
  };
  if (logoBlob) mailOptions.inlineImages = { hotelLogo: logoBlob };

  GmailApp.sendEmail(d.email, confirmSubject, '', mailOptions);
  Logger.log('✅ Confirmation email sent to ' + d.email);
}

function _emailRow(label, value, shaded) {
  var bg = shaded ? 'background:#faf8f3;' : '';
  return '<tr style="' + bg + '">' +
    '<td style="padding:10px 12px;border-bottom:1px solid #ece6d8;color:#8a6d2f;font-weight:bold;width:42%;word-break:break-word;vertical-align:top;">' + label + '</td>' +
    '<td style="padding:10px 12px;border-bottom:1px solid #ece6d8;color:#2b2b2b;word-break:break-word;vertical-align:top;">' + (value || '&mdash;') + '</td>' +
    '</tr>';
}

function _firstName(fullName) {
  if (!fullName) return 'Guest';
  var trimmed = String(fullName).trim();
  if (!trimmed) return 'Guest';
  return trimmed.split(/\s+/)[0];
}

function _formatDateProfessional(dateInput) {
  if (!dateInput) return '';
  var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(d)) return '';

  var day    = d.getDate();
  var month  = ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()];
  var year   = d.getFullYear();
  var suffix = 'th';
  if (day % 10 === 1 && day !== 11) suffix = 'st';
  else if (day % 10 === 2 && day !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day !== 13) suffix = 'rd';

  return day + suffix + ' ' + month + ' ' + year;
}

function _getHotelLogoBlob() {
  try {
    if (!HOTEL_LOGO_BASE64) return null;
    return Utilities.newBlob(
      Utilities.base64Decode(HOTEL_LOGO_BASE64),
      'image/jpeg',
      'dream-residency-logo.jpg'
    );
  } catch (err) {
    Logger.log('⚠️ Could not build hotel logo blob: ' + err.message);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════
//  GOODBYE / THANK-YOU EMAIL — TEMPLATE
// ═══════════════════════════════════════════════════════════════

function sendGoodbyeEmail(d) {
  if (!d.email) { Logger.log('sendGoodbyeEmail: no email provided'); return; }

  var formattedCheckIn  = _formatDateProfessional(d.checkIn)  || d.checkIn  || '';
  var formattedCheckOut = _formatDateProfessional(d.checkOut) || d.checkOut || '';
  var goodbyeSubject = 'Thank You, ' + _firstName(d.name) + ' — We Hope You Enjoyed Your Stay' +
    (formattedCheckOut ? ' (Checked Out ' + formattedCheckOut + ')' : '') +
    ' — ' + HOTEL_NAME;

  var logoBlob   = _getHotelLogoBlob();
  var logoImgTag = logoBlob
    ? '<img src="cid:hotelLogo" alt="' + HOTEL_NAME + '" width="180" style="display:block;margin:0 auto 18px;max-width:180px;height:auto;">'
    : '';

  var roomLine = d.roomType
    ? ' in our ' + d.roomType + (d.roomNum ? ' (Room ' + d.roomNum + ')' : '')
    : '';

  var mailOptions = {
    from: HOTEL_EMAIL,
    name: HOTEL_NAME,
    htmlBody:
      '<div style="background:#f4f1ea;padding:24px 12px;">' +
      '<style>@media only screen and (max-width:480px){.drTable td{font-size:13px!important;padding:8px 8px!important;}.drBody{padding:22px 18px!important;}}</style>' +
      '<div style="font-family:Georgia,\'Times New Roman\',serif;max-width:560px;width:100%;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">' +
      '<div style="background:#14141a;padding:34px 30px 28px;text-align:center;">' +
      logoImgTag +
      '<p style="color:#d4af6a;margin:0;font-size:11px;letter-spacing:3px;font-family:Arial,sans-serif;text-transform:uppercase;">Thank You For Visiting</p>' +
      '</div>' +
      '<div class="drBody" style="padding:34px 36px;color:#2b2b2b;font-size:15px;line-height:1.65;">' +
      '<p style="margin:0 0 16px;">Dear ' + _firstName(d.name) + ',</p>' +
      '<p style="margin:0 0 22px;">Thank you for choosing ' + HOTEL_NAME + ' for your recent stay' + roomLine + '. It was a pleasure having you with us, and we hope your time here was comfortable and memorable.</p>' +
      '<table class="drTable" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:0 0 26px;font-family:Arial,sans-serif;font-size:14px;">' +
      _emailRow('Guest Name', d.name, true) +
      _emailRow('Check-In', formattedCheckIn, false) +
      _emailRow('Check-Out', formattedCheckOut, true) +
      '</table>' +
      '<div style="background:#fbf6ea;border:1px solid #ecdfb8;border-radius:6px;padding:22px;margin:0 0 26px;text-align:center;">' +
      '<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#8a6d2f;">Enjoyed your stay?</p>' +
      '<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:13px;color:#5a4a2a;">A moment of your time to share a review would mean a great deal to us.</p>' +
      '<a href="' + HOTEL_GOOGLE_REVIEW_URL + '" target="_blank" style="display:inline-block;background:#14141a;color:#d4af6a;text-decoration:none;padding:11px 26px;border-radius:4px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:0.5px;">Leave us a Google Review</a>' +
      '</div>' +
      '<p style="margin:0 0 28px;">We hope to welcome you back again soon.<br>Until then, safe travels.</p>' +
      '<p style="margin:0 0 28px;">Warm regards,<br>Team,<br><b>' + HOTEL_NAME + '</b></p>' +
      '<hr style="border:none;border-top:1px solid #e8e3d8;margin:0 0 20px;">' +
      '<table style="width:100%;font-family:Arial,sans-serif;font-size:13px;color:#555;">' +
      '<tr><td style="padding:3px 0;word-break:break-word;">&#9742;&nbsp; ' + HOTEL_PHONE + '</td></tr>' +
      '<tr><td style="padding:3px 0;word-break:break-word;">&#9993;&nbsp; ' + HOTEL_EMAIL + '</td></tr>' +
      '<tr><td style="padding:3px 0;word-break:break-word;">&#127968;&nbsp; <a href="' + HOTEL_MAPS_DIRECTIONS_URL + '" style="color:#8a6d2f;text-decoration:underline;" target="_blank">' + HOTEL_ADDRESS_TEXT + '</a></td></tr>' +
      '</table>' +
      '</div>' +
      '<div style="background:#14141a;padding:14px;text-align:center;">' +
      '<p style="color:#9a8a5a;margin:0;font-size:11px;font-family:Arial,sans-serif;letter-spacing:1px;">Comfort Matters</p>' +
      '</div>' +
      '</div></div>'
  };
  if (logoBlob) mailOptions.inlineImages = { hotelLogo: logoBlob };

  GmailApp.sendEmail(d.email, goodbyeSubject, '', mailOptions);
  Logger.log('✅ Goodbye email sent to ' + d.email);
}


// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════

function refreshDashboard(ss) {
  var dash = _ensureDashboard(ss);
  dash.getRange('A2').setValue('Last updated: ' + new Date().toLocaleString());
}

function refreshDashboardManual() {
  refreshDashboard(SpreadsheetApp.getActiveSpreadsheet());
  _safeAlert('Dashboard refreshed ✅');
}


// ═══════════════════════════════════════════════════════════════
//  MAINTENANCE UTILITIES
// ═══════════════════════════════════════════════════════════════

function fixExistingPhoneErrors() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var SKIP   = ['Dashboard', DUMP_SHEET_NAME, '_BookingCounter', PENDING_CHECKOUTS_SHEET];
  var phoneCol = HEADERS.indexOf('Phone') + 1;

  sheets.forEach(function(sheet) {
    if (SKIP.indexOf(sheet.getName()) !== -1 || sheet.isSheetHidden()) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    for (var row = 2; row <= lastRow; row++) {
      var cell    = sheet.getRange(row, phoneCol);
      cell.setNumberFormat('@STRING@');
      var formula = cell.getFormula();
      if (formula && formula.startsWith('=')) {
        cell.setValue('+' + formula.replace(/^=/, '').trim());
      }
    }
    Logger.log('✅ Phone fixed: ' + sheet.getName());
  });

  _safeAlert('✅ Phone formatting fixed on all sheets.');
}

function applyDropdownsToAllRows() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var SKIP   = ['Dashboard', DUMP_SHEET_NAME, '_BookingCounter', PENDING_CHECKOUTS_SHEET];

  sheets.forEach(function(sheet) {
    if (!sheet || SKIP.indexOf(sheet.getName()) !== -1 || sheet.isSheetHidden()) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    for (var row = 2; row <= lastRow; row++) {
      try { applyDropdown(sheet, row); } catch(err) { Logger.log('Dropdown skipped row ' + row); }
    }
    Logger.log('✅ Dropdowns applied: ' + sheet.getName());
  });

  _safeAlert('✅ Dropdowns applied to all sheets.');
}
