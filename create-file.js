const fs = require('fs');
fs.writeFileSync('test5.js', "console.log('test from node');");
console.log('File written');