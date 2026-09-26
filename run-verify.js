const { execSync } = require('child_process');

// Run the tsx command
const result = execSync('npx tsx scripts/verify-event-identity.mts', {
  cwd: 'C:\\Users\\me\\solenos',
  timeout: 30000,
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe']
});

console.log(result);
process.exit(0);
