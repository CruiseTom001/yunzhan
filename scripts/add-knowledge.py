"""安全添加知识点（手工生成 JS 字面量）"""
import zipfile, xml.etree.ElementTree as ET, os, re

kpath = r'E:\trae_project\运维学习网站\src\utils\knowledge.ts'
base = r'D:\BaiduNetdiskDownload\云计算'

with open(kpath, 'r', encoding='utf-8') as f:
    existing = f.read()

existing_terms = set(re.findall(r"term:\s*['\"]([^'\"]+)['\"]", existing))

xmind_terms = set()
for root, dirs, fnames in os.walk(base):
    for f in fnames:
        if not f.endswith('.xmind'): continue
        try:
            with zipfile.ZipFile(os.path.join(root, f), 'r') as z:
                if 'content.xml' not in z.namelist(): continue
                tree = ET.parse(z.open('content.xml'))
                ns = '{urn:xmind:xmap:xmlns:content:2.0}'
                for title in tree.getroot().iter(f'{ns}title'):
                    if title.text and title.text.strip():
                        t = title.text.strip()
                        if 2 < len(t) < 60:
                            xmind_terms.add(t)
        except:
            pass

missing = xmind_terms - existing_terms

# 严格白名单
skip_cn = {
    '作业','简介','图片','图示','比如','区别','案例','失败','概念',
    '回车','语法','类型','演示','测试','前提','示例','操作','错误','问题',
    '提示','接口','总结','练习','注意','推荐','开头','日常','用途','用法',
    '目标','选项','设置','说明','结论','覆盖','追加','容量','尺寸','型号',
    '配置','写入','读取','执行','删除','创建','移动','复制','大小','转速',
    '界面','样式','背景','颜色','内容','修改','保存','打开','关闭','描述',
    '目的','方法','步骤','定义','原理','结构','功能','范围','状态','信息',
    '选择','编辑','输入','输出','目录','作用','组织','完整','位置','方式',
    '划分','顺序','取消','硬件','连接','显示','监控','日志','需要','学习',
    '掌握','理解','知道','常用','频率','特征','对比','场景','计算','灵魂',
    '玩具','留下','概念','格式','前提','在线','画布','手稿','毛坯房',
    '隔间','口诀','查看','形式','风格','不同','简单','复杂','一样','完成',
    '响应','传输','检查','单个','多个','完整','部分','所有','任何',
    '从工作原理区分','使用数字','使用符号','写满','进入会话模式'}

entries = []
for t in sorted(missing):
    cl = t.strip()
    if '\n' in cl: continue
    if any(c in cl for c in ['"',"'",'`','\\','/','(',')','{','}','[',']',
                              '&','|','$','%','#','@','!','~','^','*','+',
                              '=',':',';',',','<','>','?']): continue
    if re.match(r'^\d', cl): continue
    if cl in skip_cn: continue
    if len(cl) < 2: continue
    
    is_en = bool(re.match(r'^[a-zA-Z][a-zA-Z0-9_.-]+$', cl)) and len(cl) >= 2
    is_cn = bool(re.match(r'^[\u4e00-\u9fff]{2,12}$', cl))
    if not (is_en or is_cn): continue
    
    if is_en and cl.lower() in {'the','and','for','are','but','not','you',
        'all','any','can','had','her','was','one','our','out','has','have',
        'been','some','them','then','this','that','with','from','they','will',
        'would','could','should','their','about','which','where','there',
        'after','other','also','more','than','very','just','over','such',
        'each','only','own','same','into','text','file','root','boot',
        'home','size','user','link','show','help','list','stop','test',
        'find','call','last','open','step','part','case','line','read',
        'sort','pass','edit','code','mode','view'}: continue
    
    kw = cl.lower() if is_en else cl
    
    entries.append(f'''  {{
    term: '{cl}',
    keywords: ['{kw}'],
    category: 'Linux',
    level: 'beginner',
    summary: '{cl} — Linux 运维核心概念',
    description: `{cl} 是 Linux 运维中的重要概念，详情请参考课程章节内容。`
  }}''')

print(f'将添加 {len(entries)} 个知识点')

if entries:
    joined = ',\n'.join(entries)
    insert_pos = existing.find('\n  // ======================== Linux 系统基础')
    if insert_pos > 0:
        new_text = existing[:insert_pos] + ',\n' + joined + '\n' + existing[insert_pos:]
        with open(kpath, 'w', encoding='utf-8') as f:
            f.write(new_text)
        
        with open(kpath, 'r', encoding='utf-8') as f:
            verify = f.read()
        final_count = len(re.findall(r"term:\s*['\"]([^'\"]+)['\"]", verify))
        print(f'✅ 完成，共 {final_count} 个知识点')
    else:
        print('❌ 找不到插入位置')
