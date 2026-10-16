"""Optional browser regressions: python test/browser.py (requires Playwright browsers)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import tempfile
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.path = self.path.removeprefix('/Drag-Racer-v4') or '/'
        super().do_GET()

    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(root)))
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/Drag-Racer-v4/'
# Expose simulation stepping only in the test response. Production files stay untouched.
source = (root / 'src/main.js').read_text(encoding='utf-8') + '''
window.__test = {
  get race(){return race}, get state(){return state}, get config(){return config},
  get career(){return career}, get prefs(){return prefs}, get paused(){return paused},
  get age(){return stateT},
  step(n=1){for(let i=0;i<n;i++)update(1/120);draw(performance.now()/1000)},
  drive(){let lightAt=null,guard=0;while(state==='race'&&guard++<7000){
    const s=race.p.s;input.held.gas=true;input.held.nitro=s.gear>=2;
    if(s.gear===0&&race.t>=race.greenAt+.17)input.edges.up=true;
    if(shiftLight(s,race.p.car))lightAt??=race.t;else if(s.shiftT===0)lightAt=null;
    if(lightAt!==null&&race.t-lightAt>=.12){input.edges.up=true;lightAt=null}
    update(1/120);
  }draw(performance.now()/1000)}
};
'''

try:
    with sync_playwright() as p:
        for engine in ['chrome', 'msedge', 'webkit']:
            browser = p.webkit.launch() if engine == 'webkit' else p.chromium.launch(channel=engine)
            page = browser.new_page(viewport={'width': 1100, 'height': 850})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.add_init_script('window.requestAnimationFrame=()=>0;')
            page.route('**/src/main.js', lambda route: route.fulfill(body=source, content_type='text/javascript'))
            page.goto(url)
            page.wait_for_function('window.__test')
            page.locator('[data-action="tab:upgrades"]').click()
            page.locator('[data-action="part:engine"]').click()
            page.locator('[data-action="tab:tune"]').click()
            page.locator('#gearing').select_option('1.1')
            page.locator('#launch').fill('4500')
            page.locator('#launch').dispatch_event('change')
            snapshot = page.evaluate('JSON.stringify([__test.career.cash,__test.career.races,__test.career.wins,__test.career.unlocked,__test.career.cleared,__test.career.best,__test.prefs.record])')
            page.get_by_role('button', name='Solo test pass').click()
            assert page.evaluate('__test.race.solo')
            assert page.evaluate('__test.race.p.car.launchRpm') == 4500
            assert page.evaluate('__test.race.p.car.final === __test.config.car.final')
            page.evaluate('__test.drive()')
            assert page.evaluate('__test.state') == 'results'
            assert page.evaluate('__test.race.result') == 'test'
            assert page.locator('#next-rival').is_hidden()
            assert page.locator('#rematch').is_disabled()
            assert page.evaluate('JSON.stringify([__test.career.cash,__test.career.races,__test.career.wins,__test.career.unlocked,__test.career.cleared,__test.career.best,__test.prefs.record])') == snapshot
            assert 'Test pass:' in page.locator('#run-feedback').inner_text()
            for key in ['Space', 'Enter', 'r']:
                page.keyboard.press(key)
                page.evaluate('__test.step(20)')
                assert page.evaluate('__test.state') == 'results', 'Finish-line mashing skipped the slip'
            page.evaluate('__test.step(40)')
            assert page.evaluate('__test.state') == 'results', 'Ignored input must not be queued'
            assert page.locator('#rematch').is_enabled()
            page.keyboard.press('Space')
            page.evaluate('__test.step()')
            assert page.evaluate('__test.state') == 'race'
            page.evaluate('__test.drive();__test.step(100)')
            assert 'previous clean run' in page.locator('#run-comparison').inner_text()
            page.locator('#result-garage').click()
            assert page.locator('#launch').is_visible(), 'Return to Tune'
            assert page.locator('#launch').input_value() == '4500'
            page.locator('[data-action="tab:race"]').click()
            assert 'Your car’s best:' in page.locator('.rival-pace').inner_text()
            assert 'no time yet' not in page.locator('.rival-pace').inner_text()
            page.locator('[data-action="race"]').click()
            page.evaluate('__test.drive();__test.step(100)')
            assert page.evaluate('__test.career.races') == 1
            if page.evaluate('__test.race.result') == 'win':
                page.locator('#next-rival').click()
                assert page.evaluate('__test.config.event') == 1
            page.locator('#leave').click()
            page.locator('[data-action="mode:quick"]').click()
            assert page.locator('#difficulty option').count() == 5
            page.locator('#difficulty').select_option('sport')
            page.reload()
            page.wait_for_function('window.__test')
            assert page.evaluate('__test.prefs.difficulty') == 'sport'
            assert page.evaluate('__test.prefs.testBest.sprint > 0')
            page.locator('[data-action="tab:tune"]').click()
            page.set_viewport_size({'width': 390, 'height': 844})
            page.evaluate('__test.step()')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.get_by_role('button', name='Solo test pass').click()
            page.evaluate('__test.step(500)')
            if engine == 'chrome':
                page.screenshot(path=str(Path(tempfile.gettempdir()) / 'drag-solo-mobile.png'))
            page.evaluate('__test.drive();__test.step(100)')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            if engine == 'chrome':
                page.screenshot(path=str(Path(tempfile.gettempdir()) / 'drag-solo-results.png'))
            page.set_viewport_size({'width': 844, 'height': 390})
            page.evaluate('__test.step()')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert not errors, errors
            browser.close()
            print(f'{engine}: solo, saved tune, results guard, career isolation, rival flow, mobile, subpath PASS', flush=True)
finally:
    server.shutdown()
