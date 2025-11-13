
// JavaScript source code - Ver02
// ================================================================
// קובץ לוגיקה ראשי — [UPGRADE v2]:
// - וידאו עם בקרי נגישות + נפילה עדינה אם autoplay חסום
// - טפסים: הזמנת תור + לידים, ולידציה ידידותית
// - שליחה: EmailJS + עותק ל-Formspree / Apps Script (לוג/קבוצה)
// - שמירת UTM + דף מקור, כפתור וואטסאפ ממולא, Analytics hook
// ================================================================

// ---------- Utilities ----------
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function fmtPhone(v) { return (v || "").replace(/[^\d+]/g, ""); }

const UTM = (() => {
    const q = new URLSearchParams(location.search);
    return {
        source: q.get('utm_source') || '(direct)',
        medium: q.get('utm_medium') || '(none)',
        campaign: q.get('utm_campaign') || '(none)',
        page: location.pathname + location.search
    };
})();

function setHiddenUTM(form) {
    ["utm_source", "utm_medium", "utm_campaign", "page"].forEach(k => {
        const el = form.querySelector(`[name="${k}"]`);
        if (el) el.value = UTM[k.replace('utm_', '')] || UTM[k] || "";
    });
}

const track = {
    event(name, params) {
        try { if (window.gtag) gtag('event', name, params || {}); } catch (_) { }
        try { if (window.fbq) fbq('trackCustom', name, params || {}); } catch (_) { }
    }
};

// ---------- Video: autoplay safe + controls ----------
(function ensureHeroVideo() {
    const video = $('#heroVideo');
    if (!video) return;
    const p = video.play();
    if (p && typeof p.then === 'function') {
        p.catch(() => { // דפדפן חסם
            video.removeAttribute('autoplay');
            try { video.pause(); } catch (_) { }
            document.body.classList.add('no-video-autoplay');
        });
    }
})();

(function videoControls() {
    const v = $('#heroVideo');
    const toggle = $('#videoToggle');
    const mute = $('#videoMute');
    if (!v || !toggle || !mute) return;

    toggle.addEventListener('click', () => {
        if (v.paused) { v.play(); toggle.setAttribute('aria-pressed', 'true'); }
        else { v.pause(); toggle.setAttribute('aria-pressed', 'false'); }
    });
    mute.addEventListener('click', () => {
        v.muted = !v.muted;
        mute.setAttribute('aria-pressed', String(!v.muted));
    });
})();

// ---------- Services Catalog ----------
const CATALOG = { // [UPGRADE v2] דוגמה משופרת
    manicure: [
        { id: 'basic_mani', name: 'מניקור בסיסי', durationMin: 40, price: 120 },
        { id: 'gel_mani', name: 'מניקור ג׳ל', durationMin: 60, price: 170 },
    ],
    pedicure: [
        { id: 'basic_pedi', name: 'פדיקור בסיסי', durationMin: 50, price: 150 },
        { id: 'spa_pedi', name: 'פדיקור ספא', durationMin: 70, price: 220 },
    ],
    nails: [
        { id: 'build_nails', name: 'בניית ציפורניים', durationMin: 90, price: 280 },
        { id: 'fill_nails', name: 'מילוי', durationMin: 75, price: 200 },
    ],
    facial: [
        { id: 'classic_facial', name: 'ניקוי פנים', durationMin: 60, price: 240 },
        { id: 'antiaging_facial', name: 'אנטי-אייג׳ינג', durationMin: 75, price: 320 },
        { id: 'personal_facial', name: 'טיפול מותאם', durationMin: 90, price: 360 },
    ],
    wax: [
        { id: 'full_legs', name: 'רגליים מלא', durationMin: 45, price: 140 },
        { id: 'armpits', name: 'בית שחי', durationMin: 20, price: 70 },
    ],
    brows: [
        { id: 'brow_shape', name: 'עיצוב גבות', durationMin: 20, price: 70 },
        { id: 'lash_lift', name: 'הרמת ריסים', durationMin: 45, price: 220 },
    ],
};

(function populateServices() {
    const cat = $('#category'), svc = $('#service'), meta = $('#svcMeta');
    if (!cat || !svc) return;
    cat.addEventListener('change', () => {
        const arr = CATALOG[cat.value] || [];
        svc.innerHTML = `<option value="">בחרו...</option>` + arr.map(o => (
            `<option value="${o.id}" data-duration="${o.durationMin}" data-price="${o.price}">${o.name}</option>`
        )).join('');
        meta.textContent = arr.length ? 'בחרו סוג טיפול' : '';
    });
    svc.addEventListener('change', () => {
        const o = svc.selectedOptions[0];
        meta.textContent = o ? `משך משוער: ${o.dataset.duration} ד׳ · ₪${o.dataset.price}` : '';
    });
})();

