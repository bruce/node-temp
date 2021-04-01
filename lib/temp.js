'use strict';
let fs   = require('fs');
let path = require('path');
let cnst = require('constants');

let os         = require('os');
let rimraf     = require('rimraf');
let mkdirp     = require('mkdirp');
let osTmpdir   = require('os').tmpdir();

const rimrafSync = rimraf.sync;

//== helpers
//
let dir = path.resolve(os.tmpdir());

let RDWR_EXCL = cnst.O_CREAT | cnst.O_TRUNC | cnst.O_RDWR | cnst.O_EXCL;

function promisify(callback) {
  if (typeof callback === 'function') {
    return [undefined, callback];
  }

  let promiseCallback;
  const promise = new Promise(function(resolve, reject) {
    promiseCallback = function() {
      const args = Array.from(arguments);
      const err = args.shift();

      process.nextTick(function() {
        if (err) {
          reject(err);
        } else if (args.length === 1) {
          resolve(args[0]);
        } else {
          resolve(args);
        }
      });
    };
  });

  return [promise, promiseCallback];
};

function generateName(rawAffixes, defaultPrefix) {
  const affixes = parseAffixes(rawAffixes, defaultPrefix);
  const now = new Date();
  const name = [affixes.prefix,
              now.getFullYear(), now.getMonth(), now.getDate(),
              '-',
              process.pid,
              '-',
              (Math.random() * 0x100000000 + 1).toString(36),
              affixes.suffix].join('');
  return path.join(affixes.dir || dir, name);
};

function parseAffixes(rawAffixes, defaultPrefix) {
  let affixes = {prefix: null, suffix: null};
  if(rawAffixes) {
    switch (typeof(rawAffixes)) {
    case 'string':
      affixes.prefix = rawAffixes;
      break;
    case 'object':
      affixes = rawAffixes;
      break;
    default:
      throw new Error(`Unknown affix declaration: ${affixes}`);
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
let tracking = false;
function track(value) {
  tracking = (value !== false);
  return module.exports; // chainable
};
let exitListenerAttached = false;
const filesToDelete = [];
const dirsToDelete = [];

function deleteFileOnExit(filePath) {
  if (!tracking) return false;
  attachExitListener();
  filesToDelete.push(filePath);
}

function deleteDirOnExit(dirPath) {
  if (!tracking) return false;
  attachExitListener();
  dirsToDelete.push(dirPath);
}

function attachExitListener() {
  if (!tracking) return false;
  if (!exitListenerAttached) {
    process.addListener('exit', function() {
        try {
            cleanupSync();
        } catch(err) {
            console.warn("Fail to clean temporary files on exit : ", err);
            throw err;
        }
    });
    exitListenerAttached = true;
  }
}

function cleanupFilesSync() {
  if (!tracking) {
    return false;
  }
  let count = 0;
  let toDelete;
  while ((toDelete = filesToDelete.shift()) !== undefined) {
    rimrafSync(toDelete, { maxBusyTries: 6 });
    count++;
  }
  return count;
}

function cleanupFiles(callback) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];

  if (!tracking) {
    callback(new Error("not tracking"));
    return promise;
  }
  let count = 0;
  let left = filesToDelete.length;
  if (!left) {
    callback(null, count);
    return promise;
  }
  let toDelete;
  const rimrafCallback = function(err) {
    if (!left) {
      // Prevent processing if aborted
      return;
    }
    if (err) {
      // This shouldn't happen; pass error to callback and abort
      // processing
      callback(err);
      left = 0;
      return;
    } else {
      count++;
    }
    left--;
    if (!left) {
      callback(null, count);
    }
  };
  while ((toDelete = filesToDelete.shift()) !== undefined) {
    rimraf(toDelete, { maxBusyTries: 6 }, rimrafCallback);
  }
  return promise;
}

function cleanupDirsSync() {
  if (!tracking) {
    return false;
  }
  let count = 0;
  let toDelete;
  while ((toDelete = dirsToDelete.shift()) !== undefined) {
    rimrafSync(toDelete, { maxBusyTries: 6 });
    count++;
  }
  return count;
}

function cleanupDirs(callback) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];

  if (!tracking) {
    callback(new Error("not tracking"));
    return promise;
  }
  let count = 0;
  let left = dirsToDelete.length;
  if (!left) {
    callback(null, count);
    return promise;
  }
  let toDelete;
  const rimrafCallback = function (err) {
    if (!left) {
      // Prevent processing if aborted
      return;
    }
    if (err) {
      // rimraf handles most "normal" errors; pass the error to the
      // callback and abort processing
      callback(err, count);
      left = 0;
      return;
    } else {
      count++;
    }
    left--;
    if (!left) {
      callback(null, count);
    }
  };
  while ((toDelete = dirsToDelete.shift()) !== undefined) {
    rimraf(toDelete, { maxBusyTries: 6 }, rimrafCallback);
  }
  return promise;
}

function cleanupSync() {
  if (!tracking) {
    return false;
  }
  const fileCount = cleanupFilesSync();
  const dirCount  = cleanupDirsSync();
  return {files: fileCount, dirs: dirCount};
}

function cleanup(callback) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];

  if (!tracking) {
    callback(new Error("not tracking"));
    return promise;
  }
  cleanupFiles(function(fileErr, fileCount) {
    if (fileErr) {
      callback(fileErr, {files: fileCount});
    } else {
      cleanupDirs(function(dirErr, dirCount) {
        callback(dirErr, {files: fileCount, dirs: dirCount});
      });
    }
  });
  return promise;
}

//== directories
//
function mkdir(affixes, callback) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];

  let dirPath = generateName(affixes, 'd-');
  mkdirp(dirPath, 0o700, (err) => {
    if (!err) {
      deleteDirOnExit(dirPath);
    }
    callback(err, dirPath);
  });
  return promise;
}

function mkdirSync(affixes) {
  let dirPath = generateName(affixes, 'd-');
  mkdirp.sync(dirPath, 0o700);
  deleteDirOnExit(dirPath);
  return dirPath;
}

//== files
//
function open(affixes, callback) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];

  const path = generateName(affixes, 'f-');
  fs.open(path, RDWR_EXCL, 0o600, (err, fd) => {
    if (!err) {
      deleteFileOnExit(path);
    }
    callback(err, { path, fd });
  });
  return promise;
}

function openSync(affixes) {
  const path = generateName(affixes, 'f-');
  let fd = fs.openSync(path, RDWR_EXCL, 0o600);
  deleteFileOnExit(path);
  return { path, fd };
}

function createWriteStream(affixes) {
  const path = generateName(affixes, 's-');
  let stream = fs.createWriteStream(path, { flags: RDWR_EXCL, mode: 0o600 });
  deleteFileOnExit(path);
  return stream;
}

//== settings
//
exports.dir = dir;
exports.track = track;

//== functions
//
exports.mkdir = mkdir;
exports.mkdirSync = mkdirSync;
exports.open = open;
exports.openSync = openSync;
exports.path = generateName;
exports.cleanup = cleanup;
exports.cleanupSync = cleanupSync;
exports.createWriteStream = createWriteStream;
