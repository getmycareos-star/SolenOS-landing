import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/pages/LongitudinalEvidence.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Find all JSX tags (opening and closing)
# This is a simple check - not perfect but good enough
tags = re.findall(r'</?([A-Z][a-zA-Z0-9]*)', content)
from collections import Counter
c = Counter(tags)
print('Tag counts:')
for tag, count in sorted(c.items()):
    print(f'  {tag}: {count}')

# Check for self-closing tags
self_closing = re.findall(r'<([A-Z][a-zA-Z0-9]*)[^>]*/>', content)
print(f'Self-closing tags: {self_closing}')
