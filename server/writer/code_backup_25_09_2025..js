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


/** קיצור נוח לשינוי מצב */
function setEnvToProd(){ PropertiesService.getScriptProperties().setProperty('ENV','prod'); }
function setEnvToTest(){ PropertiesService.getScriptProperties().setProperty('ENV','test'); }

/** ===== נקודות קצה — בריאות/בדיקה ===== */
function doGet(e){
  const p = PropertiesService.getScriptProperties().getProperties();
  const info = {
    ok: true,
    env: p.ENV || 'test',
    sheet: p.SPREADSHEET_ID ? 'configured' : 'missing',
    time: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(info))
                       .setMimeType(ContentService.MimeType.JSON);
}

/** ===== נקודת קצה ראשית — מקבל POST JSON מהאתר ===== */
function doPost(e){
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
