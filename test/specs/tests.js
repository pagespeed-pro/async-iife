/** Async CSS Loader Tests */

const assert = require('assert'),
    path = require('path'),
    fs = require('fs'),
    md5 = require('md5'),
    npmCheck = require('npm-check'),
    iife = require(path.resolve(__dirname, '../../iife.js')),
    microBenchmark = require('micro-benchmark'),
    combine = require(path.resolve(__dirname, '../iife-module-combinations.js')),
    asynccss_pack = JSON.parse(fs.readFileSync(require.resolve('@style.tools/async/package.json'), 'utf8'));

const test_combinations = true;

var sources = {};

function load_sources(modules, debug) {
    var hash = md5(JSON.stringify([modules, debug]));
    if (hash in sources) {
        return sources[hash];
    }
    var text = [];
    modules.forEach(function(module) {
        text.push(fs.readFileSync(require.resolve('@style.tools/async/dist/' + ((debug) ? 'debug/' : '') + module + '.js'), 'utf8'));
    });
    sources[hash] = text.join('');
    return sources[hash];
}

describe('IIFE generator tests', function() {

    // generate IIFE
    before(function(done) {

        // create tmp directory
        fs.mkdirSync(path.resolve(__dirname, '../tmp/'));

        done();
    });

    // setup tests

    it('Bundled Async CSS Loader version ' + asynccss_pack.version + ' is the latest version', function(done) {
        this.timeout(5000);
        npmCheck({
                cwd: path.resolve(__dirname, '../..'),
                //ignore: ['!@style.tools']
                ignoreDev: true
            })
            .then(function(currentState) {
                var _pack;
                currentState.get('packages').forEach(function(__pack) {
                    if (__pack.moduleName === '@style.tools/async') {
                        _pack = __pack;
                    }
                });

                assert.equal((_pack) ? _pack.latest : false, asynccss_pack.version);
                done();
            });
    });

    it('Exposes generate() method', function(done) {
        assert.equal(typeof iife.generate, 'function');
        done();
    });

    it('Returns correct version', function(done) {
        assert.equal(iife.version(), asynccss_pack.version);
        done();
    });

    it('Generates css-loader with format \'none\' correctly', function(done) {
        iife.generate(['css-loader']).then(function(text) {

            assert.equal(text, load_sources(['async-core', 'css-loader']));

            done();
        }).catch(done);
    });

    it('Generates css-loader with format \'unary\' correctly', function(done) {
        iife.generate(['css-loader'], {
            format: 'unary',
            cache: true
        }).then(function(text) {
            assert.equal(text, '!function(window){' + load_sources(['async-core', 'css-loader']) + '}(window);');
            done();
        }).catch(done);
    });

    it('Loads css-loader from cache 1000x correctly', function(done) {

        var result = microBenchmark.suiteAsync({
            maxOperations: 1000, // retrieve IIFE 1000x
            specs: [{
                name: 'iife-from-cache',
                fn: function(cb) {
                    iife.generate(['css-loader'], {
                        format: 'unary',
                        cache: true
                    }).then(function(text) {
                        assert.equal(text, '!function(window){' + load_sources(['async-core', 'css-loader']) + '}(window);');
                        cb();
                    });
                }
            }]
        }, function(result) {

            // require at least 1000 per second
            assert.equal(result[0].ops > 1000, true);

            done();

            // print benchmark results
            var report = microBenchmark.report(result, {
                chartWidth: 10
            });
            console.log(report);
        });
    });

    it('Loads js-loader with format \'wrap\' correctly', function(done) {

        iife.generate(['js-loader'], {
            format: 'wrap'
        }).then(function(text) {
            assert.equal(text, '(function(window){' + load_sources(['async-core', 'js-loader']) + '})(window);');
            done();
        }).catch(done);
    });

    it('Loads css-loader, localstorage + timing correctly', function(done) {

        iife.generate(['css-loader', 'localstorage', 'timing']).then(function(text) {
            assert.equal(text, load_sources([
                'async-core',
                'event-emitter',
                'css-loader',
                'vendor',
                'cache',
                'cache-css',
                'localstorage',
                'timing'
            ]));
            done();
        }).catch(done);
    });

    it('Loads css-loader, localstorage, timing, dependency, capture, capture-insert correctly and write to output file', function(done) {

        const iife_file = path.resolve(__dirname, '../tmp/iife-test-1.js');

        iife.generate(['css-loader', 'localstorage', 'timing', 'dependency', 'capture', 'capture-insert'], {
            output: iife_file
        }).then(function() {

            var text = fs.readFileSync(iife_file, 'utf8');
            assert.equal(text, load_sources([
                'async-core',
                'event-emitter',
                'css-loader',
                'regex',
                'vendor',
                'dependency',
                'cache',
                'cache-css',
                'localstorage',
                'capture',
                'capture-css',
                'capture-insert',
                'timing'
            ]));

            fs.unlinkSync(iife_file);

            done();
        }).catch(done);
    });

    it('Write to output file and return stats', function(done) {

        const iife_file = path.resolve(__dirname, '../tmp/iife-test-1.js');

        iife.generate(['css-loader', 'localstorage', 'timing', 'dependency', 'capture', 'capture-insert'], {
            output: iife_file,
            output_stats: true
        }).then(function(stats) {

            var text = fs.readFileSync(iife_file, 'utf8');
            assert.equal(text, load_sources([
                'async-core',
                'event-emitter',
                'css-loader',
                'regex',
                'vendor',
                'dependency',
                'cache',
                'cache-css',
                'localstorage',
                'capture',
                'capture-css',
                'capture-insert',
                'timing'
            ]));

            assert.equal(typeof stats === 'object', true);
            assert.equal(stats.modules instanceof Array, true);
            assert.equal(typeof stats.size === 'number', true);
            assert.equal(typeof stats.gzip_size === 'number', true);

            fs.unlinkSync(iife_file);

            done();
        }).catch(done);
    });

    after(function(done) {

        // remove tmp directory
        fs.rmdirSync(path.resolve(__dirname, '../tmp/'));

        done();
    });
});

