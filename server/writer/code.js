/******************************************************
 * cosmetic-landing-page-v1 — Server (Apps Script)
 * תפקיד: לקבל POST מהאתר (Booking/Lead),
 * לשמור בגיליון (Google Sheets),
 * ולשלוח מיילים דרך Mailjet (צוות/הדמיה + לקוח).
 * ניתן להחליף TEST↔PROD ע"י ENV בפרופרטיז — בלי לגעת באתר.
 ******************************************************/

/** ===== הגדרות ראשוניות — הפעלה חד־פעמית =====
 * ערוך את הערכים למטה והרץ את הפונקציה הזו פעם אחת (Run ▶).
 * אפשר גם לערוך/לראות אח"כ דרך: Project Settings → Script properties.
 */
function setMailjetSecrets() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    // מצב השרת: 'test' (סימולציה) או 'prod' (ללקוחה)
    ENV: 'test',

    // מפתחות Mailjet (הראשיים שקיבלת; אין חובה ל-Subaccount)
    MJ_API_KEY:        'PASTE_PRIMARY_API_KEY',
    MJ_API_SECRET:     'PASTE_PRIMARY_API_SECRET',

    // פרטי שולח (Sender מאומת ב-Mailjet)
    MJ_SENDER_EMAIL:   'ofernevo@gmail.com',
    MJ_SENDER_NAME:    'Cosmetic Studio',

    // IDs של תבניות ב-Mailjet (אם יצרת). אם תשאיר ריק — נשלח תוכן HTML בסיסי (Fallback)
    MJ_TEMPLATE_STAFF:  'PASTE_Staff_TemplateID',
    MJ_TEMPLATE_CLIENT: 'PASTE_Client_TemplateID',

    // נמענים: בדמו (ENV=test) נשלח ל-DEMO, בפרודקשן (ENV=prod) נשלח ל-STAFF
    DEMO_RECIPIENTS:   'demo1@example.com,demo2@example.com',
    STAFF_RECIPIENTS:  'owner@clientdomain.com',

    // Google Sheets — אם כבר יש לך גיליון, הדבק את ה-ID שלו.
    // אם לא — הפעל createDemoSpreadsheet(), והיא תיצור גיליון ותעדכן כאן אוטומטית.
    SPREADSHEET_ID:    'PASTE_SPREADSHEET_ID'
  }, true);
}

/** יוצר גיליון חדש (Bookings/Leads) ושומר את ה-ID ב-Properties */
/*function createDemoSpreadsheet() {
  const ss = SpreadsheetApp.create('Cosmetic Landing — Data');
  const id = ss.getId();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);

  const bookings = ss.insertSheet('Bookings');
  const leads    = ss.insertSheet('Leads');
  ss.deleteSheet(ss.getSheetByName('Sheet1')); // מוחק את ברירת־המחדל

  // כותרות ברירת־מחדל
  bookings.getRange(1,1,1,16).setValues([[
    'submitted_at','full_name','phone','email',
    'category','service','service_name',
    'preferred_date','preferred_time','notes','consent',
    'utm_source','utm_medium','utm_campaign','page','raw_json'
  ]]);

  leads.getRange(1,1,1,10).setValues([[
    'submitted_at','full_name','phone','email','consent',
    'utm_source','utm_medium','utm_campaign','page','raw_json'
  ]]);

  return id;
}*/

function createDemoSpreadsheet() {
  const ss = SpreadsheetApp.create('Cosmetic Landing — Data');
  const defaultSheet = ss.getSheets()[0]; // לוכד את גיליון ברירת־המחדל – בלי להסתמך על שם
  const id = ss.getId();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);

  const bookings = ss.insertSheet('Bookings');
  const leads    = ss.insertSheet('Leads');

  // מוחק את ברירת־המחדל רק אם קיימת
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  // כותרות
  const HEADERS_BOOKINGS = [
    'submitted_at','full_name','phone','email',
    'category','service','service_name',
    'preferred_date','preferred_time','notes','consent',
    'utm_source','utm_medium','utm_campaign','page','raw_json'
  ];
  bookings.getRange(1,1,1,HEADERS_BOOKINGS.length).setValues([HEADERS_BOOKINGS]);

  const HEADERS_LEADS = [
    'submitted_at','full_name','phone','email','consent',
    'utm_source','utm_medium','utm_campaign','page','raw_json'
  ];
  leads.getRange(1,1,1,HEADERS_LEADS.length).setValues([HEADERS_LEADS]);

  return id;
}

