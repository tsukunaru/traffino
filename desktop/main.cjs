const { app, BrowserWindow, Menu, net, protocol, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const origin = 'traffino://game/';
protocol.registerSchemesAsPrivileged([{ scheme: 'traffino', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('Traffino');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });
  app.whenReady().then(() => {
    const root = path.join(app.getAppPath(), 'dist');
    protocol.handle('traffino', async request => {
      if (!request.url.startsWith(origin)) return new Response(null, { status: 404 });
      const asset = new URL(request.url).pathname.slice(1) || 'index.html';
      if (!/^(index\.html|game\.(js|css)|icon\.svg|assets\/[a-zA-Z0-9.-]+)$/.test(asset))
        return new Response(null, { status: 404 });
      const response = await net.fetch(pathToFileURL(path.join(root, asset)).href);
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'");
      return new Response(response.body, { status: response.status, headers });
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, done) => done(false));
    Menu.setApplicationMenu(null);
    const win = new BrowserWindow({ width: 1366, height: 800, minWidth: 800, minHeight: 500,
      backgroundColor: '#f4e9d3', title: 'Traffino', webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', e => e.preventDefault());
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown' && input.key === 'F11' && !input.isAutoRepeat) {
        e.preventDefault();
        win.setFullScreen(!win.isFullScreen());
      }
    });
    win.loadURL(origin);
  });
  app.on('window-all-closed', () => app.quit());
}
