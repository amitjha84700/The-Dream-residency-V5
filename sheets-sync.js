'use strict';

// ─── Google Sheets Sync — Advanced Monthly-Tab System ────────────────────────
const https = require('https');
const http  = require('http');

const HEADERS = [
  'Booking ID', 'Submitted Date', 'Full Name', 'Email', 'Phone',
  'Guests', 'Rooms Required', 'Room Type', 'Room Number',
  'Check-In Date', 'Check-Out Date', 'Nights',
  'Total Amount (₹)', 'Status', 'Notes', 'Source',
];

function monthTabName(checkInStr) {
  if (!checkInStr) return 'Unknown';
  const d = new Date(checkInStr);
  if (isNaN(d.getTime())) return 'Unknown';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function computeNights(checkIn, checkOut) {
  try {
    const diff = new Date(checkOut) - new Date(checkIn);
    return Math.max(1, Math.round(diff / 86400000));
  } catch { return ''; }
}

// ── Strip + from phone so Google Sheets doesn't treat it as formula ───────────
function sanitizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/^\+/, '');
}

async function pushToSheet(payload) {
  const url = process.env.SHEETS_WEBHOOK_URL || '';
  if (!url) return { ok: false, reason: 'SHEETS_WEBHOOK_URL not configured' };

  const body = JSON.stringify(payload);
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const opts = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 10000,
      };
      const req = lib.request(opts, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ ok: true, status: res.statusCode, body: data }));
      });
      req.on('error',   (e) => resolve({ ok: false, reason: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
      req.write(body);
      req.end();
    } catch (e) {
      resolve({ ok: false, reason: e.message });
    }
  });
}

async function syncBookingRequest(data) {
  const tab = monthTabName(data.check_in);
  return pushToSheet({
    action:  'append',
    tab,
    rowData: {
      'Booking ID':       data.id              || '',
      'Submitted Date':   new Date().toLocaleDateString('en-IN'),
      'Full Name':        data.name             || data.full_name || '',
      'Email':            data.email            || '',
      'Phone':            sanitizePhone(data.phone),   // ← fixed
      'Guests':           data.guests           || 1,
      'Rooms Required':   data.rooms_required   || 1,
      'Room Type':        data.room_type        || '',
      'Room Number':      data.room_number      || '',
      'Check-In Date':    data.check_in         || '',
      'Check-Out Date':   data.check_out        || '',
      'Nights':           computeNights(data.check_in, data.check_out),
      'Total Amount (₹)': data.total            || '',
      'Status':           data.status           || 'pending',
      'Notes':            data.message          || data.notes || '',
      'Source':           'Website',
    },
  });
}

async function syncConfirmedBooking(data) {
  const tab = monthTabName(data.check_in);
  return pushToSheet({
    action:   'upsert',
    tab,
    matchKey: 'Booking ID',
    matchVal: String(data.booking_id || data.id || ''),
    rowData: {
      'Booking ID':       data.booking_id       || data.id || '',
      'Submitted Date':   new Date().toLocaleDateString('en-IN'),
      'Full Name':        data.customer_name    || data.name || '',
      'Email':            data.email            || '',
      'Phone':            sanitizePhone(data.phone || data.contact),  // ← fixed
      'Guests':           data.guests           || 1,
      'Rooms Required':   data.rooms_count      || 1,
      'Room Type':        data.room_type        || '',
      'Room Number':      data.room_number      || '',
      'Check-In Date':    data.check_in         || '',
      'Check-Out Date':   data.check_out        || '',
      'Nights':           computeNights(data.check_in, data.check_out),
      'Total Amount (₹)': data.total            || 0,
      'Status':           data.status           || 'confirmed',
      'Notes':            data.notes            || '',
      'Source':           'Website',
    },
  });
}

async function updateSheetStatus(bookingId, phone, checkIn, newStatus) {
  const tab = monthTabName(checkIn);
  return pushToSheet({
    action:   'update_status',
    tab,
    matchKey: bookingId ? 'Booking ID' : 'Phone',
    matchVal: bookingId ? String(bookingId) : sanitizePhone(phone),  // ← fixed
    newStatus,
  });
}

module.exports = {
  HEADERS,
  monthTabName,
  syncBookingRequest,
  syncConfirmedBooking,
  updateSheetStatus,
  pushToSheet,
};