/**
 * SINGLE_TENANT_()
 * Returns a simple "tenant" config object for a single client.
 * - Reads SPREADSHEET_ID from Script Properties.
 * - If missing, creates a demo spreadsheet and stores its ID.
 * - Provides sheet tab names for Bookings/Leads (customize if yours differ).
 */
function SINGLE_TENANT_() {
  // Access the project-level key-value store
  const props = PropertiesService.getScriptProperties();

  // Try to read the existing spreadsheet ID
  let sheetId = props.getProperty('SPREADSHEET_ID');

  // If not configured yet, create a demo spreadsheet and persist its ID
  if (!sheetId) {
    sheetId = createDemoSpreadsheet();          // ← you already have this in your code
    props.setProperty('SPREADSHEET_ID', sheetId);
  }

  // Return a normalized tenant object used by your API helpers
  return {
    sheetId: sheetId,        // Google Sheet file ID
    booking: 'Bookings',     // bookings tab name (change if your tab has a different name)
    lead:    'Leads',        // leads tab name (change if your tab has a different name)
    cal:     '',             // optional: Google Calendar ID (leave empty for now)
    email:   ''              // optional: notification email (leave empty for now)
  };
}

/** קיצור נוח לשינוי מצב */
function setEnvToProd(){ PropertiesService.getScriptProperties().setProperty('ENV','prod'); }
function setEnvToTest(){ PropertiesService.getScriptProperties().setProperty('ENV','test'); }



//start of doGet for reading of Bookings 22-10-25
/**
 * doGet — נקודת הכניסה לקריאות GET ל-Web App של Apps Script.
 * הקוד קורא את גליון "Bookings" ומחזיר JSON בפורמט שהדשבורד שלך צורך.
 *
 * נתמך:
 *   ?action=status                      ← בדיקת חיים (מחזיר "OK")
 *   ?action=bookings&from=YYYY-MM-DD&to=YYYY-MM-DD
 *                                       ← החזרת רשומות מסוננות לפי preferred_date
 *   ?callback=fnName                    ← תמיכת JSONP (לא חובה)
 */

