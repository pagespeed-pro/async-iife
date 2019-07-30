#!/usr/bin/env node

/**
 * CLI progam (Node.js) to generate an IIFE with a selection of Async CSS loader modules
 */

const iife = require('./iife.js');
const program = require('commander');

program
    .version(iife.version, '-v, --version')
    .usage('[options] <config>')
    .option('-c, --config <config>', 'JSON config to compress');

// parse arguments
program.parse(process.argv);

// generate IIFE
var compressed = iife.compress(program.config)

console.log(compressed);