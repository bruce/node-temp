var fs   = require('fs'),
    os   = require('os'),
    path = require('path'),
    cnst = require('constants');

/* HELPERS */

var RDWR_EXCL = cnst.O_CREAT | cnst.O_TRUNC | cnst.O_RDWR | cnst.O_EXCL;

var generateName = function(rawAffixes, defaultPrefix) {
  var affixes = parseAffixes(rawAffixes, defaultPrefix);
  var now = new Date();
  var name = [affixes.prefix,
              now.getYear(), now.getMonth(), now.getDate(),
              '-',
              process.pid,
              '-',
              (Math.random() * 0x100000000 + 1).toString(36),
              affixes.suffix].join('');
  return path.join(affixes.dir || exports.dir, name);
};

var parseAffixes = function(rawAffixes, defaultPrefix) {
  var affixes = {prefix: null, suffix: null};
  if(rawAffixes) {
    switch (typeof(rawAffixes)) {
    case 'string':
      affixes.prefix = rawAffixes;
      break;
    case 'object':
      affixes = rawAffixes;
      break;
    default:
      throw("Unknown affix declaration: " + affixes);
    }
  } else {
    affixes.prefix = defaultPrefix;
  }
  return affixes;
};

/* -------------------------------------------------------------------------
 * Don't forget to call track() if you want file tracking and exit handlers!
 * -------------------------------------------------------------------------
 * When any temp file or directory is created, it is added to filesToDelete
 * or dirsToDelete. The first time any temp file is created, a listener is
 * added to remove all temp files and directories at exit.
 */
var tracking = false;
var track = function(value) {
  tracking = (value !== false);
  return module.exports; // chainable
};
var exitListenerAttached = false;
var filesToDelete = [];
var dirsToDelete = [];

var deleteFileOnExit = function(filePath) {
  if (!tracking) return false;
  attachExitListener();
  filesToDelete.push(filePath);
};

var deleteDirOnExit = function(dirPath) {
  if (!tracking) return false;
  attachExitListener();
  dirsToDelete.push(dirPath);
};

var attachExitListener = function() {
  if (!tracking) return false;
  if (!exitListenerAttached) {
    process.addListener('exit', cleanupSync);
    exitListenerAttached = true;
  }
};

var cleanupFilesSync = function() {
  if (!tracking) return false;
  var counts = {removed: 0, missing: 0};
  var toDelete;
  while ((toDelete = filesToDelete.shift()) !== null) {
    try {
      fs.unlinkSync(toDelete);
      counts.removed++;
    } catch (rmErr) {
      /* removed normally */
      counts.missing++;
    }
  }
  return counts;
};

var cleanupFiles = function(callback) {
  if (!tracking) callback(false);
  var counts = {removed: 0, missing: 0};
  var left = filesToDelete.length;
  if (!left) {
    callback(counts);
  } else {
    var toDelete;
    var unlinkCallback = function(err) {
      if (err) {
        counts.missing++;
      } else {
        counts.removed++;
      }
      left--;
      if (!left) callback(counts);
    };
    while ((toDelete = filesToDelete.shift()) !== null) {
      fs.unlink(toDelete, unlinkCallback);
    }
  }
};

var cleanupDirsSync = function() {
  if (!tracking) return false;
  var rimrafSync = require('rimraf').sync;
  var counts = {removed: 0, missing: 0};
  var toDelete;
  var rimrafCallback = function (err) {
    if (err) {
      throw err;
    } else {
      counts.removed++;
    }
  };
  while ((toDelete = dirsToDelete.shift()) !== null) {
    try {
      rimrafSync(toDelete, rimrafCallback);
    } catch (rmErr) {
      /* removed normally */
      counts.missing++;
    }
  }
  return counts;
};

var cleanupDirs = function(callback) {
  if (!tracking) callback(false);
  var rimraf = require('rimraf');
  var counts = {removed: 0, missing: 0};
  var left = dirsToDelete.length;
  if (!left) {
    callback(counts);
  } else {
    var toDelete;
    var rimrafCallback = function (err) {
      if (err) {
        counts.missing++;
      } else {
        counts.removed++;
      }
      left--;
      if (!left) {
        callback(counts);
      }
    };
    while ((toDelete = dirsToDelete.shift()) !== null) {
      rimraf(toDelete, rimrafCallback);
    }
  }
};

var cleanupSync = function() {
  if (!tracking) return false;
  var fileCount = cleanupFilesSync();
  var dirCount  = cleanupDirsSync();
  return {files: fileCount, dirs: dirCount};
};

var cleanup = function(callback) {
  if (!tracking) {
    callback(false);
  } else {
    cleanupFiles(function(fileCount) {
      cleanupDirs(function(dirCount) {
        callback({files: fileCount, dirs: dirCount});
      });
    });
  }
};

/* DIRECTORIES */

var mkdir = function(affixes, callback) {
  var dirPath = generateName(affixes, 'd-');
  fs.mkdir(dirPath, 0700, function(err) {
    if (!err) {
      deleteDirOnExit(dirPath);
    }
    if (callback)
      callback(err, dirPath);
  });
};

var mkdirSync = function(affixes) {
  var dirPath = generateName(affixes, 'd-');
  fs.mkdirSync(dirPath, 0700);
  deleteDirOnExit(dirPath);
  return dirPath;
};

/* FILES */

var open = function(affixes, callback) {
  var filePath = generateName(affixes, 'f-');
  fs.open(filePath, RDWR_EXCL, 0600, function(err, fd) {
    if (!err)
      deleteFileOnExit(filePath);
    if (callback)
      callback(err, {path: filePath, fd: fd});
  });
};

var openSync = function(affixes) {
  var filePath = generateName(affixes, 'f-');
  var fd = fs.openSync(filePath, RDWR_EXCL, 0600);
  deleteFileOnExit(filePath);
  return {path: filePath, fd: fd};
};

var createWriteStream = function(affixes) {
  var filePath = generateName(affixes, 's-');
  var stream = fs.createWriteStream(filePath, {flags: RDWR_EXCL, mode: 0600});
  deleteFileOnExit(filePath);
  return stream;
};

/* EXPORTS */
// Settings
exports.dir               = path.resolve(os.tmpDir());
exports.track             = track;
// Functions
exports.mkdir             = mkdir;
exports.mkdirSync         = mkdirSync;
exports.open              = open;
exports.openSync          = openSync;
exports.path              = generateName;
exports.cleanup           = cleanup;
exports.cleanupSync       = cleanupSync;
exports.createWriteStream = createWriteStream;