/*
//full final version of doGet 24-10-25
function doGet(e) {
  // --- 1) פרמטרים ובקרת זרימה בסיסית ---
  var p = (e && e.parameter) ? e.parameter : {};
  var action = String(p.action || '').toLowerCase();

  // פונקציה עוזרת להחזרת JSON (או JSONP אם סופק callback)
  function respond(obj) {
    if (p.callback) {
      // JSONP: עוטפים את ה-JSON בקריאה לפונקציה בשם שהלקוח ביקש
      return ContentService
        .createTextOutput(String(p.callback) + '(' + JSON.stringify(obj) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    // JSON רגיל
    return ContentService
      .createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // --- 2) מסלול בדיקת חיים (ל-Badge בדשבורד) ---
  if (action === 'status') {
    // החזרת טקסט קצר (HTTP 200) שמספיק לדשבורד כדי לסמן "Endpoint OK"
    return ContentService.createTextOutput('OK');
  }

  // --- 3) מסלול טעינת הזמנות מהגליון ---
  if (action === 'bookings') {
    // 3.1 הגדרות — שנה כאן את שם הגיליון אם צריך
    var SHEET_NAME = 'Bookings';

    // טווחי תאריכים שמגיעים מהדשבורד (YYYY-MM-DD). אם לא נשלחו — לא מסננים
    var from = String(p.from || '').trim();
    var to   = String(p.to   || '').trim();

    // 3.2 איתור הגיליון וטעינת כל הנתונים
    var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (!sh) return respond({ ok: false, error: 'Missing sheet: ' + SHEET_NAME });

    var data = sh.getDataRange().getValues();   // מערך דו-ממדי: [שורה][עמודה]
    if (data.length < 2) return respond({ ok: true, items: [] }); // אין נתונים מלבד כותרות

    // 3.3 מיפוי כותרות לעמודות (שורה ראשונה בגיליון)
    // הכותרות אצלך: submitted_at, full_name, phone, email, category, service, service_name,
    //               preferred_date, preferred_time, notes, consent, utm_source, utm_medium,
    //               utm_campaign, page, raw_json
    var headers = data[0].map(function (h) { return String(h).trim().toLowerCase(); });
    function idx(name) { return headers.indexOf(name); } // מוצא את אינדקס העמודה לפי שם כותרת

    var I = {
      submitted_at:   idx('submitted_at'),
      full_name:      idx('full_name'),
      phone:          idx('phone'),
      email:          idx('email'),
      category:       idx('category'),
      service:        idx('service'),
      service_name:   idx('service_name'),
      preferred_date: idx('preferred_date'),
      preferred_time: idx('preferred_time'),
      notes:          idx('notes'),
      consent:        idx('consent'),
      utm_source:     idx('utm_source'),
      utm_medium:     idx('utm_medium'),
      utm_campaign:   idx('utm_campaign'),
      page:           idx('page')
      // raw_json קיים אבל לא נחוץ לדשבורד
    };

    // 3.4 בניית מערך הרשומות להחזרה + סינון לפי תאריכים
    var items = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];

      // תאריך יכול להגיע מהשיטס כאובייקט Date או כמחרוזת; מאחדים לפורמט 'YYYY-MM-DD'
      var dVal = row[I.preferred_date];
      var dStr = (dVal instanceof Date) ? fmtDate(dVal) : String(dVal || '').trim();

      // החלת סינון טווחי תאריכים (אם נשלחו)
      if (!inRange(dStr, from, to)) continue;

      items.push({
        submitted_at:   safe(row, I.submitted_at),
        full_name:      safe(row, I.full_name),
        phone:          safe(row, I.phone),
        email:          safe(row, I.email),
        category:       safe(row, I.category),
        // הדשבורד תומך בשניהם; נותנים עדיפות ל-service_name ואם ריק נ fallback ל-service
        service_name:   safe(row, I.service_name) || safe(row, I.service),
        service:        safe(row, I.service),
        preferred_date: dStr,                                 // בפורמט שהדשבורד מצפה אליו
        preferred_time: safe(row, I.preferred_time),
        notes:          safe(row, I.notes),
        consent:        safe(row, I.consent),
        utm_source:     safe(row, I.utm_source),
        utm_medium:     safe(row, I.utm_medium),
        utm_campaign:   safe(row, I.utm_campaign),
        page:           safe(row, I.page)
      });
    }

    // 3.5 החזרת התוצאה במבנה שהדשבורד מרנדר
    return respond({ ok: true, items: items });
  }

  // --- 4) ברירת מחדל: שגיאה מודרכת ---
  return respond({
    ok: false,
    error: 'Unknown or missing action',
    hint: 'Use ?action=status or ?action=bookings&from=YYYY-MM-DD&to=YYYY-MM-DD'
  });

  // --- 5) עזרי עיבוד מקומיים ---

  // בטוח לקריאה מתא ספציפי (אם אין עמודה/תא — מחזיר מחרוזה ריקה)
  function safe(row, i) {
    return (i > -1 ? String(row[i] == null ? '' : row[i]) : '');
  }

  // המרת Date מהשיטס למחרוזת 'YYYY-MM-DD'
  function fmtDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  // בדיקת שייכות לטווח [from, to] כאשר כל הערכים בפורמט 'YYYY-MM-DD'
  function inRange(dStr, from, to) {
    if (!dStr) return true;          // בלי תאריך בשורה → לא מסננים אותה החוצה
    if (from && dStr < from) return false;
    if (to   && dStr > to)   return false;
    return true;
  }
}
*/
//end of doGet for reading of Bookings 22-10-25
//end of doGet Final Full version 24-10-25


