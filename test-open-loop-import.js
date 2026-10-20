// Simple test to see if we can import trackOpenLoop using __dirname
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { trackOpenLoop } = await import(join(__dirname, '../open-loop-manager/index'));

console.log('✓ Successfully imported trackOpenLoop');