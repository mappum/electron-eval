# electron-eval

[![npm version](https://img.shields.io/npm/v/electron-eval.svg)](https://www.npmjs.com/package/electron-eval)
[![Build Status](https://travis-ci.org/mappum/electron-eval.svg?branch=master)](https://travis-ci.org/mappum/electron-eval)
[![Dependency Status](https://david-dm.org/mappum/electron-eval.svg)](https://david-dm.org/mappum/electron-eval)

Run code inside a hidden Electron window

`electron-eval` gives you a way to access a headless browser (Chromium) from Node.js. This can be useful for testing browser-specific code, or using web APIs that are in browsers but not yet in Node (such as [WebRTC](https://github.com/mappum/electron-webrtc)).

## Running on Headless Machines

This module runs without any prior setup on non-headless machines.

To run on a headless Linux server, you'll need the `xvfb` package:

	$ sudo apt-get install xvfb

To run in Travis CI, see the [.travis.yml](https://github.com/mappum/electron-eval/blob/master/.travis.yml) file for this repo as an example of how to install the necessary packages.

## Usage

`npm install electron-eval`

```js
var electronEval = require('electron-eval')

// create new electron instance
var daemon = electronEval()

daemon.eval('JSON.stringify(window.location.href)', function (err, res) {
  console.log(err, res)
  // prints 'null file:///Users/mappum/Projects/electron-eval/index.html'
})

// use es6 multiline strings for longer pieces of code
daemon.eval(`
  var i = 0
  i += 10
  i -= 2
  i
`, (err, res) => console.log(err, res))
// prints 'null 8'

// close the window when you are done with it
// note that this happens automatically after the node process ends
daemon.close()
```

### Methods

#### `var daemon = electronEval([opts])`

Creates a new hidden Electron instance. This may be called many times to create many windows, but beware that Electron uses a lot of resources.

`opts` may be an object containing the following keys:
```js
{
  headless: Boolean // default: false
  // whether or not we should run in headless mode (using Xvfb)
  xvfb: Object // default: {}
  // configures specific xvfb options (see: https://github.com/Rob--W/node-xvfb#usage)
  timeout: Number // default: 10000
  // how often to check if the parent node process is still
  // alive (in milliseconds). If the node process is killed,
  // Electron will close
}
```

#### `daemon.eval(code, [opts], [callback])`

Evaluates the `code` string in the Electron window, and calls   `callback(error, result)`. If `callback` is not provided and the eval causes an error, the daemon will emit an `error` event.

The `opts` object may contain:
```js
{
  mainProcess: Boolean // default: false
  // if true, the code will be evaluated in the Electron main process, rather than the Electron window
}
```

Note that you may need to stringify the result value with `JSON.stringify()` so it will be sent properly across processes.

If `daemon.eval()` is called before the daemon has emitted its `ready` event, the code will be put in a queue and evaluated once the daemon is ready.

#### `daemon.close()`

Closes the Electron process and releases its resources.

Note that the Electron process will automatically terminate when the node process exits, so this may not be necessary.

#### `window.send(event, message)`

This method is implemented inside the Electron window, so it may be called from code evaluated by the daemon. It sends a message to the node process, which causes an event named `event` to be emitted on the `daemon` object.

This is useful when you need the browser window to send async messages to the node process.

**Example:**
```js
daemon.on('test', function (arg) {
  console.log('got message: ' + arg)
})
daemon.eval('window.send("test", 123)')

// the node process will print "got message: 123"
```
### Properties

#### `daemon.child`

A handle to the Electron daemon's process (of type [child_process.ChildProcess](https://nodejs.org/api/child_process.html#child_process_class_childprocess)).

### Events

#### - `ready`
Emitted by `daemon` when the Electron window has been set up and is ready to eval code.
#### - `error`
Emitted by `daemon` when `daemon.eval()` evaluates code that throws an error, but no callback is provided.

### Environment Variables

#### `HEADLESS`
Setting this variable to true also allows the module to go into headless mode.

## Related

[electron-spawn](https://github.com/maxogden/electron-spawn)