// Start of doGet New 09-10-25
/*
function doGet(e) {
  try {
    // --- 0) קונפיג בסיסי מתוך Script Properties ---
    var props = PropertiesService.getScriptProperties().getProperties();

    // ★ שינוי: לוג התחלה ברור יותר (יעזור באבחון ב-Executions → Logs)
    console.log('[doGet] start; raw params =', e && e.parameter ? JSON.stringify(e.parameter) : '{}');

    // --- 1) סטטוס בסיסי (נוח גם לדיבוג) ---
    var baseStatus = {
      ok: true,
      env: props.ENV || 'test',
      sheet: props.SPREADSHEET_ID ? 'configured' : 'missing',
      time: new Date().toISOString()
    };

    // --- 2) קריאת action מה-URL (ברירת מחדל: status) ---
    var p = (e && e.parameter) ? e.parameter : {};
    var action = (p.action ? String(p.action) : 'status').toLowerCase();

    // ★ שינוי: לוג ממוקד של הפעולה המבוקשת
    console.log('[doGet] action =', action);

    // --- A) סטטוס (בריאות) ---
    if (action === 'status') {
      // ללא תלות בשאר — תמיד מחזיר סטטוס
      return ContentService
        .createTextOutput(JSON.stringify(baseStatus))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ★ שינוי: בדיקת קיום Spreadsheet ID לפני המשך (מונע שגיאות לא ברורות)
    if (!props.SPREADSHEET_ID) {
      console.warn('[doGet] missing SPREADSHEET_ID in Script Properties');
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'missing_spreadsheet_id' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- 3) הגדרת "טננט" סינגל (Spreadsheet יחיד, טאב Bookings) ---
    var tenant = {
      sheetId: props.SPREADSHEET_ID,
      booking: 'Bookings' // אם אצלך שם הטאב שונה — עדכן כאן
    };

    // --- 4) פונקציית עזר פנימית: קריאת הזמנות מטווח תאריכים ---
    function listBookings_(fromStr, toStr, limitNum) {
      var ss = SpreadsheetApp.openById(tenant.sheetId);
      var sh = ss.getSheetByName(tenant.booking || 'Bookings');
      if (!sh) {
        console.warn('[doGet] sheet not found:', tenant.booking);
        return [];
      }

      var rows = sh.getDataRange().getValues();
      if (!rows || rows.length < 2) return [];

      // ★ שינוי: אינדוקס כותרות בצורה עמידה (ללא תלות ברישיות)
      var header = rows[0].map(function (h) { return String(h || '').trim(); });
      var idx = {};
      header.forEach(function (h, i) { idx[h] = i; });

      // ★ שינוי: תמיכה בכותרות חלופיות נפוצות (אם מישהו שינה ידנית)
      // אם הכותרת "preferred_date" לא קיימת, ננסה וריאציות אחרות
      var dateKey = 'preferred_date';
      if (idx[dateKey] == null) {
        var alt = ['date', 'preferredDate', 'תאריך', 'תאריך_מועדף'];
        for (var k = 0; k < alt.length; k++) {
          if (idx[alt[k]] != null) { dateKey = alt[k]; break; }
        }
      }

      // הגדרת טווח התאריכים
      var fromD = fromStr ? new Date(fromStr + 'T00:00:00') : null;
      var toD   = toStr   ? new Date(toStr   + 'T23:59:59') : null;

      var out = [];
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];

        // ★ שינוי: שימוש במפתח היעיל שמצאנו עבור תאריך
        var dStr = (idx[dateKey] != null) ? String(r[idx[dateKey]] || '') : '';
        if (!dStr) continue; // בלי תאריך — מדלגים

        var dt = new Date(dStr + 'T00:00:00');
        if (fromD && dt < fromD) continue;
        if (toD   && dt > toD)   continue;

        out.push({
          submitted_at:    (idx.submitted_at    != null) ? r[idx.submitted_at]    : '',
          full_name:       (idx.full_name       != null) ? r[idx.full_name]       : '',
          phone:           (idx.phone           != null) ? r[idx.phone]           : '',
          email:           (idx.email           != null) ? r[idx.email]           : '',
          category:        (idx.category        != null) ? r[idx.category]        : '',
          service:         (idx.service         != null) ? r[idx.service]         : '',
          service_name:    (idx.service_name    != null) ? r[idx.service_name]    : '',
          preferred_date:  dStr,
          preferred_time:  (idx.preferred_time  != null) ? String(r[idx.preferred_time] || '') : '',
          notes:           (idx.notes           != null) ? r[idx.notes]           : '',
          consent:         (idx.consent         != null) ? r[idx.consent]         : '',
          page:            (idx.page            != null) ? r[idx.page]            : ''
        });

        if (limitNum && out.length >= limitNum) break;
      }

      // ★ שינוי: מיון בטוח גם אם שעה ריקה (שומר על סדר כרונולוגי)
      out.sort(function (a, b) {
        var ak = (a.preferred_date || '') + ' ' + (a.preferred_time || '');
        var bk = (b.preferred_date || '') + ' ' + (b.preferred_time || '');
        return ak.localeCompare(bk);
      });

      return out;
    }

    // --- 5) bookings: כל ההזמנות בטווח ---
    if (action === 'bookings') {
      // ★ שינוי: ברירות מחדל “רחבות” כדי שתמיד תחזור תוצאה בבדיקה ידנית
      var from = p.from || '2000-01-01';
      var to   = p.to   || '2100-12-31';
      var limit = p.limit ? Number(p.limit) : 2000;

      // אם קיימת אצלך apiListBookings_ (גרסת העזר החיצונית) — נשתמש בה
      var items;
      if (typeof apiListBookings_ === 'function') {
        items = apiListBookings_({ sheetId: tenant.sheetId, booking: tenant.booking }, { from: from, to: to, limit: limit });
      } else {
        // אחרת — נשתמש בפנימית
        items = listBookings_(from, to, limit);
      }

      console.log('[doGet] bookings → count:', items.length);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, items: items }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- 6) day: כל ההזמנות ליום בודד ---
    if (action === 'day') {
      // אפשר לקבל כ-param בשם date או day
      var dateStr = p.date || p.day || '';
      if (!dateStr) {
        return ContentService
          .createTextOutput(JSON.stringify({ ok: false, error: 'missing_date' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var dayItems = (typeof apiListBookings_ === 'function')
        ? apiListBookings_({ sheetId: tenant.sheetId, booking: tenant.booking }, { from: dateStr, to: dateStr, limit: 500 })
        : listBookings_(dateStr, dateStr, 500);

      console.log('[doGet] day →', dateStr, 'count:', dayItems.length);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, date: dateStr, items: dayItems }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- 7) פעולה לא מוכרת ---
    console.warn('[doGet] unknown action:', action);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'unknown_action' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    // --- 8) שגיאה כללית ---
    console.error('[doGet] error:', err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
*/
// End of doGet New 09-10-25


