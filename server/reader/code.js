// === Reader Web App (GET only) ===
// Project Settings → Script properties:
   SPREADSHEET_ID = "18pq7QCdq9Snd3x3fCjT0zpL8HIDmV_xhU398xMSc8ws";
   SHEET_NAME     = Bookings;

function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const action = String(p.action || '').toLowerCase();
  if (action === 'whoami') return respond(whoAmI());
  if (action === 'status') return ContentService.createTextOutput('OK');
  if (action === 'bookings') return respond(getBookings(p));
  return respond({ ok:false, error:'Unknown action', hint:'whoami | status | bookings&from=YYYY-MM-DD&to=YYYY-MM-DD' });
}

function whoAmI() {
  const sp = PropertiesService.getScriptProperties();
  return {
    ok: true,
    tag: 'whoami',
    scriptId: ScriptApp.getScriptId && ScriptApp.getScriptId(),
    spreadsheetId: sp.getProperty('SPREADSHEET_ID') || '(missing)',
    sheet: sp.getProperty('SHEET_NAME') || '(missing)',
    time: new Date().toISOString()
  };
}

function getBookings(p) {
  const sp = PropertiesService.getScriptProperties();
  const SSID = sp.getProperty('SPREADSHEET_ID');
  const SHEET = sp.getProperty('SHEET_NAME') || 'Bookings';
  if (!SSID) return { ok:false, error:'Missing SPREADSHEET_ID' };

  let sh;
  try {
    const ss = SpreadsheetApp.openById(SSID); // יציב, לא getActive
    sh = ss.getSheetByName(SHEET);
    if (!sh) return { ok:false, error:'Missing sheet: ' + SHEET };
  } catch (err) {
    return { ok:false, error:'Spreadsheet open failed', detail:String(err) };
  }

  const from = String(p.from || '').trim();
  const to   = String(p.to   || '').trim();
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok:true, items: [] };

  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const I = n => headers.indexOf(n);

  const idx = {
    submitted_at:   I('submitted_at'),
    full_name:      I('full_name'),
    phone:          I('phone'),
    email:          I('email'),
    category:       I('category'),
    service:        I('service'),
    service_name:   I('service_name'),
    preferred_date: I('preferred_date'),
    preferred_time: I('preferred_time'),
    notes:          I('notes'),
    consent:        I('consent'),
    utm_source:     I('utm_source'),
    utm_medium:     I('utm_medium'),
    utm_campaign:   I('utm_campaign'),
    page:           I('page')
  };

  const items = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const dRaw = idx.preferred_date > -1 ? row[idx.preferred_date] : '';
    const dStr = (dRaw instanceof Date) ? ymd(dRaw) : String(dRaw || '').trim();
    if (!inRange(dStr, from, to)) continue;

    items.push({
      submitted_at:   safe(row, idx.submitted_at),
      full_name:      safe(row, idx.full_name),
      phone:          safe(row, idx.phone),
      email:          safe(row, idx.email),
      category:       safe(row, idx.category),
      service_name:   safe(row, idx.service_name) || safe(row, idx.service),
      service:        safe(row, idx.service),
      preferred_date: dStr,
      preferred_time: safe(row, idx.preferred_time),
      notes:          safe(row, idx.notes),
      consent:        safe(row, idx.consent),
      utm_source:     safe(row, idx.utm_source),
      utm_medium:     safe(row, idx.utm_medium),
      utm_campaign:   safe(row, idx.utm_campaign),
      page:           safe(row, idx.page)
    });
  }

  return { ok:true, items };
}

// helpers
function safe(row, i) { return (i > -1 ? String(row[i] == null ? '' : row[i]) : ''); }
function ymd(d) { const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function inRange(d, from, to){ if(!d) return true; if(from && d<from) return false; if(to && d>to) return false; return true; }
function respond(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }





