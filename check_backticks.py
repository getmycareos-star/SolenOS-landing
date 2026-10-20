import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/pages/LongitudinalEvidence.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
for i, line in enumerate(lines):
    if '`' in line:
        backticks = line.count('`')
        print(f'Line {i+1}: {backticks} backticks: {line.strip()[:120]}')
