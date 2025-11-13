
/* ==========================================================
   [UPGRADE v2.2] Central configuration for the landing page
   NOTE: Mailjet keys NEVER go here (server only in Apps Script)
   ========================================================== */

const CONFIG = {
    APP_VERSION: "2.2",

    // Business / site
    BUSINESS_NAME: "Cosmetic Studio",
    WHATSAPP_PHONE_E164: "972542248456", // ספרות בלבד, בלי '+'
    SITE_BASE: "/cosmetic-landing-page-v1/", // ל-GitHub Pages; בדומיין שורש שים "".

    // Frontend mode selector (רק לבחירת endpoint; השרת מחליט TEST/PROD בעצמו)
    MODE: "test", // 'test' | 'prod'

    // EmailJS (אופציונלי). אם לא משתמשים — השאר ENABLE_EMAILJS=false והערכים ריקים
    ENABLE_EMAILJS: false,
    emailjs: {
        PUBLIC_KEY: "",
        SERVICE_ID: { test: "", prod: "" },
        TEMPLATE: {
            LEAD: { test: "", prod: "" },
            BOOKING: { test: "", prod: "" }
        }
    },

    // Endpoints לשמירה/שליחה — Apps Script Web App (אותו URL ל-test/prod זה בסדר)
    storage: {
        sheetWebApp: {
            LEAD: { test: "", prod: "" },
            BOOKING: { test: "", prod: "" }
        },

        // Formspree (גיבוי/לוג — לא חובה)
        formspree: {
            LEAD: { test: "", prod: "" },
            BOOKING: { test: "", prod: "" }
        },

        // כתובות הדמיה — יישלחו כחלק מה-payload לשרת (לוג/בקרה)
        SIM_GROUP_EMAILS: ["demo1@example.com", "demo2@example.com"]
    },

    // Analytics (אופציונלי)
    analytics: { gtagId: "", fbPixelId: "" }
};

/*
// נוחות: בחירת endpoint לפי מצב הפרונט
CONFIG.endpoints = {
    BOOKING: CONFIG.storage.sheetWebApp.BOOKING[CONFIG.MODE],
    LEAD: CONFIG.storage.sheetWebApp.LEAD[CONFIG.MODE]
};
*/

(function applyUnifiedEndpoint() {
    const unified = (typeof window !== 'undefined' && window.EXEC_URL) ? window.EXEC_URL : null;

    // אם exec-url.js נטען — נשתמש בו לשני המסלולים.
    // אחרת ניפול חזרה לכתובות המוגדרות אצלך ב-storage (גיבוי).
    CONFIG.endpoints = {
        BOOKING: unified || CONFIG.storage.sheetWebApp.BOOKING[CONFIG.MODE],
        LEAD: unified || CONFIG.storage.sheetWebApp.LEAD[CONFIG.MODE]
    };
})();

