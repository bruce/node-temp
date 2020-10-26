var fs = require('fs');
var path = require('path');
var util = require('util');
var assert = require('assert');

var existsSync = function(path, mode){
  try {
    var stats = fs.statSync(path);
    if (mode == null) {
      return true;
    }
    if (mode !== (stats.mode & 0777)) {
      console.log('Expected', mode.toString(8), 'got', stats.mode.toString(8))
      return false
    }
    return true
  } catch (e){
    return false;
  }
};

// Use path.exists for 0.6 if necessary
var safeExists = fs.exists || path.exists;

var temp = require('../lib/temp');
temp.track();
describe("temp", function() {
  it("mkdir", function(done) {
    var mkdirPath = null;
    temp.mkdir('foo', function(err, tpath) {
      assert.ok(!err, "temp.mkdir did not execute without errors");
      assert.ok(path.basename(tpath).slice(0, 3) == 'foo', 'temp.mkdir did not use the prefix');
        assert.ok(existsSync(tpath, 0700), 'temp.mkdir did not create the directory');

      fs.writeFileSync(path.join(tpath, 'a file'), 'a content');
      temp.cleanupSync();
      assert.ok(!existsSync(tpath), 'temp.cleanupSync did not remove the directory');

      mkdirPath = tpath;
      done();
    });

    var mkdirModeFired = false;
    temp.mkdir({ mode: 0755 }, function(err, tpath) {
      mkdirModeFired = true;
      assert.ok(existsSync(tpath, 0755), 'tmp.mkdir uses the mode that was given')
    })
  });

  it("open", function(done) {
    var openPath = null;
    temp.open('bar', function(err, info) {
      assert.equal('object', typeof(info), "temp.open did not invoke the callback with the err and info object");
      assert.equal('number', typeof(info.fd), 'temp.open did not invoke the callback with an fd');
      fs.writeSync(info.fd, 'foo');
      fs.closeSync(info.fd);
      assert.equal('string', typeof(info.path), 'temp.open did not invoke the callback with a path');
      assert.ok(existsSync(info.path), 'temp.open did not create a file');

      temp.cleanupSync();
      assert.ok(!existsSync(info.path), 'temp.cleanupSync did not remove the file');

      openPath = info.path;
      done();
    });
  });

  it("stream", function(done) {
    var stream = temp.createWriteStream('baz');
    assert.ok(stream instanceof fs.WriteStream, 'temp.createWriteStream did not invoke the callback with the err and stream object');
    stream.write('foo');
    stream.end("More text here\nand more...", function() {
      assert.ok(existsSync(stream.path), 'temp.createWriteStream did not create a file');

      var tempDir = temp.mkdirSync("foobar");
      assert.ok(existsSync(tempDir), 'temp.mkdirTemp did not create a directory');
      tempDir = temp.mkdirSync({mode: '0711'})
assert.ok(existsSync(tempDir, 0711), 'temp.mkdirTemp did not create a directory');
tempDir = temp.mkdirSync({mode: 'zzz'})
assert.ok(existsSync(tempDir, 0700), 'temp.mkdirTemp did not create a directory');

      // cleanupSync()
      temp.cleanupSync();
      assert.ok(!existsSync(stream.path), 'temp.cleanupSync did not remove the createWriteStream file');
      assert.ok(!existsSync(tempDir), 'temp.cleanupSync did not remove the mkdirSync directory');
      done();
    });
  });

  it("cleanup", function(done) {
    // Make a temp file just to cleanup
    var tempFile = temp.openSync();
    fs.writeSync(tempFile.fd, 'foo');
    fs.closeSync(tempFile.fd);
    assert.ok(existsSync(tempFile.path), 'temp.openSync did not create a file for cleanup');

    // run cleanup()
    temp.cleanup(function(err, counts) {
      assert.ok(!err, 'temp.cleanup did not run without encountering an error');
      assert.ok(!existsSync(tempFile.path), 'temp.cleanup did not remove the openSync file for cleanup');
      assert.equal(1, counts.files, 'temp.cleanup did not report the correct removal statistics');
      done();
    });
  });

  it("path", function() {
    var tempPath = temp.path();
    assert.ok(path.dirname(tempPath) === temp.dir, "temp.path does not work in default os temporary directory");

    tempPath = temp.path({dir: process.cwd()});
    assert.ok(path.dirname(tempPath) === process.cwd(), "temp.path does not work in user-provided temporary directory");
  });

  it("singleton", function() {
    for (var i=0; i <= 10; i++) {
      temp.openSync();
    }
    assert.equal(process.listeners('exit').length, 1, 'temp created more than one listener for exit');
  });
});
