"""从 Word 文档提取知识点，补全 knowledge.ts"""
import zipfile, xml.etree.ElementTree as ET, re

docx_path = r'C:\Users\cruise\Downloads\云计算逆战课堂_第01至06章_知识点与指令总集.docx'
kpath = r'E:\trae_project\运维学习网站\src\utils\knowledge.ts'

# 读取 docx 全文
text = ''
with zipfile.ZipFile(docx_path, 'r') as z:
    with z.open('word/document.xml') as f:
        tree = ET.parse(f)
        root = tree.getroot()
        ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        for paragraph in root.iter(f'{ns}p'):
            para_text = ''
            for run in paragraph.iter(f'{ns}t'):
                if run.text:
                    para_text += run.text
            text += para_text + '\n'

print(f'文档总字符: {len(text)}')

# 提取所有行（去除空行和长行）
lines = [l.strip() for l in text.split('\n') if l.strip()]
print(f'有效行数: {len(lines)}')

# 提取知识点：短行（<60字符）且包含技术内容
doc_terms = set()
skip_patterns = [
    r'^\d+\.', r'^第\d+', r'^[A-Z]\.', r'^\[root',
    r'^\d+$', r'^\d+G', r'^\d+寸', r'^\d+年',
    r'^QQ', r'^微信', r'^B站', r'^知乎',
    r'^http', r'^D:\\', r'^E:',
    r'^-bash', r'^drwx', r'^-rwx', r'^brw',
    r'^lrwx', r'^uid=', r'^\$', r'^#',
    r'^%CPU', r'^USER', r'^PID', r'^COMMAND',
    r'^TIME', r'^TTY', r'^START', r'^STAT',
    r'^%MEM', r'^VSZ', r'^RSS', r'^SHR',
    r'^画布', r'^子主题', r'首先', r'最后',
    r'结论是', r'前提', r'示例', r'例如',
    r'^恭喜', r'^掌握', r'^提供',
    r'^\./', r'^\.\./',
]

for l in lines:
    if len(l) > 80: continue
    if any(re.match(p, l) for p in skip_patterns): continue
    
    # 英文命令或中文技术词
    is_en_cmd = bool(re.match(r'^[a-zA-Z][a-zA-Z0-9_.\-]{1,30}$', l))
    is_cn_term = bool(re.match(r'^[\u4e00-\u9fff]{2,15}$', l))
    
    if is_en_cmd or is_cn_term:
        doc_terms.add(l)

# 过滤掉太普通的词
common_words = {
    '作业','简介','图片','图示','比如','区别','案例','失败','概念',
    '回车','语法','类型','演示','测试','前提','示例','操作','错误','问题',
    '提示','接口','总结','练习','注意','推荐','目的','方法','步骤',
    '写入','读取','执行','删除','创建','移动','复制','大小','定义','原理',
    '结构','功能','范围','状态','信息','选择','编辑',
    'the','and','for','are','but','not','you','all','any','can','had',
    'her','was','one','our','out','has','have','been','some','them',
    'then','this','that','with','from','they','will','would','could',
    'should','about','text','file','root','boot','home','help','show',
    'auto','next','type','size','part','form','hand',
}
doc_terms = doc_terms - common_words

print(f'\n文档知识点: {len(doc_terms)} 个')

# 读取 knowledge.ts 已有
with open(kpath, 'r', encoding='utf-8') as f:
    k_content = f.read()
existing_terms = set(re.findall(r"term:\s*['\"]([^'\"]+)['\"]", k_content))
print(f'knowledge.ts 已有: {len(existing_terms)} 个')

# 找出缺失
missing = doc_terms - existing_terms
print(f'还缺: {len(missing)} 个\n')

# 分类显示缺失
core = []
commands = []
concepts = []

for t in sorted(missing):
    if re.match(r'^[a-zA-Z][a-zA-Z0-9_-]+$', t):
        commands.append(t)
    elif re.match(r'^[\u4e00-\u9fff]', t):
        concepts.append(t)
    else:
        core.append(t)

print('=== 缺失的命令 ===')
for t in commands:
    print(f'  {t}')

print('\n=== 缺失的中文概念 ===')
for t in concepts:
    print(f'  {t}')

print('\n=== 其他 ===')
for t in core:
    print(f'  {t}')

# 保存供补全
print(f'\n总共缺 {len(missing)} 个')
print(f'命令: {len(commands)} 个')
print(f'概念: {len(concepts)} 个')
