const { query } = require('./db');

async function checkData() {
  try {
    const r = await query(`SELECT TOP 5 ID, Task, SchedTimeFrom, SchedTimeTo, SendTo FROM QuickCapture WHERE CompanyID = 4 ORDER BY ID DESC`);
    console.log('Recent tasks:');
    r.recordset.forEach(row => {
      console.log(`ID: ${row.ID} | Task: ${row.Task} | From: '${row.SchedTimeFrom || 'NULL'}' | To: '${row.SchedTimeTo || 'NULL'}' | SendTo: ${row.SendTo}`);
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkData();
