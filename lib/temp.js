var sys  = require('sys'),
    fs   = require('fs'),
    path = require('path');

/* HELPERS */

var defaultDirectory = '/tmp';
var environmentVariables = ['TMPDIR', 'TMP', 'TEMP'];

var findDirectory = function() {
  for(var i = 0; i < environmentVariables.length; i++) {
    var value = process.env[environmentVariables[i]];
    if(value)
      return fs.realpathSync(value);
  }
  return fs.realpathSync(defaultDirectory);
}

var generateName = function(rawAffixes, defaultPrefix) {
  var affixes = parseAffixes(rawAffixes, defaultPrefix);
  var now = new Date();
  var name = [affixes.prefix,
              now.getYear(), now.getMonth(), now.getDay(),
              '-',
              process.pid,
              '-',
              (Math.random() * 0x100000000 + 1).toString(36),
              affixes.suffix].join('');
  return path.join(exports.dir, name);
}

var parseAffixes = function(rawAffixes, defaultPrefix) {
  var affixes = {prefix: null, suffix: null};
  if(rawAffixes) {
    switch (typeof(rawAffixes)) {
    case 'string':
      affixes.prefix = rawAffixes;
      break;
    case 'object':
      affixes = rawAffixes;
      break
    default:
      throw("Unknown affix declaration: " + affixes);
    }
  } else {
    affixes.prefix = defaultPrefix;
  }
  return affixes;
}

/* DIRECTORIES */

var mkdir = function(affixes, callback) {
  var dirPath = generateName(affixes, 'd-');
  fs.mkdir(dirPath, 0700, function(err) { 
    if (!err) {
      process.addListener('exit', function() {
        try { fs.rmdirSync(dirPath); }
        catch (rmErr) { /* removed normally */ }
      } );
    }
    if (callback)
      callback(err, dirPath);
  });
}
var mkdirSync = function(affixes) {
  var dirPath = generateName(affixes, 'd-');
  fs.mkdirSync(dirPath, 0700);
  process.addListener('exit', function() {
    try { fs.rmdirSync(dirPath) }
    catch (rmErr) { /* removed manually */ }
  } );
  return dirPath;
}

/* FILES */

var open = function(affixes, callback) {
  var filePath = generateName(affixes, 'f-')
  fs.open(filePath, 'w+', 0600, function(err, fd) {
    if (!err)
      process.addListener('exit', function() {
        try { fs.unlinkSync(filePath); }
        catch (rmErr) { /* removed normally */ } 
      });
    if (callback)
      callback(err, {path: filePath, fd: fd});
  });
}
                    
var openSync = function(affixes) {
  var filePath = generateName(affixes, 'f-')
  var fd = fs.openSync(filePath, "w+", 0600);
  process.addListener('exit', function() {
    try { fs.unlinkSync(filePath); }
    catch (rmErr) { /* removed manually */ }
  });
  return {path: filePath, fd: fd};
}
  

/* EXPORTS */

exports.dir = findDirectory();
exports.mkdir = mkdir;
exports.mkdirSync = mkdirSync;
exports.open = open;
exports.openSync = openSync;
exports.path = generateName;