// ---------- Dates ----------
(function setMinDateToday() {
    const date = $('#date');
    if (!date) return;
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, '0');
    const dd = String(t.getDate()).padStart(2, '0');
    date.min = `${yyyy}-${mm}-${dd}`;
})();

// ---------- WhatsApp ----------
function openWhatsAppFromForm(form) {
    const name = form.full_name.value.trim();
    const svcSel = $('#service');
    const svcName = svcSel && svcSel.selectedOptions[0] ? svcSel.selectedOptions[0].textContent : (form.service?.value || '');
    const date = form.preferred_date?.value || '';
    const time = form.preferred_time?.value || '';
    const msg = `שלום, אני ${name}. מעוניינ/ת ב${svcName} בתאריך ${date} בשעה ${time}.`;
    const phone = CONFIG.WHATSAPP_PHONE_E164;
    if (!phone) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    track.event('whatsapp_click', { placement: 'form' });
}

// ---------- Validation ----------
function validateRequired(input, fn) {
    const ok = fn ? fn(input.value) : !!input.value.trim();
    const err = $(`#err_${input.id}`);
    if (err) err.textContent = ok ? '' : 'שדה חובה';
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
}

// ---------- EmailJS Init ----------
(function initEmailJS() {
    if (window.emailjs && CONFIG.emailjs.PUBLIC_KEY) {
        try { emailjs.init(CONFIG.emailjs.PUBLIC_KEY); } catch (e) { console.warn('EmailJS init failed', e); }
    }
})();

// ---------- Submit Handlers ----------
async function sendEmailJS(type, data) {
    if (!window.emailjs || !CONFIG.emailjs.PUBLIC_KEY) return;
    const svc = CONFIG.emailjs.SERVICE_ID[CONFIG.MODE];
    const tmpl = CONFIG.emailjs.TEMPLATE[type][CONFIG.MODE];
    if (!svc || !tmpl) return;
    try {
        await emailjs.send(svc, tmpl, data);
    } catch (e) { console.warn('EmailJS send failed', e); }
}

/*
async function postJSON(url, payload) {
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.warn('POST failed', e); }
}
*/

async function postJSON(url, payload) {
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            // בלי כותרות "מיוחדות" שגורמות לפרה-פלייט
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.warn('POST failed', e); }
}

// Booking
(function bookingSubmit() {
    const form = $('#bookingForm');
    const status = $('#bookStatus');
    const waBtn = $('#waFromForm');
    if (!form) return;

    setHiddenUTM(form);
    waBtn?.addEventListener('click', () => openWhatsAppFromForm(form));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // validation
        const okName = validateRequired($('#full_name'));
        const okPhone = validateRequired($('#phone'), v => fmtPhone(v).length >= 9);
        const okCat = validateRequired($('#category'));
        const okSvc = validateRequired($('#service'));
        const okDate = validateRequired($('#date'));
        const okCons = $('#consent').checked;
        if (!okCons) $('#consent').focus();

        if (!(okName && okPhone && okCat && okSvc && okDate && okCons)) return;

        const payload = {
            type: 'booking',
            full_name: $('#full_name').value.trim(),
            phone: fmtPhone($('#phone').value),
            email: $('#email').value.trim(),

            // 👇👇👇 *** זוהי השורה החדשה שיש להוסיף ***
            to_email_client: document.querySelector('#email').value.trim(), // ← כדי לשלוח אישור ללקוח באמצעות EmailJS
            // ☝☝☝ הוסף/י מיד אחרי שדה email (או לידו). חשוב שהשם יתאים לתבנית ב-EmailJS.

            category: $('#category').value,
            service: $('#service').value,
            service_name: $('#service').selectedOptions[0]?.textContent || '',
            preferred_date: $('#date').value,
            preferred_time: $('#time').value,
            notes: $('#notes').value,
            consent: $('#consent').checked ? 'yes' : 'no',
            ...UTM,
            submitted_at: new Date().toISOString(),
            sim_group: (CONFIG.storage.SIM_GROUP_EMAILS || []).join(',')
        };

        status.textContent = 'שולח...';
        await sendEmailJS('BOOKING', payload);
        await postJSON(CONFIG.storage.formspree.BOOKING[CONFIG.MODE], payload); // אופציונלי
        // await postJSON(CONFIG.storage.sheetWebApp.BOOKING[CONFIG.MODE], payload); // (הישן) — הוחלף
        await postJSON(CONFIG.endpoints.BOOKING, payload); // >>> CHANGED: שימוש ב-unified EXEC_URL

        status.textContent = 'הבקשה נשלחה. נחזור אליך לתיאום.';
        track.event('booking_submit', { category: payload.category, service: payload.service });
        form.reset();
        setHiddenUTM(form);
    });
})();

