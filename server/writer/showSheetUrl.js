/*function showSheetUrl(){
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  Logger.log('https://docs.google.com/spreadsheets/d/' + id + '/edit');
}*/

/** מציג בלוג את הקישורים הישירים לגיליון ולכל לשונית */
function showSheetUrls(){
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) { Logger.log('SPREADSHEET_ID חסר'); return; }
  const ss = SpreadsheetApp.openById(id);
  const bookings = ss.getSheetByName('Bookings');
  const leads    = ss.getSheetByName('Leads');

  const base = 'https://docs.google.com/spreadsheets/d/' + id + '/edit#gid=';
  Logger.log('Spreadsheet (ראשי): https://docs.google.com/spreadsheets/d/' + id + '/edit');
  if (bookings) Logger.log('Bookings tab: ' + base + bookings.getSheetId());
  if (leads)    Logger.log('Leads tab:    ' + base + leads.getSheetId());
}
