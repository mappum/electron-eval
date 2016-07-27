var test = require('tap').test
var electronEval = require('.')

test('catch errors', (t) => {
  process.on('uncaughtException', (err) => {
    console.error(err)
    t.error(err, 'caught error')
  })
  t.end()
})

test('catch child process crashing', (t) => {
  var crashDaemon = electronEval({ electron: './crash.sh', timeout: 5000 })
  crashDaemon.on('error', (err) => {
    t.same(err.message, 'Child process exited with code 1.\nStderr:\nFlagrant error\n')
    t.end()
  })
})

var daemon
test('create daemon', (t) => {
  daemon = electronEval({ timeout: 5000 })
  daemon.on('ready', () => {
    t.pass('daemon is ready')
    t.end()
  })
})

test('simple eval', (t) => {
  daemon.eval('5 + 5', (err, res) => {
    t.pass('callback called')
    t.error(err, 'no error')
    t.equal(res, 10, 'correct response value')
    t.end()
  })
})

test('async communication (window.send)', (t) => {
  daemon.once('someEvent', (val) => {
    t.pass('local event emitted')
    t.equal(val, 'Hello, node!', 'correct message value')
    t.end()
  })
  daemon.eval('window.send("someEvent", "Hello, node!")')
})

test('erroring code', (t) => {
  daemon.eval('foo()', (err, res) => {
    t.pass('callback called')
    t.ok(err, 'error received')
    t.equal(res, undefined, 'no response value')
    t.end()
  })
})

test('erroring code with no callback', (t) => {
  daemon.once('error', (err) => {
    t.pass('error event emitted')
    t.ok(err, 'error received')
    t.end()
  })
  daemon.eval('foo()')
})

test('close daemon', (t) => {
  daemon.child.once('exit', () => {
    t.pass('daemon process exited')
    t.end()
  })
  daemon.close()
})

test('queueing code before daemon is ready', (t) => {
  t.plan(10)
  daemon = electronEval()
  t.pass('creating daemon')
  daemon.eval('!!window', (err, res) => {
    t.pass('callback called')
    t.error(err, 'no error')
    t.equal(res, true, 'correct response value')
  })
  daemon.eval('var res = { foo: "bar" }; res', (err, res) => {
    t.pass('callback called')
    t.error(err, 'no error')
    t.deepEqual(res, { foo: 'bar' }, 'correct response value')
  })
  daemon.eval('akfhjasldfjsl()', (err, res) => {
    t.pass('callback called')
    t.ok(err, 'error received')
    t.equal(res, undefined, 'no response value')
  })
})

test('close daemon', (t) => {
  daemon.child.once('exit', (code) => {
    t.same(code, 0, 'exit code is 0')
    t.end()
  })
  daemon.close()
})

if (process.env.HEADLESS) {
  test('xvfb has started and shutdown', (t) => {
    daemon = electronEval()
    daemon.on('ready', function () {
      t.pass('no errors were thrown when starting Xvfb')
      daemon.close()
      t.pass('no errors were thrown when ending Xvfb')
      t.end()
    })
  })
}
