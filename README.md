node-temp -- temporary files and directories for node.js
========================================================

Handles generating a unique file/directory name under the appropriate
system temporary directory, changing the file to an appropriate mode,
and supports automatic removal.

Roughly similar in API to the `fs` module.

Synopsis
--------

Note: Working copies of the following examples can be found under the
`examples/` directory.

### Temporary Files

Temporary files can be created with `open` and `openSync`, passing
them an optional prefix, suffix, or both (see below for details on
affixes). Instead of a simple file descriptor being passed to the
callback (or returned) an object with `path` and `fd` keys is used:

    { path: "/path/to/file",
    , fd: theFileDescriptor
    }

In this example we write to a temporary file and call out to `grep` and
`wc -l` to determine the number of time `foo` occurs in the text.  The
temporary file is chmod'd `0600` and cleaned up automatically when the
process at exit:

    var temp = require('temp'),
        fs   = require('fs'),
        sys  = require('sys'),
        exec = require('child_process').exec;

    // Fake data
    var myData = "foo\nbar\nfoo\nbaz";

    // Process the data (note: error handling omitted)
    temp.open('myprefix', function(err, info) {
      fs.write(info.fd, myData);
      fs.close(info.fd, function(err) {
        exec("grep foo '" + info.path + "' | wc -l", function(err, stdout) {
          sys.puts(stdout.trim());
        });
      });
    });

Don't want to the file opened, the mode changed, or file cleanup
handled, and just want a unique name in your system temporary
directory?  You can use `temp.path` (details further below).

### Temporary Directories

To create a temporary directory, use `mkdir` and `mkdirSync`, passing
it an optional prefix, suffix, or both (see below for details on affixes).

In this example we create a temporary directory, write to a file
within it, call out to an external program to create a PDF, and read
the result.  While the external process creates a lot of additional
files, the temporary directory is removed automatically at exit:

    var temp = require('../lib/temp'),
        fs   = require('fs'),
        sys  = require('sys'),
        path = require('path'),
        exec = require('child_process').exec;

    // For use with ConTeXt, http://wiki.contextgarden.net
    var myData = "\\starttext\nHello World\n\\stoptext";

    temp.mkdir('pdfcreator', function(err, dirPath) {
      var inputPath = path.join(dirPath, 'input.tex')
      fs.writeFile(inputPath, myData, function(err) {
        if (err) throw err;
        process.chdir(dirPath);
        exec("texexec '" + inputPath + "'", function(err) {
          if (err) throw err;
          fs.readFile(path.join(dirPath, 'input.pdf'), function(err, data) {
            if (err) throw err;
            sys.print(data);
          });
        });
      });
    });

### Affixes

You can define custom affixes when creating temporary files and
directories; this is done in the first argument.  Here are some
examples:

* `"aprefix"`: A simple prefix, prepended to the filename; this is
  shorthand for:
* `{prefix: "aprefix"}`: A simple prefix, prepended to the filename
* `{suffix: ".asuffix"}`: A suffix, appended to the filename
  (especially useful when the file needs to be named with specific
  extension for use with an external program).
* `{prefix: "myprefix", suffix: "mysuffix"}`: Customize both affixes
* `null`: Use the defaults for files and directories (prefixes `"f-"`
  and `"d-"`, respectively, no suffixes).

In this simple example we read a `pdf`, write it to a temporary file with
a `.pdf` extension, and close it.

    var fs   = require('fs'),
        temp = require('temp');

    fs.readFile('/path/to/source.pdf', function(err, data) {
      temp.open({suffix: '.pdf'}, function(err, info) {
        if (err) throw err;
        fs.write(info.fd, contents);
        fs.close(info.fd, function(err) {
          if (err) throw err;
          // Do something with the file
        });
      });
    });

### Just a path, please

If you just want a unique name in your temporary directory, use
`path`:

    var fs = require('fs');
    var tempName = temp.path({suffix: '.pdf'});
    // Do something with tempName
    
Note: The file isn't created for you, and the  mode is not changed  -- and it
will not be removed automatically at exit.  If you use `path`, it's
all up to you.

Compatibility
-------------

Works with Node.js v0.1.96 on OSX.  Please let me know if you have
problems running it on a [fairly up-to-date] version of Node.js or
have platform problems.

Testing
-------

For now, run `test/test-temp.js`:

    $ node test/test-temp.js

Contributing
------------

You can find the repository at:
http://github.com/bruce/node-temp

Issues/Feature Requests can be submitted at:
http://github.com/bruce/node-temp/issues

I'd really like to hear your feedback, and I'd love to receive your
pull-requests!

Copyright
---------

Copyright (c) 2010 Bruce Williams. See LICENSE for details.