// Leads
(function leadSubmit() {
    const form = $('#leadForm');
    const status = $('#leadStatus');
    if (!form) return;
    setHiddenUTM(form);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const okName = validateRequired($('#lead_name'));
        const okPhone = validateRequired($('#lead_phone'), v => fmtPhone(v).length >= 9);
        const okCons = $('#lead_ok').checked;
        if (!okCons) $('#lead_ok').focus();
        if (!(okName && okPhone && okCons)) return;

        const payload = {
            type: 'lead',
            full_name: $('#lead_name').value.trim(),
            phone: fmtPhone($('#lead_phone').value),
            email: $('#lead_email').value.trim(),
            consent: $('#lead_ok').checked ? 'yes' : 'no',
            ...UTM,
            submitted_at: new Date().toISOString(),
            sim_group: (CONFIG.storage.SIM_GROUP_EMAILS || []).join(',')
        };

        status.textContent = 'שולח...';
        await sendEmailJS('LEAD', payload);
        await postJSON(CONFIG.storage.formspree.LEAD[CONFIG.MODE], payload); // אופציונלי
        // await postJSON(CONFIG.storage.sheetWebApp.LEAD[CONFIG.MODE], payload); // (הישן) — הוחלף
        await postJSON(CONFIG.endpoints.LEAD, payload); // >>> CHANGED: שימוש ב-unified EXEC_URL

        status.textContent = 'קיבלנו! נוסיף אותך לרשימת המבצעים.';
        track.event('lead_submit', {});
        form.reset();
        setHiddenUTM(form);
    });
})();

// ---------- WhatsApp CTA (header) ----------
(function bindHeaderWA() {
    const a = $('#waCTA');
    if (!a || !CONFIG.WHATSAPP_PHONE_E164) return;
    const msg = `שלום, אשמח לפרטים על טיפולים ומבצעים.`;
    a.href = `https://wa.me/${CONFIG.WHATSAPP_PHONE_E164}?text=${encodeURIComponent(msg)}`;
})();


