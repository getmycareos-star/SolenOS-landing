import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/pages/LongitudinalEvidence.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

in_string = False
string_char = None
in_line_comment = False
in_block_comment = False
prev_char = ''
escaped = False

balance = 0
last_open_line = 0
last_open_col = 0

for i, char in enumerate(content):
    if in_line_comment:
        if char == '\n':
            in_line_comment = False
        prev_char = char
        continue
    if in_block_comment:
        if prev_char == '*' and char == '/':
            in_block_comment = False
        prev_char = char
        continue
    if in_string:
        if escaped:
            escaped = False
        elif char == '\\':
            escaped = True
        elif char == string_char:
            in_string = False
        prev_char = char
        continue
    if char in "'\"`":
        in_string = True
        string_char = char
        prev_char = char
        continue
    if char == '/' and prev_char == '/':
        in_line_comment = True
        prev_char = char
        continue
    if char == '*' and prev_char == '/':
        in_block_comment = True
        prev_char = char
        continue
    if char == '{':
        balance += 1
        last_open_line = content[:i].count('\n') + 1
        last_open_col = i - content[:i].rfind('\n')
    elif char == '}':
        balance -= 1
    prev_char = char

print(f'Final balance: {balance}')
print(f'Last unclosed brace at line {last_open_line}, col {last_open_col}')
if last_open_line > 0:
    lines = content.split('\n')
    start = max(0, last_open_line - 3)
    end = min(len(lines), last_open_line + 2)
    for j in range(start, end):
        marker = '>>> ' if j == last_open_line - 1 else '    '
        print(f'{marker}{j+1}: {lines[j][:120]}')
