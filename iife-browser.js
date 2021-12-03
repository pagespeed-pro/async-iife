/**
 * Async CSS Loader IIFE generator for use in the browser
 *
 * Usage: iife.generate(modules,options).then()
 */

var iife = (function() {

    var pack;
    var sources = {};
    var _root = 'node_modules/@style.tools/async/';

    // load file from module directory
    function get_source(src) {
        return new Promise(function(resolve, reject) {
            if (src in sources) {
                return resolve(sources[src]);
            }

            fetch(_root + src).then(function(res) {

                res.text().then(function(text) {
                    sources[src] = text;
                    resolve(text);
                });

            }).catch(function(err) {
                console.error(err);
            })
        });
    }

    // load package.json
    function get_package() {
        if (pack) {
            return Promise.resolve(pack);
        }
        return get_source('package.json').then(function(text) {
            pack = JSON.parse(text);
            return pack;
        });
    }

    var _index;

    function load_index() {

        if (!_index) {
            return new Promise(function(resolve, reject) {
                _index = {};
                get_source('src/compression-index.json').then(function(src) {
                    var index = JSON.parse(src);
                    var _i = 0;
                    for (var group in index) {
                        if (index.hasOwnProperty(group)) {
                            for (var i = 0, l = index[group].length; i < l; i++) {
                                _index[index[group][i]] = _i;
                                _i++;
                            }
                        }
                    }
                    resolve(_index);
                });
            });
        } else {
            return Promise.resolve(_index);
        }
    }

    // compress config
    function compress(config, global_base = false) {

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
            let nocapture;
            for (var i = 0, l = config.length; i < l; i++) {

                if (!deep) {
                    // no capture config
                    if (i === 2 && (!config[i] || !config[i].length)) {
                        delete config[i];
                        nocapture = true;
                        continue;
                    }
                    if (i === 3 && nocapture) {
                        delete config[i];
                        break;
                    }
                }

                config[i] = compress(config[i], global_base, true);
            }
            if (!deep) {
                if (nocapture && (!config[1] || !Object.keys(config[1]).length)) {
                    delete config[1];
                }
            }

            config = config.filter((value) => {
                return value !== undefined
            });
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
                            valid = ['xhr', 'cors', 'cssText'];
                            if (typeof data === 'string' && valid.indexOf(data) !== -1) {
                                config[key] = data = index(data);
                            } else if (typeof data === 'object') {
                                var value;
                                for (var _key in data) {
                                    if (data.hasOwnProperty(_key)) {
                                        value = data[_key];
                                        if (typeof value === 'string' && valid.indexOf(value) !== -1) {
                                            data[_key] = index(value);
                                        }
                                    }
                                }
                                config[key] = data;
                            }
                        }

                        // deep array
                        if (typeof data === 'object' && ['proxy', 'attributes'].indexOf(key) === -1) {
                            config[key] = data = compress(data, false, global_base);
                        }

                        // data
                        if (typeof data === 'string' && index(data, 1) !== false &&
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
                            config[key] = data = index(data);
                        }

                        if (index(key, 1) !== false) {
                            config[index(key)] = data;

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

        return config;
    }


    // return compressed index by key
    function index(key, exists) {

        if (key in _index) {
            return _index[key];
        }

        if (exists) {
            return false;
        }

        return key;
    }


    return {

        root: function(path) {
            _root = path;
        },

        version: function() {
            return get_package().then(function(pack) {
                return pack.version;
            })
        },

        modules: function() {
            return get_package().then(function(pack) {
                return pack._modules;
            });
        },

        generate: function(modules, options) {

            var __modules = (modules) ? modules.slice(0) : [];
            var __options = JSON.parse(JSON.stringify(options || {}));

            return new Promise(function(resolve, reject) {

                get_package().then(function(pack) {

                    var all = false;
                    var errors = [];
                    var _modules = [];

                    if (!(__modules instanceof Array)) {
                        __modules = [];
                    }
                    if (typeof __options !== 'object') {
                        __options = {};
                    }
                    var modules = __modules;
                    var options = __options;

                    var debug = options.debug ? true : false;
                    var compress = options.compress ? true : false;
                    var format = (options.format && ['unary', 'wrap'].indexOf(options.format.toLowerCase()) !== -1) ? options.format.toLowerCase() : 'none';

                    function add_module(name) {
                        var index = 0;
                        pack._modules.forEach(function(mod, i) {
                            if (mod[0] === name) {
                                index = i;
                            }
                        });
                        modules[index] = name;

                        // event-emitter dependency
                        if (['api', 'debug', 'dependency'].indexOf(name) !== -1) {
                            add_module('event-emitter');
                        }

                        // cache module
                        if (name === 'cache') {
                            if (is_active('css-loader')) {
                                add_module('cache-css');
                            }
                            if (is_active('js-loader')) {
                                add_module('cache-js');
                            }
                            add_module('event-emitter');
                        }

                        // capture module
                        if (name === 'capture') {
                            if (is_active('css-loader')) {
                                add_module('capture-css');
                            }
                            if (is_active('js-loader')) {
                                add_module('capture-js');
                            }
                        }

                        // capture module
                        if (name === 'timing' || name === 'capture-observer') {
                            add_module('vendor');
                        }

                        if (name === 'dependency' || name === 'capture') {
                            add_module('regex');
                        }
                    }

                    function is_active(name) {
                        return modules.indexOf(name) !== -1
                    }

                    // parse module names
                    modules.forEach(function(module) {
                        module = module.trim();
                        if (module) {
                            module = module.toLowerCase();

                            if (module === 'all') {
                                all = true;
                            } else {

                                var found;
                                pack._modules.forEach(function(_module, index) {
                                    if (module === _module[0]) {
                                        found = index;
                                    }
                                });
                                if (!found) {
                                    errors.push(module + ' is not a valid module. See package.json#_modules for a list of valid modules.');
                                } else {
                                    _modules[found] = module;
                                }

                            }
                        }
                    });
                    modules = _modules;

                    // load all modules
                    if (all) {
                        modules = [];
                        pack._modules.forEach(function(mod, i) {
                            modules.push(mod[0]);
                        });
                    }

                    if (modules.length === 0) {
                        reject('no_modules');
                    } else if ((modules.indexOf('css-loader') === -1 && modules.indexOf('js-loader') === -1)) {
                        reject('missing_loader_module');
                    } else if (errors.length) {
                        reject(errors);
                    } else {

                        // event emitter is required for debug
                        if (debug) {
                            add_module('debug');
                        }

                        pack._modules.forEach(function(module, index) {
                            module = module[0];

                            if (['css-loader', 'js-loader'].indexOf(module) !== -1) {
                                if (is_active(module)) {
                                    add_module(module);
                                }
                            } else if (module === 'regex') {

                                // required dependency
                                if (is_active('dependency') || is_active('capture')) {
                                    add_module(module);
                                }

                            } else if (module === 'vendor') {

                                // required dependency
                                if (is_active('timing') || is_active('capture-observer')) {
                                    add_module(module);
                                }

                            } else if (is_active(module)) {

                                if (module === 'inview') {

                                    add_module('timing');

                                    add_module(module);
                                } else if (module === 'responsive') {

                                    add_module('timing');

                                    add_module(module);
                                } else if (module === 'localstorage') {

                                    add_module('cache');

                                    add_module(module);
                                } else if (module === 'cache-api') {

                                    add_module('cache');

                                    add_module(module);
                                } else if (module === 'capture') {

                                    if (!is_active('capture-insert') && !is_active('capture-observer')) {
                                        add_module('capture-insert');
                                    }

                                    add_module(module);
                                } else {

                                    if (module.indexOf('capture-') === 0 && !is_active('capture')) {
                                        add_module('capture');
                                    }

                                    add_module(module);
                                }
                            }
                        });

                        // add async core
                        modules[0] = 'async-core';

                        // reindex
                        var _modules = [];
                        modules.forEach(function(module) {
                            if (module) {
                                _modules.push(module);
                            }
                        });
                        modules = _modules;

                        // load module sources
                        var module_promises = [];
                        modules.forEach(function(module) {
                            if (debug) {
                                module_promises.push(get_source('dist/debug/' + module + '.js'));
                                //iife.push(debug_sources[module]);
                            } else {
                                module_promises.push(get_source('dist/' + module + '.js'));
                                //iife.push(sources[module]);
                            }
                        });

                        Promise.all(module_promises).then(function(module_sources) {

                            // create IIFE
                            var iife = [];
                            if (format === 'wrap') {
                                iife.push('(function(window){');
                            } else if (format === 'unary') {
                                iife.push('!function(window){');
                            }

                            module_sources.forEach(function(source) {
                                iife.push(source);
                            });

                            if (format === 'wrap') {
                                iife.push('})(window);');
                            } else if (format === 'unary') {
                                iife.push('}(window);');
                            }

                            iife = iife.join('');

                            // add Google Closure compiler compression
                            if (compress) {

                                // get externs
                                get_source('async.ext.js').then(function(externs_js) {

                                    var gcc_options = {
                                        'compilation_level': 'ADVANCED_OPTIMIZATIONS',
                                        'warning_level': 'QUIET',
                                        'language': 'ECMASCRIPT6',
                                        'language_out': 'ECMASCRIPT5',
                                        'js_externs': externs_js,
                                        'js_code': iife,
                                        'output_info': 'compiled_code'
                                    };

                                    const searchParams = Object.keys(gcc_options).map((key) => {
                                        return encodeURIComponent(key) + '=' + encodeURIComponent(gcc_options[key]);
                                    }).join('&');


                                    fetch("https://closure-compiler.appspot.com/compile", {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
                                        },
                                        body: searchParams
                                    }).then(function(res) {

                                        res.text().then(function(iife) {
                                            resolve(iife.trim());
                                        });

                                    }).catch(reject);

                                });

                            } else {

                                resolve(iife);
                            }

                        }).catch(reject);


                    }
                });
            });
        },

        compress: function(config, js_config, global_base = false) {
            return new Promise(function(resolve, reject) {
                load_index().then(function() {
                    var compressed = compress(config, js_config, global_base);
                    resolve(JSON.stringify(compressed));
                }).catch(reject);
            });
        }
    }
})();