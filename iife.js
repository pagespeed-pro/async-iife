/**
 * AsynC CSS Loader IIFE generator
 */

const fs = require('fs');
const request = require('request');
const md5 = require('md5');
const zlib = require('zlib');
const cache = require('memory-cache');
const path = require('path');

var sources = {};

// load package and module sources
function load_sources(root_path) {

    // use NPM @style.tools/async-css package
    var npm_sources = false;
    if (!root_path) {
        root_path = '@style.tools/async/';
        npm_sources = true;
    }

    // already initiated
    if (root_path in sources) {
        return sources[root_path];
    }

    // path resolver
    var resolver = function(file) {
        return (npm_sources) ? require.resolve(root_path + file) : path.resolve(root_path, file);
    }

    sources[root_path] = {
        path: root_path,
        pack: JSON.parse(fs.readFileSync(resolver('package.json'), 'utf8')),
        externs: fs.readFileSync(resolver('async.ext.js'), 'utf8'),
        index: fs.readFileSync(resolver('src/compression-index.json'), 'utf8'),
        dist: {},
        debug: {}
    };

    // read module sources
    sources[root_path].pack._modules.forEach(function(mod, i) {
        sources[root_path].dist[mod[0]] = fs.readFileSync(resolver('dist/' + mod[0] + '.js'), 'utf8');
        sources[root_path].debug[mod[0]] = fs.readFileSync(resolver('dist/debug/' + mod[0] + '.js'), 'utf8');
    });

    return sources[root_path];
};

// IIFE generator
class IIFE_Generator {
    constructor(modules, options) {

        if (!(modules instanceof Array)) {
            modules = [];
        }
        if (typeof options !== 'object') {
            options = {};
        }

        this.modules = modules;
        this.debug = options.debug ? true : false;
        this.compress = options.compress ? true : false;
        this.cache = (typeof options.cache !== 'undefined') ? !!options.cache : true; // enabled by default
        this.output = options.output || false;
        this.output_stats = options.output_stats || false;
        this.format = (options.format && ['unary', 'wrap'].indexOf(options.format.toLowerCase()) !== -1) ? options.format.toLowerCase() : 'none';

        // load package and module sources
        this.sources = load_sources(options.root_path || false);
    }

    is_active(name) {
        return this.modules.indexOf(name) !== -1
    }

    add_module(name) {
        var index = 0;
        this.sources.pack._modules.forEach(function(mod, i) {
            if (mod[0] === name) {
                index = i;
            }
        });
        this.modules[index] = name;

        // event-emitter dependency
        if (['api', 'debug', 'dependency'].indexOf(name) !== -1) {
            this.add_module('event-emitter');
        }

        // cache module
        if (name === 'cache') {
            if (this.is_active('css-loader')) {
                this.add_module('cache-css');
            }
            if (this.is_active('js-loader')) {
                this.add_module('cache-js');
            }
            this.add_module('event-emitter');
        }

        // capture module
        if (name === 'capture') {
            if (this.is_active('css-loader')) {
                this.add_module('capture-css');
            }
            if (this.is_active('js-loader')) {
                this.add_module('capture-js');
            }
        }
    }