// מחזיר מערך של אובייקטים מהטאב Bookings בטווח תאריכים (כולל)
function apiListBookings_(tenant, opts) {
  const ss = SpreadsheetApp.openById(tenant.sheetId);
  const sh = ss.getSheetByName(tenant.booking || 'Bookings');
  if (!sh) return [];

  const rows = sh.getDataRange().getValues();
  if (!rows || rows.length < 2) return [];

  const header = rows[0].map(String);
  const col = (name) => header.indexOf(name);

  const ix = {
    submitted_at: col('submitted_at'),
    full_name:    col('full_name'),
    phone:        col('phone'),
    email:        col('email'),
    category:     col('category'),
    service:      col('service'),
    service_name: col('service_name'),
    preferred_date: col('preferred_date'),
    preferred_time: col('preferred_time'),
    notes:        col('notes'),
    consent:      col('consent'),
    page:         col('page')
  };

  const from = (opts && opts.from) ? new Date(opts.from + 'T00:00:00') : null;
  const to   = (opts && opts.to)   ? new Date(opts.to   + 'T23:59:59') : null;
  const limit = (opts && opts.limit) ? Number(opts.limit) : 500;

  const out = [];
  for (let i=1; i<rows.length; i++){
    const r = rows[i];
    const dStr = ix.preferred_date>=0 ? String(r[ix.preferred_date] || '') : '';
    if (!dStr) continue;
    const dt = new Date(dStr + 'T00:00:00');
    if (from && dt < from) continue;
    if (to && dt > to) continue;

    out.push({
      submitted_at:    ix.submitted_at>=0 ? r[ix.submitted_at] : '',
      full_name:       ix.full_name>=0    ? r[ix.full_name]    : '',
      phone:           ix.phone>=0        ? r[ix.phone]        : '',
      email:           ix.email>=0        ? r[ix.email]        : '',
      category:        ix.category>=0     ? r[ix.category]     : '',
      service:         ix.service>=0      ? r[ix.service]      : '',
      service_name:    ix.service_name>=0 ? r[ix.service_name] : '',
      preferred_date:  dStr,
      preferred_time:  ix.preferred_time>=0 ? String(r[ix.preferred_time] || '') : '',
      notes:           ix.notes>=0        ? r[ix.notes]        : '',
      consent:         ix.consent>=0      ? r[ix.consent]      : '',
      page:            ix.page>=0         ? r[ix.page]         : ''
    });

    if (out.length >= limit) break;
  }

  // מיון עולה לפי תאריך+שעה
  out.sort((a,b) => (a.preferred_date+a.preferred_time).localeCompare(b.preferred_date+b.preferred_time));
  return out;
}

