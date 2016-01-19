var test = require('tap').test
var electronEval = require('.')

test('catch errors', t => {
  process.on('uncaughtException', err => {
    console.error(err)
    t.error(err, 'caught error')
  })
  t.end()
})

var daemon
test('create daemon', t => {
  daemon = electronEval({ timeout: 5000 })
  daemon.on('ready', () => {
    t.pass('daemon is ready')
    t.end()
  })
})

test('simple eval', t => {
  daemon.eval('5 + 5', (err, res) => {
    t.pass('callback called')
    t.error(err, 'no error')
    t.equal(res, 10, 'correct response value')
    t.end()
  })
})

test('async communication (window.send)', t => {
  daemon.once('someEvent', val => {
    t.pass('local event emitted')
    t.equal(val, 'Hello, node!', 'correct message value')
    t.end()
  })
  daemon.eval('window.send("someEvent", "Hello, node!")')
})

test('erroring code', t => {
  daemon.eval('foo()', (err, res) => {
    t.pass('callback called')
    t.ok(err, 'error received')
    t.equal(res, undefined, 'no response value')
    t.end()
  })
})

test('erroring code with no callback', t => {
  daemon.once('error', (err) => {
    t.pass('error event emitted')
    t.ok(err, 'error received')
    t.end()
  })
  daemon.eval('foo()')
})

test('close daemon', t => {
  daemon.child.once('exit', () => {
    t.pass('daemon process exited')
    t.end()
  })
  daemon.close()
})

test('queueing code before daemon is ready', t => {
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

test('close daemon', t => {
  daemon.child.once('exit', () => {
    t.pass('daemon process exited')
    t.end()
  })
  daemon.close()
})
