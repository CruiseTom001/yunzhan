"""修复 all issues in knowledge.ts"""
path = r'E:\trae_project\运维学习网站\src\utils\knowledge.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix the interface - add missing ]
content = content.replace('  keywords: string[', '  keywords: string[]')

# 2. Fix the indentation of the first section
content = content.replace(
    'keywords: string[]\n// ======================== Linux 系统基础',
    'keywords: string[]\n  // ======================== Linux 系统基础'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

import re
terms = re.findall(r"term:\s*['\"]([^'\"]+)['\"]", content)
print(f'修复完成，{len(terms)} 个知识点')
