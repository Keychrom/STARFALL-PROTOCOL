'use strict';

const { app, BrowserWindow, Menu, screen, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const isSmokeTest = process.argv.includes('--smoke-test');
let mainWindow = null;

app.setAppUserModelId('com.starfallprotocol.app');
nativeTheme.themeSource = 'dark';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1280, Math.max(960, screenW - 120));
  const height = Math.min(960, Math.max(760, screenH - 120));

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 960,
    minHeight: 720,
    backgroundColor: '#04070f',
    title: 'STARFALL PROTOCOL',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!isSmokeTest) mainWindow.focus();
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('console-message', (...args) => {
    const details = args.length > 1 && args[1] && typeof args[1] === 'object' ? args[1] : null;
    if (details) {
      if (details.level === 'error' || details.level === 'warning') {
        console.log('[renderer]', details.level, details.message);
      }
    } else if (args[1] >= 2) {
      console.log('[renderer]', args[2]);
    }
  });

  if (isSmokeTest) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await mainWindow.webContents.capturePage();
          const outPath = app.isPackaged
            ? path.join(app.getPath('temp'), 'starfall-smoke.png')
            : path.join(__dirname, '..', 'electron-smoke.png');
          fs.writeFileSync(outPath, image.toPNG());
          console.log('SMOKE_OK ' + outPath);
        } catch (err) {
          console.error('SMOKE_FAIL', err);
        } finally {
          app.exit(0);
        }
      }, 1800);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
