/**
 * UglifyJS compiler
 */

'use strict';

var fs          = require('fs'),
    path        = require('path'),
    FileManager = global.getFileManager(),
    Compiler    = require(FileManager.appScriptsDir + '/Compiler'),
    fileWatcher = require(FileManager.appScriptsDir + '/fileWatcher.js');

function UglifyJSCompiler(config) {
    Compiler.apply(this, arguments);
}
require('util').inherits(UglifyJSCompiler, Compiler);
module.exports = UglifyJSCompiler;

var _getImports = function (srcFile) {
    //match imports from code
    var reg = /@koala-(prepend|append)\s+["']([^.]+?|.+?js)["']/g,
        result, type, importPath,

        //get fullpath of imports
        dirname = path.dirname(srcFile),
        fullPathImports = {prepend: [], append: []},

        code = fs.readFileSync(srcFile, 'utf8');

    while ((result = reg.exec(code)) !== null) {
        type = result[1];
        importPath = result[2];
        if (path.extname(importPath) !== '.js') {
            importPath += '.js';
        }

        importPath = path.resolve(dirname, importPath);

        if (fs.existsSync(importPath)) {
            fullPathImports[type].push(importPath);
        }
    }

    return fullPathImports;
};

var getCombinedFile = function (filePath, importedFiles) {
    if (typeof importedFiles === "undefined") {
        importedFiles = [];
    }

    if (importedFiles.indexOf(filePath) !== -1) {
        return [];
    }

    var importsFilter = function (importedFilePath) {
        return importedFiles.indexOf(importedFilePath) === -1;
    };

    importedFiles.push(filePath);

    var files = _getImports(filePath);
    
    var prepend = [];
    files.prepend.forEach(function (importedFilePath) {
        if (importsFilter(importedFilePath)) {
            prepend.push.apply(prepend, getCombinedFile(importedFilePath, importedFiles));
        }
    });

    var append = [];
    files.append.forEach(function (importedFilePath) {
        if (importsFilter(importedFilePath)) {
            append.push.apply(append, getCombinedFile(importedFilePath, importedFiles));
        }
    });

    return prepend.concat(filePath, append);
};

UglifyJSCompiler.prototype.compileFileWithLib = function (file, done) {
    var UglifyJS = require('uglify-js'),
        options = file.settings,
        abort = false,
        files = getCombinedFile(file.src),
        numberOfRemainingFiles = files.length, index;

    var minify = function () {
        try {
            // write output
            fs.writeFile(file.output, UglifyJS.minify(files, {fromString: true}).code, "utf8", function (err) {
                if (err) {
                    return done(err);
                }

                done();

                fileWatcher.addImports(this.getImports(file.src), file.src);
            }.bind(this));
        } catch (err) {
            done(err);
        }
    }.bind(this);

    // read code
    for (index = 0; index < files.length && !abort; index++) {
        fs.readFile(files[index], "utf8", function (err, code) {
            if (err) {
                abort = true;
                return done(err);
            }

            files[this] = code;
            numberOfRemainingFiles--;
            if (numberOfRemainingFiles === 0) {
                minify();
            }
        }.bind(index));
    }
};

UglifyJSCompiler.prototype.getImports = function (srcFile) {
    var imports = _getImports(srcFile);
    return imports.prepend.concat(imports.append);
};