if (test_combinations) {
    describe('Test all module combinations', function() {

        var module_combinations = combine([
            'css-loader',
            'js-loader',
            'dependency', ['cache', 'localstorage', 'cache-api', 'xhr', 'cache-update'],
            ['capture', 'capture-observer', 'capture-insert'], //
            ['timing', 'responsive', 'inview'],
            'api',
            'attr-config',
            //'fallback'
        ]);

        // sort by module order
        module_combinations.forEach(function(combination, index) {
            var _combination = [];
            asynccss_pack._modules.forEach(function(mod) {
                if (combination.indexOf(mod[0]) !== -1) {
                    _combination.push(mod[0]);
                }
            });
            module_combinations[index] = _combination;
        });

        var abort;

        // load tests for module combinations
        var remove_from_name = ['event-emitter', 'vendor', 'regex', 'cache-css', 'cache-js', 'capture-css', 'capture-js'];
        module_combinations.forEach(function(combination) {
            if (abort) {
                return;
            }
            var c = combination.slice(0);
            var name = combination.slice(0);
            var remove = remove_from_name.slice(0);
            remove_from_name.forEach(function(n) {
                var index = name.indexOf(n);
                if (index !== -1) {
                    name.splice(index, 1);
                }
            });

            // test generator for auto-loading
            if (combination.indexOf('css-loader') !== -1) {
                remove.push('cache-css', 'capture-css');
            }
            if (combination.indexOf('js-loader') !== -1) {
                remove.push('cache-js', 'capture-js');
            }

            var generator_modules = combination.slice(0);
            remove.forEach(function(n) {
                var index = generator_modules.indexOf(n);
                if (index !== -1) {
                    generator_modules.splice(index, 1);
                }
            });

            it(name.join(' + '), function(done) {
                iife.generate(generator_modules).then(function(text) {

                    assert.equal(text, load_sources(['async-core'].concat(combination)));

                    done();
                }).catch(done);
            });

        });

    });
}