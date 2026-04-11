const { query } = require('./db');

async function fix() {
  try {
    // Fix TelegramSession - link phone 919761842167 to CompanyID 7 (correct WIZONE AI LABS)
    await query(`UPDATE TelegramSessions SET CompanyID = 7, CompanyName = 'WIZONE AI LABS PRIVATE LIMITED' WHERE PhoneNumber = '919761842167'`);
    
    // Move tasks from CompanyID 6 to 7
    await query(`UPDATE QuickCapture SET CompanyID = 7 WHERE CompanyID = 6`);
    
    // Verify
    const t = await query("SELECT * FROM TelegramSessions WHERE PhoneNumber = '919761842167'");
    console.log('Updated TelegramSession:');
    console.log(t.recordset[0]);
    
    const tasks = await query('SELECT TOP 5 ID, Task, CompanyID FROM QuickCapture ORDER BY ID DESC');
    console.log('\nRecent Tasks:');
    tasks.recordset.forEach(t => console.log('ID:', t.ID, '| Task:', t.Task, '| CompanyID:', t.CompanyID));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fix();