/*
// JavaScript source code - Ver0.1
// ================================================================
// קובץ לוגיקה ראשי — [UPGRADE v2]:
// - וידאו עם בקרי נגישות + נפילה עדינה אם autoplay חסום
// - טפסים: הזמנת תור + לידים, ולידציה ידידותית
// - שליחה: EmailJS + עותק ל-Formspree / Apps Script (לוג/קבוצה)
// - שמירת UTM + דף מקור, כפתור וואטסאפ ממולא, Analytics hook
// ================================================================

// ---------- Utilities ----------
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function fmtPhone(v) { return (v || "").replace(/[^\d+]/g, ""); }

const UTM = (() => {
    const q = new URLSearchParams(location.search);
    return {
        source: q.get('utm_source') || '(direct)',
        medium: q.get('utm_medium') || '(none)',
        campaign: q.get('utm_campaign') || '(none)',
        page: location.pathname + location.search
    };
})();

function setHiddenUTM(form) {
    ["utm_source", "utm_medium", "utm_campaign", "page"].forEach(k => {
        const el = form.querySelector(`[name="${k}"]`);
        if (el) el.value = UTM[k.replace('utm_', '')] || UTM[k] || "";
    });
}

const track = {
    event(name, params) {
        try { if (window.gtag) gtag('event', name, params || {}); } catch (_) { }
        try { if (window.fbq) fbq('trackCustom', name, params || {}); } catch (_) { }
    }
};

// ---------- Video: autoplay safe + controls ----------
(function ensureHeroVideo() {
    const video = $('#heroVideo');
    if (!video) return;
    const p = video.play();
    if (p && typeof p.then === 'function') {
        p.catch(() => { // דפדפן חסם
            video.removeAttribute('autoplay');
            try { video.pause(); } catch (_) { }
            document.body.classList.add('no-video-autoplay');
        });
    }
})();

(function videoControls() {
    const v = $('#heroVideo');
    const toggle = $('#videoToggle');
    const mute = $('#videoMute');
    if (!v || !toggle || !mute) return;

    toggle.addEventListener('click', () => {
        if (v.paused) { v.play(); toggle.setAttribute('aria-pressed', 'true'); }
        else { v.pause(); toggle.setAttribute('aria-pressed', 'false'); }
    });
    mute.addEventListener('click', () => {
        v.muted = !v.muted;
        mute.setAttribute('aria-pressed', String(!v.muted));
    });
})();

// ---------- Services Catalog ----------
const CATALOG = { // [UPGRADE v2] דוגמה משופרת
    manicure: [
        { id: 'basic_mani', name: 'מניקור בסיסי', durationMin: 40, price: 120 },
        { id: 'gel_mani', name: 'מניקור ג׳ל', durationMin: 60, price: 170 },
    ],
    pedicure: [
        { id: 'basic_pedi', name: 'פדיקור בסיסי', durationMin: 50, price: 150 },
        { id: 'spa_pedi', name: 'פדיקור ספא', durationMin: 70, price: 220 },
    ],
    nails: [
        { id: 'build_nails', name: 'בניית ציפורניים', durationMin: 90, price: 280 },
        { id: 'fill_nails', name: 'מילוי', durationMin: 75, price: 200 },
    ],
    facial: [
        { id: 'classic_facial', name: 'ניקוי פנים', durationMin: 60, price: 240 },
        { id: 'antiaging_facial', name: 'אנטי-אייג׳ינג', durationMin: 75, price: 320 },
        { id: 'personal_facial', name: 'טיפול מותאם', durationMin: 90, price: 360 },
    ],
    wax: [
        { id: 'full_legs', name: 'רגליים מלא', durationMin: 45, price: 140 },
        { id: 'armpits', name: 'בית שחי', durationMin: 20, price: 70 },
    ],
    brows: [
        { id: 'brow_shape', name: 'עיצוב גבות', durationMin: 20, price: 70 },
        { id: 'lash_lift', name: 'הרמת ריסים', durationMin: 45, price: 220 },
    ],
};

(function populateServices() {
    const cat = $('#category'), svc = $('#service'), meta = $('#svcMeta');
    if (!cat || !svc) return;
    cat.addEventListener('change', () => {
        const arr = CATALOG[cat.value] || [];
        svc.innerHTML = `<option value="">בחרו...</option>` + arr.map(o => (
            `<option value="${o.id}" data-duration="${o.durationMin}" data-price="${o.price}">${o.name}</option>`
        )).join('');
        meta.textContent = arr.length ? 'בחרו סוג טיפול' : '';
    });
    svc.addEventListener('change', () => {
        const o = svc.selectedOptions[0];
        meta.textContent = o ? `משך משוער: ${o.dataset.duration} ד׳ · ₪${o.dataset.price}` : '';
    });
})();

// ---------- Dates ----------
(function setMinDateToday() {
    const date = $('#date');
    if (!date) return;
    const t = new Date();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, '0');
    const dd = String(t.getDate()).padStart(2, '0');
    date.min = `${yyyy}-${mm}-${dd}`;
})();

// ---------- WhatsApp ----------
function openWhatsAppFromForm(form) {
    const name = form.full_name.value.trim();
    const svcSel = $('#service');
    const svcName = svcSel && svcSel.selectedOptions[0] ? svcSel.selectedOptions[0].textContent : (form.service?.value || '');
    const date = form.preferred_date?.value || '';
    const time = form.preferred_time?.value || '';
    const msg = `שלום, אני ${name}. מעוניינ/ת ב${svcName} בתאריך ${date} בשעה ${time}.`;
    const phone = CONFIG.WHATSAPP_PHONE_E164;
    if (!phone) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    track.event('whatsapp_click', { placement: 'form' });
}

// ---------- Validation ----------
function validateRequired(input, fn) {
    const ok = fn ? fn(input.value) : !!input.value.trim();
    const err = $(`#err_${input.id}`);
    if (err) err.textContent = ok ? '' : 'שדה חובה';
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
}

// ---------- EmailJS Init ----------
(function initEmailJS() {
    if (window.emailjs && CONFIG.emailjs.PUBLIC_KEY) {
        try { emailjs.init(CONFIG.emailjs.PUBLIC_KEY); } catch (e) { console.warn('EmailJS init failed', e); }
    }
})();

// ---------- Submit Handlers ----------
async function sendEmailJS(type, data) {
    if (!window.emailjs || !CONFIG.emailjs.PUBLIC_KEY) return;
    const svc = CONFIG.emailjs.SERVICE_ID[CONFIG.MODE];
    const tmpl = CONFIG.emailjs.TEMPLATE[type][CONFIG.MODE];
    if (!svc || !tmpl) return;
    try {
        await emailjs.send(svc, tmpl, data);
    } catch (e) { console.warn('EmailJS send failed', e); }
}

/*
async function postJSON(url, payload) {
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.warn('POST failed', e); }
}


async function postJSON(url, payload) {
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            // בלי כותרות "מיוחדות" שגורמות לפרה-פלייט
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.warn('POST failed', e); }
}


// Booking
(function bookingSubmit() {
    const form = $('#bookingForm');
    const status = $('#bookStatus');
    const waBtn = $('#waFromForm');
    if (!form) return;

    setHiddenUTM(form);
    waBtn?.addEventListener('click', () => openWhatsAppFromForm(form));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // validation
        const okName = validateRequired($('#full_name'));
        const okPhone = validateRequired($('#phone'), v => fmtPhone(v).length >= 9);
        const okCat = validateRequired($('#category'));
        const okSvc = validateRequired($('#service'));
        const okDate = validateRequired($('#date'));
        const okCons = $('#consent').checked;
        if (!okCons) $('#consent').focus();

        if (!(okName && okPhone && okCat && okSvc && okDate && okCons)) return;

        const payload = {
            type: 'booking',
            full_name: $('#full_name').value.trim(),
            phone: fmtPhone($('#phone').value),
            email: $('#email').value.trim(),

            // 👇👇👇 *** זוהי השורה החדשה שיש להוסיף ***
            to_email_client: document.querySelector('#email').value.trim(), // ← כדי לשלוח אישור ללקוח באמצעות EmailJS
            // ☝☝☝ הוסף/י מיד אחרי שדה email (או לידו). חשוב שהשם יתאים לתבנית ב-EmailJS.

            category: $('#category').value,
            service: $('#service').value,
            service_name: $('#service').selectedOptions[0]?.textContent || '',
            preferred_date: $('#date').value,
            preferred_time: $('#time').value,
            notes: $('#notes').value,
            consent: $('#consent').checked ? 'yes' : 'no',
            ...UTM,
            submitted_at: new Date().toISOString(),
            sim_group: (CONFIG.storage.SIM_GROUP_EMAILS || []).join(',')
        };

        status.textContent = 'שולח...';
        await sendEmailJS('BOOKING', payload);
        await postJSON(CONFIG.storage.formspree.BOOKING[CONFIG.MODE], payload);
        await postJSON(CONFIG.storage.sheetWebApp.BOOKING[CONFIG.MODE], payload);

        status.textContent = 'הבקשה נשלחה. נחזור אליך לתיאום.';
        track.event('booking_submit', { category: payload.category, service: payload.service });
        form.reset();
        setHiddenUTM(form);
    });
})();

// Leads
(function leadSubmit() {
    const form = $('#leadForm');
    const status = $('#leadStatus');
    if (!form) return;
    setHiddenUTM(form);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const okName = validateRequired($('#lead_name'));
        const okPhone = validateRequired($('#lead_phone'), v => fmtPhone(v).length >= 9);
        const okCons = $('#lead_ok').checked;
        if (!okCons) $('#lead_ok').focus();
        if (!(okName && okPhone && okCons)) return;

        const payload = {
            type: 'lead',
            full_name: $('#lead_name').value.trim(),
            phone: fmtPhone($('#lead_phone').value),
            email: $('#lead_email').value.trim(),
            consent: $('#lead_ok').checked ? 'yes' : 'no',
            ...UTM,
            submitted_at: new Date().toISOString(),
            sim_group: (CONFIG.storage.SIM_GROUP_EMAILS || []).join(',')
        };

        status.textContent = 'שולח...';
        await sendEmailJS('LEAD', payload);
        await postJSON(CONFIG.storage.formspree.LEAD[CONFIG.MODE], payload);
        await postJSON(CONFIG.storage.sheetWebApp.LEAD[CONFIG.MODE], payload);

        status.textContent = 'קיבלנו! נוסיף אותך לרשימת המבצעים.';
        track.event('lead_submit', {});
        form.reset();
        setHiddenUTM(form);
    });
})();

// ---------- WhatsApp CTA (header) ----------
(function bindHeaderWA() {
    const a = $('#waCTA');
    if (!a || !CONFIG.WHATSAPP_PHONE_E164) return;
    const msg = `שלום, אשמח לפרטים על טיפולים ומבצעים.`;
    a.href = `https://wa.me/${CONFIG.WHATSAPP_PHONE_E164}?text=${encodeURIComponent(msg)}`;
})();
*/