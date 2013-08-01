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

UglifyJSCompiler.prototype.compileFileWithLib = function (file, done) {
    var UglifyJS = require('uglify-js'),
        options = file.settings,
        abort = false, index, numberOfRemainingFiles,
        files;

    files = this._getImports(file.src);
    files = files.prepend.concat(file.src, files.append);
    numberOfRemainingFiles = files.length;

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
    var imports = this._getImports(srcFile);
    return imports.prepend.concat(imports.append);
};

UglifyJSCompiler.prototype._getImports = function (srcFile) {
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
