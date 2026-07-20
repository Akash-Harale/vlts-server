const fs = require('fs');
try {
  const content = fs.readFileSync('test_run.log', 'utf16le');
  fs.writeFileSync('test_run_utf8.txt', content, 'utf8');
  console.log('Conversion successful!');
} catch (e) {
  console.error(e);
}
