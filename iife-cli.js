#!/usr/bin/env node

/**
 * CLI progam (Node.js) to generate an IIFE with a selection of Async CSS loader modules
 */

const iife = require('./iife.js');
const cTable = require('console.table');
const program = require('commander');

program
    .version(iife.version, '-v, --version')
    .usage('[options] <module, module, ...>')
    .option('-c, --compress', 'compress IIFE using Google Closure Compiler')
    .option('-f, --format [format]', 'IIFE format [wrap|unary|none]', 'none')
    .option('-d, --debug', 'load debug sources (Performance API timings etc.)', 'none')
    .option('-o, --output [output]', 'output to file (otherwise printed to stdout)')
    .option('-r, --root_path [root_path]', 'Root path of Async CSS Loader dist/')
    .option('-m, --modules <modules>', 'modules to load (separated by commas or spaces). "all" for all modules.', function(list) {
        return list.split(/[\s,]+/g);
    });

// help
program.on('--help', function() {
    console.log('')

    var modules = [];
    pack._modules.forEach(function(module) {
        modules.push({
            module: module[0],
            description: module[1]
        });
    });
    console.table(modules);
});

// parse arguments
program.parse(process.argv);

// generate IIFE
iife.generate(program.modules, {
    compress: program.compress || false,
    debug: program.debug || false,
    format: program.format || 'none',
    output: program.output || false,
    root_path: program.root_path || false,
    output_stats: true
}).then(function(res) {

    // output to file, display stats
    if (program.output) {
        console.log('\n\n\tIIFE saved\n\n\tModules: ' + res.modules.join(', ') + '' + ((program.debug) ? '\n\tMode: debug (sources from dist/debug)' : '') + '' + ((program.compress) ? '\n\tCompress: Google Closure Compiler API' : '') + '\n\n\tFile: ' + program.output + '\n\tSize: ' + (res.size / 1024).toFixed(1) + 'kb (' + res.size + ' bytes)\n\tSize (gzip): ' + (res.gzip_size / 1024).toFixed(1) + 'kb (' + res.gzip_size + ' bytes)\n\n')
    } else {
        console.log(res);
    }

}).catch(function(error) {
    if (error === 'no_modules') {
        console.error('\n\n\tYou did not select any modules.\n\n\tSee --help for a list of available modules.\n\n');
    } else if (error === 'missing_loader_module') {
        console.error('\n\n\tYou did not select the css-loader or js-loader module.\n\n\tSee --help for a list of available modules.\n\n');
    } else if (error instanceof Array) {
        console.error('\n\nErrors:\n' + errors.join('\n') + '\n\n');
    } else {
        console.error(error);
    }
});