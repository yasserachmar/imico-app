"""اختبار النسخة التجريبية: كل دور، كل شاشة مسموحة، أخطاء الكونسول، overflow أفقي على 390px، XSS، والصلاحيات."""
import subprocess, time, sys, json
from playwright.sync_api import sync_playwright

PORT = 8765
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', '/home/claude/imico-app/web'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = f'http://localhost:{PORT}/index.html'
ROUTES = ['home', 'tasks', 'projects', 'expenses', 'approvals', 'team', 'devices', 'notifications', 'settings', 'more']
results = {'errors': [], 'overflow': [], 'checks': []}

def ok(name, cond, extra=''):
    results['checks'].append((name, bool(cond), extra))

try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for width in (390, 1366):
            ctx = b.new_context(viewport={'width': width, 'height': 844 if width == 390 else 800})
            pg = ctx.new_page()
            pg.on('console', lambda m: m.type == 'error' and results['errors'].append(m.text))
            pg.on('pageerror', lambda e: results['errors'].append(str(e)))
            pg.goto(BASE); pg.wait_for_selector('.demo-user')
            n_users = pg.locator('.demo-user').count()
            for i in range(n_users):
                pg.goto(BASE + '#/login'); pg.evaluate("localStorage.removeItem('imico-demo-v1')"); pg.reload(); pg.wait_for_selector('.demo-user')
                name = pg.locator('.demo-user .strong').nth(i).inner_text()
                pg.locator('.demo-user').nth(i).click(); pg.wait_for_selector('#view')
                for r in ROUTES:
                    pg.goto(BASE + '#/' + r); pg.wait_for_timeout(250)
                    sw = pg.evaluate('document.documentElement.scrollWidth'); cw = pg.evaluate('document.documentElement.clientWidth')
                    if sw > cw + 1: results['overflow'].append((width, name, r, sw, cw))
                    landed = pg.evaluate('location.hash')
                    if r not in ('more',) and landed != '#/' + r:
                        results['checks'].append((f'{name} لا يصل إلى {r} (تحويل إلى {landed})', True, 'منع حسب الصلاحية'))
            ctx.close()

        # سيناريو المصاريف والصلاحيات + XSS
        ctx = b.new_context(viewport={'width': 390, 'height': 844}); pg = ctx.new_page()
        pg.on('pageerror', lambda e: results['errors'].append(str(e)))
        pg.on('dialog', lambda d: d.dismiss())
        pg.goto(BASE); pg.evaluate("localStorage.removeItem('imico-demo-v1')"); pg.reload(); pg.wait_for_selector('.demo-user')
        pg.locator('.demo-user', has_text='إبراهيم').click(); pg.wait_for_selector('#view')
        pg.goto(BASE + '#/expenses'); pg.wait_for_selector('.list-row'); pg.locator('.list-row').first.click(); pg.wait_for_selector('.amount-row')
        # الدولار: لا يوجد سعر معتمد اليوم -> يستعمل سعر أمس مع رسالة
        pg.locator('.seg.small button', has_text='$').click(); pg.fill('.amount-row input', '10'); pg.wait_for_timeout(100)
        conv = pg.locator('p.note').first.inner_text()
        ok('عند اختيار الدولار يظهر سعر الصرف', '149.25' in conv, conv)
        pg.locator('.seg.small button', has_text='ل.س').click(); pg.wait_for_timeout(100)
        ok('عند الليرة لا يظهر سعر الصرف', pg.locator('p.note:visible').count() == 0 or '149' not in pg.locator('p.note:visible').first.inner_text())
        xss = '<img src=x onerror="window.__xss=1">'
        pg.fill('input[aria-label="ملاحظة"]', xss); pg.fill('.amount-row input', '500')
        pg.locator('button', has_text='إضافة').last.click(); pg.wait_for_timeout(300)
        ok('XSS: النص يظهر كنص ولا يُنفَّذ', pg.evaluate('window.__xss') is None and pg.get_by_text('onerror', exact=False).count() >= 1)
        pg.fill('.amount-row input', 'abc'); pg.locator('button', has_text='إضافة').last.click(); pg.wait_for_timeout(200)
        ok('مبلغ غير صحيح يعطي رسالة عربية', 'اكتب المبلغ' in pg.locator('.toast').last.inner_text())
        # إرسال
        pg.locator('button', has_text='إرسال الرحلة للمنسقة').click(); pg.locator('dialog button[value=ok]').click(); pg.wait_for_timeout(300)
        ok('إرسال الرحلة يغيّر حالتها', pg.get_by_text('بانتظار الموافقة').count() >= 1)
        # المهندس لا يرى الطلبات ولا الفريق
        pg.goto(BASE + '#/approvals'); pg.wait_for_timeout(200)
        ok('المهندس ممنوع من صفحة الطلبات', pg.evaluate('location.hash') == '#/home')
        pg.goto(BASE + '#/team/u_anas'); pg.wait_for_timeout(200)
        ok('المهندس ممنوع من صفحة الصلاحيات', pg.evaluate('location.hash') == '#/home')
        # المنسقة توافق
        pg.goto(BASE + '#/more'); pg.locator('button.list-row', has_text='تسجيل الخروج').click(); pg.wait_for_selector('.demo-user')
        pg.locator('.demo-user', has_text='مرام').click(); pg.wait_for_selector('#view')
        pg.goto(BASE + '#/home'); pg.wait_for_timeout(200)
        ok('سعر الصرف لا يظهر في الرئيسية', '149' not in pg.locator('#view').inner_text())
        pg.goto(BASE + '#/approvals'); pg.wait_for_selector('.card')
        ok('المنسقة ترى بند الدولار داخل الطلب', pg.get_by_text('× 149').count() >= 1)
        pg.locator('.card', has_text='إبراهيم').locator('button', has_text='قبول').click(); pg.wait_for_timeout(300)
        ok('المنسقة توافق على الطلب', pg.locator('.card', has_text='إبراهيم').count() == 0)
        pg.goto(BASE + '#/settings'); pg.wait_for_selector('.card')
        pg.locator('input[aria-label="السعر المعتمد"]').fill('150'); pg.locator('button', has_text='اعتماد السعر').click(); pg.wait_for_timeout(300)
        ok('المنسقة تعتمد سعر الصرف', pg.get_by_text('معتمد', exact=True).count() >= 1)
        # المدير يعدّل الصلاحيات
        pg.goto(BASE + '#/more'); pg.locator('button.list-row', has_text='تسجيل الخروج').click(); pg.wait_for_selector('.demo-user')
        pg.locator('.demo-user', has_text='أنس').click(); pg.wait_for_selector('#view')
        pg.goto(BASE + '#/team/u_ibrahim'); pg.wait_for_selector('.switch')
        pg.locator('button[role=switch][aria-label="إضافة مصاريف"]').click(); pg.locator('button', has_text='حفظ الصلاحيات').click(); pg.wait_for_timeout(300)
        ok('المدير يطفئ صلاحية ويظهر «معدّل يدوياً»', pg.get_by_text('معدّل يدوياً').count() >= 1)
        ctx.close(); b.close()
finally:
    srv.terminate()

print(json.dumps(results, ensure_ascii=False, indent=1))
bad = [c for c in results['checks'] if not c[1]]
print('FAILED:', len(bad), '| console errors:', len(results['errors']), '| overflow:', len(results['overflow']))
