'use strict'

var electron = require('electron-prebuilt')
var spawn = require('child_process').spawn
var json = require('newline-json')
var path = require('path')
var EventEmitter = require('events').EventEmitter
var toArray = require('stream-to-array')

var headless
try { headless = require('headless') } catch (err) {}

module.exports = function (opts) {
  return new Daemon(opts)
}

var daemonMain = path.join(__dirname, '..', 'app', 'daemon.js')
var i = 0

class Daemon extends EventEmitter {
  constructor (opts) {
    super()
    opts = opts || {}
    opts.timeout = typeof opts.timeout === 'number'
      ? opts.timeout : 10e3
    opts.windowOpts = opts.windowOpts || { show: false, skipTaskbar: true }
    opts.headless = opts.headless != null
      ? opts.headless : process.env.HEADLESS
    if (!opts.headless && process.platform === 'linux') {
      opts.headless = true
    }

    this.queue = []
    this.ready = false

    if (opts.headless) {
      this._startHeadless((err) => {
        if (err) return this.emit('error', err)
        this._startElectron(opts)
      })
    } else {
      this._startElectron(opts)
    }
  }

  eval (code, opts = {}, cb) {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    var id = (i++).toString(36)
    this.once(id, (res) => {
      if (res.err) {
        var target = opts.mainProcess ? 'main process' : 'window'
        var err = new Error(`Error evaluating "${code}" ` +
          `in "${target}": ${res.err}`)
        err.original = res.err
      }
      if (cb) {
        if (err) return cb(err)
        return cb(null, res.res)
      }
      if (err) this.emit('error', err)
    })
    if (!this.ready) return this.queue.push([ code, opts, cb ])
    this.stdin.write({ id, opts, code })
  }

  keepalive () {
    if (!this.stdin) return
    this.stdin.write(0)
  }

  close (signal) {
    if (this.xvfb) {
      this.xvfb.kill(signal)
    }
    this.child.kill(signal)
    this.stdout = this.stdin = null
    this.eval = (code, cb) => cb && cb(new Error('Daemon already closed'))
    clearInterval(this.keepaliveInterval)
  }

  _startHeadless (cb) {
    if (headless == null) {
      return cb(new Error('Could not load "headless" module'))
    }
    var opts = {args: ['+extension', 'RANDR']}
    headless(opts, (err, child, display) => {
      if (err) {
        var err2 = new Error(`Could not start Xvfb: "${err.message}". \n` +
        'The "xvfb" package is required to run "electron-eval" on Linux. ' +
        'Please install it first ("sudo apt-get install xvfb").')
        return cb(err2)
      }
      process.on('exit', () => child.kill())
      this.xvfb = child
      this.xDisplay = `:${display}`
      cb(null)
    })
  }

  _startElectron (opts, cb) {
    var env = {}
    var exitCode
    var exitStderr
    var childExit = () => {
      if (exitCode && typeof exitStderr !== 'undefined') {
        this.emit('error', new Error(`Child process exited with code ${exitCode}.\nStderr:\n${exitStderr}`))
      }
    }
    if (this.xDisplay) env.DISPLAY = this.xDisplay
    this.child = spawn(opts.electron || electron, [ daemonMain ], { env })
    this.child.on('close', (code) => {
      exitCode = code
      childExit()
    })
    this.child.on('error', (err) => this.emit('error', err))
    toArray(this.child.stderr, (err, stderr) => {
      if (err) return this.emit('error', err)
      exitStderr = stderr
      childExit()
    })
    this.stdout = this.child.stdout.pipe(json.Parser())
    this.stdout.on('error', (err) => this.emit('error', err))
    this.stdin = json.Stringifier()
    this.stdin.on('error', (err) => this.emit('error', err))
    this.stdin.pipe(this.child.stdin)
    process.on('exit', () => this.child.kill())

    this.stdout.once('data', () => {
      this.keepaliveInterval = setInterval(this.keepalive.bind(this), opts.timeout / 2)
      this.stdin.write(opts)
      this.stdout.once('data', () => {
        this.stdout.on('data', (message) => this.emit(message[0], message[1]))
        this.ready = true
        this.queue.forEach((item) => this.eval(...item))
        this.queue = null
        this.emit('ready')
        this.keepalive()
      })
    })
  }
}