// מחזיר כל ההזמנות לאותו יום — נוח לחסימת שעות בטופס ההזמנה
function apiListBookingsForDate_(tenant, dateStr) {
  if (!dateStr) return [];
  return apiListBookings_(tenant, { from: dateStr, to: dateStr, limit: 200 });
}




/** ===== נקודת קצה ראשית — מקבל POST JSON מהאתר ===== */
function doPost(e){
  
  // ---- DEBUG LOGS (place at the top of doPost) ----
  try {
    Logger.log('[doPost] Raw e: %s', JSON.stringify(e));
    // Apps Script puts the raw POST body at e.postData.contents
    const body = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    Logger.log('[doPost] postData.contents: %s', body);
  } catch (err) {
    Logger.log('[doPost] Logging error: %s', String(err));
  }
  // -----------------------------------------------
  
  
  try {
    const body = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(body);

    // שמירה בגיליון
    persist_(payload);

    // שליחות מיילים
    const type = (payload.type || '').toLowerCase();
    if (type === 'booking') {
      sendBookingEmails(payload);
    } else if (type === 'lead') {
      sendLeadEmails(payload);
    }

    return json_({ ok:true, msg:'stored & mailed', type, ts:new Date().toISOString() });
  } catch(err){
    console.error(err);
    return json_({ ok:false, error: String(err) }, 500);
  }
}

/** יצירת תשובת JSON */
function json_(obj, code){
  const out = ContentService.createTextOutput(JSON.stringify(obj))
                            .setMimeType(ContentService.MimeType.JSON);
  if (code) {
    // אין API רשמי לשינוי קוד תשובה; נשתמש בברירת־המחדל 200
  }
  return out;
}

/** ===== שמירה לגיליון ===== */
function persist_(payload){
  const p  = PropertiesService.getScriptProperties().getProperties();
  let ssId = p.SPREADSHEET_ID;
  if (!ssId) ssId = createDemoSpreadsheet();

  const ss = SpreadsheetApp.openById(ssId);
  const type = (payload.type || '').toLowerCase();

  if (type === 'booking') {
    const sh = ensureSheet_(ss, 'Bookings', [
      'submitted_at','full_name','phone','email',
      'category','service','service_name',
      'preferred_date','preferred_time','notes','consent',
      'utm_source','utm_medium','utm_campaign','page','raw_json'
    ]);
    const row = [
      payload.submitted_at || new Date().toISOString(),
      payload.full_name || '',
      payload.phone || '',
      payload.email || '',
      payload.category || '',
      payload.service || '',
      payload.service_name || '',
      payload.preferred_date || '',
      payload.preferred_time || '',
      payload.notes || '',
      payload.consent || '',
      payload.utm_source || payload.source || '',
      payload.utm_medium || payload.medium || '',
      payload.utm_campaign || payload.campaign || '',
      payload.page || '',
      JSON.stringify(payload)
    ];
    sh.appendRow(row);

  } else if (type === 'lead') {
    const sh = ensureSheet_(ss, 'Leads', [
      'submitted_at','full_name','phone','email','consent',
      'utm_source','utm_medium','utm_campaign','page','raw_json'
    ]);
    const row = [
      payload.submitted_at || new Date().toISOString(),
      payload.full_name || '',
      payload.phone || '',
      payload.email || '',
      payload.consent || '',
      payload.utm_source || payload.source || '',
      payload.utm_medium || payload.medium || '',
      payload.utm_campaign || payload.campaign || '',
      payload.page || '',
      JSON.stringify(payload)
    ];
    sh.appendRow(row);
  }
}

