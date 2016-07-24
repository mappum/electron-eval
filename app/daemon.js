var json = require('newline-json')
var app = require('electron').app
var BrowserWindow = require('electron').BrowserWindow
var path = require('path')
var ipc = require('electron').ipcMain

if (app.dock) app.dock.hide()

var stdout = json.Stringifier()
stdout.pipe(process.stdout)
var stdin = process.stdin.pipe(json.Parser())

var timeout
var options
var window

stdin.once('data', main)
stdout.write('starting')

function main (opts) {
  options = opts
  resetTimeout()

  stdin.on('data', function (message) {
    resetTimeout()
    if (typeof message !== 'object') return
    if (message.evalInRenderer) {
      delete message.evalInRenderer
      window.webContents.send('data', message)
    } else {
      var res
      var err
      try {
        res = eval(message.code)
      } catch(e) {
        err = e.message
      }
      stdout.write([ message.id, { res: res, err: err }])
    }
  })

  ipc.on('data', function (e, data) {
    stdout.write(data)
  })

  app.on('ready', function () {
    window = new BrowserWindow(opts.windowOpts)
    window.loadURL('file://' + path.join(__dirname, 'index.html'))
    window.webContents.on('did-finish-load', function () {
      stdout.write('ready')
    })
  })
}

function resetTimeout () {
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(function () { process.exit(0) }, options.timeout)
}
