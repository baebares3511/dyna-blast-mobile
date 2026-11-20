"""Builds GRAJ.html - a single self-contained file (all JS + CSS inlined) that
runs by simply double-clicking it, without any server (file://).

Usage:  py scripts/build-standalone.py      (run again after changing www/)
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WWW = os.path.join(ROOT, 'www')
JS = os.path.join(WWW, 'js')
OUT = os.path.join(ROOT, 'GRAJ.html')

IMPORT_RE = re.compile(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)';", re.S)
EXPORT_LIST_RE = re.compile(r"^export\s*\{([^}]*)\};?\s*$", re.M)
EXPORT_DECL_RE = re.compile(r"^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)", re.M)


def module_id(path):
    return os.path.relpath(path, JS).replace(os.sep, '/')


def convert(path):
    src = open(path, encoding='utf8').read()
    base = os.path.dirname(path)
    exports = []

    def repl_import(m):
        names = [n.strip() for n in m.group(1).split(',') if n.strip()]
        names = [n.replace(' as ', ': ') for n in names]
        target = module_id(os.path.normpath(os.path.join(base, m.group(2))))
        return "const { %s } = __req('%s');" % (', '.join(names), target)

    src = IMPORT_RE.sub(repl_import, src)

    def repl_list(m):
        exports.extend(n.strip() for n in m.group(1).split(',') if n.strip())
        return ''

    src = EXPORT_LIST_RE.sub(repl_list, src)

    def repl_decl(m):
        exports.append(m.group(2))
        return m.group(1) + ' ' + m.group(2)

    src = EXPORT_DECL_RE.sub(repl_decl, src)
    if re.search(r'^\s*(import|export)\b', src, re.M):
        raise SystemExit('Unsupported import/export form in ' + path)
    body = src + '\nreturn { %s };\n' % ', '.join(exports)
    return module_id(path), body


def main():
    modules = []
    for dirpath, _, files in os.walk(JS):
        for f in sorted(files):
            if f.endswith('.js'):
                modules.append(convert(os.path.join(dirpath, f)))
    loader = [
        '(function () {',
        'const __defs = {}, __cache = {};',
        'function __req(id) {',
        '  if (!(id in __cache)) { __cache[id] = null; __cache[id] = __defs[id](); }',
        '  return __cache[id];',
        '}',
    ]
    for mid, body in modules:
        loader.append("__defs['%s'] = function () {\n%s};" % (mid, body))
    loader.append("__req('main.js');")
    loader.append('})();')
    script = '\n'.join(loader).replace('</script', '<\\/script')

    html = open(os.path.join(WWW, 'index.html'), encoding='utf8').read()
    css = open(os.path.join(WWW, 'css', 'style.css'), encoding='utf8').read()
    html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)
    html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')
    html = html.replace('<script type="module" src="js/main.js"></script>', '<script>\n' + script + '\n</script>')
    with open(OUT, 'w', encoding='utf8') as f:
        f.write(html)
    print('OK ->', OUT, '(%d modules, %d KB)' % (len(modules), os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