/** וידוא קיום גיליון והטענת כותרות פעם ראשונה */
function ensureSheet_(ss, name, headers){
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const lastCol = sh.getLastColumn();
  if (lastCol === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  return sh;
}

/** ===== Mailjet: שליחות ===== */
function mailjetAuthHeader_(){
  const p = PropertiesService.getScriptProperties().getProperties();
  return 'Basic ' + Utilities.base64Encode(p.MJ_API_KEY + ':' + p.MJ_API_SECRET);
}

function sendMailjet_(messages){
  const url = 'https://api.mailjet.com/v3.1/send';
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: mailjetAuthHeader_() },
    payload: JSON.stringify({ Messages: messages }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Mailjet send failed: ' + code + ' ' + res.getContentText());
  }
}

function sendBookingEmails(payload){
  const p = PropertiesService.getScriptProperties().getProperties();
  const isProd = (p.ENV || 'test') === 'prod';
  const from   = { Email: p.MJ_SENDER_EMAIL, Name: p.MJ_SENDER_NAME };
  const staff  = (isProd ? p.STAFF_RECIPIENTS : p.DEMO_RECIPIENTS)
                  .split(',').map(e=>({Email:e.trim()})).filter(x=>x.Email);

  const msgs = [];

  // 1) התראה לצוות
  if (p.MJ_TEMPLATE_STAFF) {
    msgs.push({
      From: from, To: staff,
      TemplateID: Number(p.MJ_TEMPLATE_STAFF),
      TemplateLanguage: true,
      Subject: "New booking request",
      Variables: payload
    });
  } else {
    // Fallback בלי תבנית
    const html = `
      <h3>New booking</h3>
      <p><b>${payload.full_name || ''}</b> — ${payload.service_name || ''} (${payload.category || ''})</p>
      <p>${payload.preferred_date || ''} ${payload.preferred_time || ''}</p>
      <p>Phone: ${payload.phone || ''} · Email: ${payload.email || ''}</p>
      <p>Notes: ${payload.notes || '-'}</p>`;
    msgs.push({
      From: from, To: staff, Subject: "New booking request",
      HTMLPart: html, TextPart: "New booking from " + (payload.full_name || '')
    });
  }

  // 2) אישור ללקוח: ב-PROD נשלח ללקוח; ב-TEST נשלח לעותק הדמיה (staff[0])
  const clientEmail = (payload.email || payload.to_email_client || '').trim();
  const clientTo    = (isProd && clientEmail) ? [{Email: clientEmail}]
                    : (staff.length ? [staff[0]] : []);
  if (clientTo.length){
    if (p.MJ_TEMPLATE_CLIENT) {
      msgs.push({
        From: from, To: clientTo,
        TemplateID: Number(p.MJ_TEMPLATE_CLIENT),
        TemplateLanguage: true,
        Subject: "Booking request received",
        Variables: payload
      });
    } else {
      const htmlC = `
        <h3>Thanks, ${payload.full_name || 'Customer'}!</h3>
        <p>We received your booking for <b>${payload.service_name || ''}</b>.</p>
        <p>Preferred: ${payload.preferred_date || ''} ${payload.preferred_time || ''}</p>`;
      msgs.push({
        From: from, To: clientTo, Subject: "Booking received",
        HTMLPart: htmlC, TextPart: "We received your booking."
      });
    }
  }

  if (msgs.length) sendMailjet_(msgs);
}

function sendLeadEmails(payload){
  const p = PropertiesService.getScriptProperties().getProperties();
  const isProd = (p.ENV || 'test') === 'prod';
  const from   = { Email: p.MJ_SENDER_EMAIL, Name: p.MJ_SENDER_NAME };
  const staff  = (isProd ? p.STAFF_RECIPIENTS : p.DEMO_RECIPIENTS)
                  .split(',').map(e=>({Email:e.trim()})).filter(x=>x.Email);

  if (!staff.length) return;

  if (p.MJ_TEMPLATE_STAFF) {
    sendMailjet_([{
      From: from, To: staff,
      TemplateID: Number(p.MJ_TEMPLATE_STAFF),
      TemplateLanguage: true,
      Subject: "New lead",
      Variables: payload
    }]);
  } else {
    const html = `
      <h3>New lead</h3>
      <p><b>${payload.full_name || ''}</b> · ${payload.phone || ''} · ${payload.email || '-'}</p>`;
    sendMailjet_([{
      From: from, To: staff, Subject: "New lead",
      HTMLPart: html, TextPart: "New lead from " + (payload.full_name || '')
    }]);
  }
}
