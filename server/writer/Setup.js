// הגדרה חד-פעמית של כל הערכים
function setMailjetSecrets() {
  const p = PropertiesService.getScriptProperties();
  p.setProperties({
    ENV: 'test', // 'prod' כשעוברים לייצור
    MJ_API_KEY:        'PASTE_PRIMARY_API_KEY',
    MJ_API_SECRET:     'PASTE_PRIMARY_API_SECRET',
    MJ_SENDER_EMAIL:   'ofernevo@gmail.com',
    MJ_SENDER_NAME:    'Cosmetic Studio',
    MJ_TEMPLATE_STAFF:  'PASTE_Staff_TemplateID',
    MJ_TEMPLATE_CLIENT: 'PASTE_Client_TemplateID',
    DEMO_RECIPIENTS:   'demo1@example.com,demo2@example.com',
    STAFF_RECIPIENTS:  'owner@clientdomain.com',
    SPREADSHEET_ID:    'PASTE_SPREADSHEET_ID' // אפשר להשאיר ריק ולהריץ createDemoSpreadsheet()
  }, true);
}

// עוזרי עדכון מהיר
function setProp(key, value){
  PropertiesService.getScriptProperties().setProperty(key, value);
}
function getProp(key){
  Logger.log(PropertiesService.getScriptProperties().getProperty(key));
}
function listProps(){
  Logger.log(PropertiesService.getScriptProperties().getProperties());
}
function delProp(key){
  PropertiesService.getScriptProperties().deleteProperty(key);
}

// דוגמאות שימוש:
function setEnvToProd(){ setProp('ENV','prod'); }
function setEnvToTest(){ setProp('ENV','test'); }