    write_output(iife) {
        var that = this;

        return new Promise(function(resolve, reject) {

            fs.writeFile(that.output, iife, function(err) {
                if (err) {
                    reject(err);
                } else {

                    if (that.output_stats) {

                        var stats = fs.statSync(that.output);

                        zlib.gzip(iife, function(error, gzip) {
                            if (error) {
                                reject(error);
                            } else {

                                resolve({
                                    modules: that.modules,
                                    size: stats.size,
                                    gzip_size: gzip.length
                                })
                            }
                        });
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    // generate IIFE
    generate() {

        var that = this;

        return new Promise(function(resolve, reject) {

            var all = false;
            var errors = [];
            var modules = [];

            // parse module names
            that.modules.forEach(function(module) {
                module = module.trim();
                if (module) {
                    module = module.toLowerCase();

                    if (module === 'all') {
                        all = true;
                    } else {

                        var found = false;
                        that.sources.pack._modules.forEach(function(_module, index) {
                            if (module === _module[0]) {
                                found = index;
                            }
                        });
                        if (found === false) {
                            errors.push(module + ' is not a valid module. See package.json#_modules for a list of valid modules.');
                        } else {
                            modules[found] = module;
                        }

                    }
                }
            });
            that.modules = modules;

            // load all modules
            if (all) {
                that.modules = [];
                that.sources.pack._modules.forEach(function(mod, i) {
                    that.modules.push(mod[0]);
                });
            }

            if (that.modules.length === 0) {
                reject('no_modules');
            } else if ((that.modules.indexOf('css-loader') === -1 && that.modules.indexOf('js-loader') === -1)) {
                reject('missing_loader_module');
            } else if (errors.length) {
                reject(errors);
            } else {

                // event emitter is required for debug
                if (that.debug) {
                    that.add_module('debug');
                }

                that.sources.pack._modules.forEach(function(module, index) {
                    module = module[0];

                    if (['css-loader', 'js-loader'].indexOf(module) !== -1) {
                        if (that.is_active(module)) {
                            that.add_module(module);
                        }
                    } else if (module === 'regex') {

                        // required dependency
                        if (that.is_active('dependency') || that.is_active('capture')) {
                            that.add_module(module);
                        }

                    } else if (module === 'vendor') {

                        // required dependency
                        if (that.is_active('timing') || that.is_active('capture-observer')) {
                            that.add_module(module);
                        }

                    } else if (that.is_active(module)) {

                        if (module === 'debug' && !that.debug) {
                            // ignore
                        } else if (module === 'inview') {

                            that.add_module('timing');

                            that.add_module(module);
                        } else if (module === 'responsive') {

                            that.add_module('timing');

                            that.add_module(module);
                        } else if (module === 'localstorage') {

                            that.add_module('cache');

                            that.add_module(module);
                        } else if (module === 'cache-api') {

                            that.add_module('cache');

                            that.add_module(module);
                        } else if (module === 'capture') {

                            if (!that.is_active('capture-insert') && !that.is_active('capture-observer')) {
                                that.add_module('capture-insert');
                            }

                            that.add_module(module);
                        } else {

                            if (module.indexOf('capture-') === 0 && !that.is_active('capture')) {
                                that.add_module('capture');
                            }

                            that.add_module(module);
                        }
                    }
                });

                // add async core
                that.modules[0] = 'async-core';

                // reindex
                var modules = [];
                that.modules.forEach(function(module) {
                    if (module) {
                        modules.push(module);
                    }
                });
                that.modules = modules;

                var hash = md5(JSON.stringify([that.modules, that.format, that.compress, that.debug, that.path]));

                // try cache
                var cached = (that.cache) ? cache.get(hash) : false;
                if (cached) {

                    // write to file
                    if (that.output) {
                        that.write_output(cached)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        resolve(cached);
                    }
                } else {

                    // create IIFE
                    var iife = [];
                    if (that.format === 'wrap') {
                        iife.push('(function(window){');
                    } else if (that.format === 'unary') {
                        iife.push('!function(window){');
                    }

                    // load module sources
                    modules.forEach(function(module) {
                        if (that.debug) {
                            iife.push(that.sources.debug[module]);
                        } else {
                            iife.push(that.sources.dist[module]);
                        }
                    });

                    if (that.format === 'wrap') {
                        iife.push('})(window);');
                    } else if (that.format === 'unary') {
                        iife.push('}(window);');
                    }

                    iife = iife.join('');

                    // add Google Closure compiler compression
                    if (that.compress) {

                        request({
                            url: "https://closure-compiler.appspot.com/compile",
                            method: "POST",
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                            form: {
                                'compilation_level': 'ADVANCED_OPTIMIZATIONS',
                                'warning_level': 'QUIET',
                                'language': 'ECMASCRIPT6',
                                'language_out': 'ECMASCRIPT5',
                                'js_externs': that.sources.externs,
                                'js_code': iife,
                                'output_info': 'compiled_code'
                            }
                        }, function(error, response, body) {

                            if (error || response.statusCode !== 200) {
                                reject(error);
                            } else {

                                iife = body.trim();

                                // store in cache
                                if (that.cache) {
                                    cache.put(hash, iife);
                                }

                                // write to file
                                if (that.output) {
                                    that.write_output(iife)
                                        .then(resolve)
                                        .catch(reject);
                                } else {
                                    resolve(iife);
                                }
                            }

                        });

                    } else {

                        // store in cache
                        if (that.cache) {
                            cache.put(hash, iife);
                        }

                        // write to file
                        if (that.output) {
                            that.write_output(iife)
                                .then(resolve)
                                .catch(reject);
                        } else {
                            resolve(iife);
                        }
                    }
                }
            }
        });
    }
}


// config compressor
class Compressor {
    constructor(options) {

        // load package and module sources
        this.sources = load_sources(options.root_path || false);

        this._index = {};
        var index = JSON.parse(this.sources.index);
        var _i = 0;
        for (var group in index) {
            if (index.hasOwnProperty(group)) {
                for (var i = 0, l = index[group].length; i < l; i++) {
                    this._index[index[group][i]] = _i;
                    _i++;
                }
            }
        }
    }

    // compress config
    compress(config, js_config, global_base = false) {

        if (config === null) {
            config = [];
        }

        if (typeof config === 'string') {
            try {
                var json = JSON.parse(config);
                config = json;
            } catch (e) {

            }
        }

        if (!config) {
            return config;
        }

        var compressed = [];

        var is_global = false;
        if (global_base) {

            // trailingslash
            if (global_base.substr(-1) !== '/') {
                global_base += '/';
            }
        }

        if (config instanceof Array) {
            for (var i = 0, l = config.length; i < l; i++) {
                config[i] = this.compress(config[i], false, global_base);
            }
        } else {

            if (typeof config === 'object') {
                var data;
                for (var key in config) {
                    if (config.hasOwnProperty(key)) {
                        data = config[key];

                        // compress base href
                        if (['href', 'src'].indexOf(key) !== -1 && typeof data === 'string' && global_base) {

                            if (data.indexOf(global_base) === 0) {
                                data = data.replace(global_base, '', data);
                            }
                        }

                        // cache source array
                        if (key === 'source') {
                            var valid = ['xhr', 'cors', 'cssText'];
                            if (typeof data === 'string' && valid.indexOf(data) !== -1) {
                                config[key] = data = this.index(data);
                            } else if (typeof data === 'object') {
                                var value;
                                for (var _key in data) {
                                    if (data.hasOwnProperty(_key)) {
                                        value = data[_key];
                                        if (typeof value === 'string' && valid.indexOf(value) !== -1) {
                                            data[_key] = this.index(value);
                                        }
                                    }
                                }
                                config[key] = data;
                            }
                        }

                        // deep array
                        if (typeof data === 'object' && ['proxy', 'attributes'].indexOf(key) === -1) {
                            config[key] = data = this.compress(data, false, global_base);
                        }

                        // data
                        if (typeof data === 'string' && this.index(data, 1) !== false &&
                            [
                                'href',
                                'src',
                                'match',
                                'proxy',
                                'search',
                                'replace',
                                'attributes'
                            ].indexOf(key) === -1
                        ) {
                            config[key] = data = this.index(data);
                        }

                        if (this.index(key, 1) !== false) {
                            config[this.index(key)] = data;

                            delete config[key];
                        }
                    }
                }
            } else if (typeof config === 'string' && global_base) {
                if (config.indexOf(global_base) === 0) {
                    config = config.replace(global_base, '', config);
                }
            }
        }

        // add javascript loader config at data-c slot 5 t/m 8
        if (js_config) {
            config = [config];
            var _compressed = [this.compress(js_config, false, global_base)];
            if (_compressed) {
                var l = 7 - (4 - _compressed.length);
                for (var i = 0; i <= l; i++) {
                    if (i < 4) {
                        if (typeof config[i] === 'undefined' || !config[i]) {
                            config[i] = 0;
                        }
                    } else {
                        config[i] = _compressed[i - 4];
                    }
                }
            }
        }

        return config;
    }


    // return compressed index by key
    index(key, exists) {

        if (key in this._index) {
            return this._index[key];
        }

        if (exists) {
            return false;
        }

        return key;
    }
}

// Async CSS Loader version
exports.version = function(root_path) {
    return load_sources(root_path).pack.version;
};

// Compress config
var compressor;
exports.compress = function(config, js_config, global_base = false, options = {}) {

    if (!compressor) {
        if (typeof options !== 'object') {
            options = {};
        }
        compressor = new Compressor(options);
    }
    return JSON.stringify(compressor.compress(config, js_config, global_base));
};

// generate IIFE code for inlining (very fast via memory cache)
exports.generate = function(modules, options = {}) {

    if (typeof modules === 'string') {
        modules = [modules];
    }
    if (typeof options !== 'object') {
        options = {};
    }

    var generator = new IIFE_Generator(modules, options);
    return generator.generate();
}