var app = require('electron').app
var BrowserWindow = require('electron').BrowserWindow
var path = require('path')
var ipc = require('electron').ipcMain

if (app.dock) app.dock.hide()

var timeout
var options
var window

process.once('message', main)
process.send('starting')

function main (opts) {
  options = opts
  resetTimeout()

  ipc.on('data', function (e, data) {
    process.send(data)
  })

  if (app.isReady()) createWindow()
  else app.once('ready', createWindow)
}

function createWindow () {
  window = new BrowserWindow(options.windowOpts)
  window.loadURL('file://' + path.join(__dirname, 'index.html'))
  window.webContents.on('did-finish-load', function () {
    process.on('message', onMessage)
    process.send('ready')
  })
}

function onMessage (message) {
  resetTimeout()
  if (typeof message !== 'object') return
  if (message.opts.mainProcess) {
    var res
    var err
    try {
      res = eval(message.code)
    } catch (e) {
      err = e.stack
    }
    process.send([ message.id, { res: res, err: err } ])
  } else {
    window.webContents.send('data', message)
  }
}

function resetTimeout () {
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(function () { process.exit(0) }, options.timeout)
}
