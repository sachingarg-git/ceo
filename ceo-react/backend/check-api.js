const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5210,
  path: '/api/quick-capture',
  headers: { 'x-company-id': '4' }
};

http.get(options, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    console.log('Last 3 tasks from API:');
    d.rows.slice(-3).forEach(r => {
      console.log(`ID: ${r.id} | From: '${r.schedTimeFrom}' | To: '${r.schedTimeTo}'`);
    });
    process.exit(0);
  });
}).on('error', err => {
  console.error('Error:', err.message);
  process.exit(1);
});
