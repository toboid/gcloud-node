/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var assert = require('assert');
var extend = require('extend');
var mockery = require('mockery');
var through = require('through2');
var util = require('../../lib/common/util.js');
var uuid = require('node-uuid');

describe('streamRouter', function() {
  var streamRouter;
  var streamRouterOverrides = {};

  var UUID = uuid.v1();

  function FakeClass() {}

  before(function() {
    mockery.enable({
      useCleanCache: true,
      warnOnUnregistered: false
    });
    streamRouter = require('../../lib/common/stream-router.js');
    var streamRouterCached = extend(true, {}, streamRouter);

    Object.keys(streamRouter).forEach(function(streamRouterMethod) {
      if (typeof streamRouter[streamRouterMethod] !== 'function') {
        return;
      }

      streamRouter[streamRouterMethod] = function() {
        var args = arguments;

        if (streamRouterOverrides[streamRouterMethod]) {
          return streamRouterOverrides[streamRouterMethod].apply(this, args);
        }

        return streamRouterCached[streamRouterMethod].apply(this, args);
      };
    });
  });

  after(function() {
    mockery.deregisterAll();
    mockery.disable();
  });

  beforeEach(function() {
    FakeClass.prototype = { methodToExtend: function() { return UUID; } };
    streamRouterOverrides = {};
  });

  describe('extend', function() {
    it('should overwrite a method on a class', function() {
      var originalMethod = FakeClass.prototype.methodToExtend;
      streamRouter.extend(FakeClass, 'methodToExtend');
      var overwrittenMethod = FakeClass.prototype.methodToExtend;

      assert.notEqual(originalMethod, overwrittenMethod);
    });

    it('should accept an array or string method names', function() {
      var originalMethod = FakeClass.prototype.methodToExtend;

      FakeClass.prototype.anotherMethodToExtend = function() {};
      var anotherMethod = FakeClass.prototype.anotherMethodToExtend;

      var methodsToExtend = ['methodToExtend', 'anotherMethodToExtend'];
      streamRouter.extend(FakeClass, methodsToExtend);

      assert.notEqual(originalMethod, FakeClass.prototype.methodToExtend);
      assert.notEqual(anotherMethod, FakeClass.prototype.anotherMethodToExtend);
    });

    it('should parse the arguments', function(done) {
      streamRouterOverrides.parseArguments_ = function(args) {
        assert.deepEqual([].slice.call(args), [1, 2, 3]);
        done();
      };

      streamRouterOverrides.router_ = util.noop;

      streamRouter.extend(FakeClass, 'methodToExtend');
      FakeClass.prototype.methodToExtend(1, 2, 3);
    });

    it('should call router when the original method is called', function(done) {
      var expectedReturnValue = FakeClass.prototype.methodToExtend();
      var parsedArguments = { a: 'b', c: 'd' };

      streamRouterOverrides.parseArguments_ = function() {
        return parsedArguments;
      };

      streamRouterOverrides.router_ = function(args, originalMethod) {
        assert.strictEqual(args, parsedArguments);
        assert.equal(originalMethod(), expectedReturnValue);
        done();
      };

      streamRouter.extend(FakeClass, 'methodToExtend');
      FakeClass.prototype.methodToExtend();
    });

    it('should maintain `this` context', function(done) {
      FakeClass.prototype.methodToExtend = function() { return this.uuid; };

      var cls = new FakeClass();
      cls.uuid = uuid.v1();

      streamRouterOverrides.router_ = function(args, originalMethod) {
        assert.equal(originalMethod(), cls.uuid);
        done();
      };

      streamRouter.extend(FakeClass, 'methodToExtend');
      cls.methodToExtend();
    });

    it('should return what the router returns', function() {
      var uniqueValue = 234;
      streamRouterOverrides.router_ = function() {
        return uniqueValue;
      };

      streamRouter.extend(FakeClass, 'methodToExtend');
      assert.equal(FakeClass.prototype.methodToExtend(), uniqueValue);
    });
  });

  describe('parseArguments_', function() {
    it('should set defaults', function() {
      var parsedArguments = streamRouter.parseArguments_([]);

      assert.strictEqual(Object.keys(parsedArguments.query).length, 0);
      assert.strictEqual(parsedArguments.callback, undefined);
      assert.strictEqual(parsedArguments.maxResults, -1);
      assert.strictEqual(parsedArguments.autoPaginate, true);
    });

    it('should detect a callback if first argument is a function', function() {
      var args = [ util.noop ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.callback, args[0]);
    });

    it('should use any other first argument as query', function() {
      var args = [ 'string' ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.query, args[0]);
    });

    it('should not make an undefined value the query', function() {
      var args = [ undefined, util.noop ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.deepEqual(parsedArguments.query, {});
    });

    it('should detect a callback if last argument is a function', function() {
      var args = [ 'string', util.noop ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.callback, args[1]);
    });

    it('should not assign a callback if a fn is not provided', function() {
      var args = [ 'string' ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.callback, undefined);
    });

    it('should set maxResults from query.maxResults', function() {
      var args = [ { maxResults: 10 } ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.maxResults, args[0].maxResults);
    });

    it('should set maxResults from query.limitVal', function() {
      var args = [ { limitVal: 10 } ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.maxResults, args[0].limitVal);
    });

    it('should set maxResults from query.pageSize', function() {
      var args = [ { pageSize: 10 } ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.maxResults, args[0].pageSize);
    });

    it('should set autoPaginate: false if there is a maxResults', function() {
      var args = [ { maxResults: 10 }, util.noop ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.autoPaginate, false);
    });

    it('should set autoPaginate: false query.autoPaginate', function() {
      var args = [ { autoPaginate: false }, util.noop ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.autoPaginate, false);
    });

    it('should set autoPaginate: false with query.autoPaginateVal', function() {
      var args = [ { autoPaginateVal: false }, util.noop ];
      var parsedArguments = streamRouter.parseArguments_(args);

      assert.strictEqual(parsedArguments.autoPaginate, false);
    });
  });

  describe('router_', function() {
    beforeEach(function() {
      streamRouterOverrides.runAsStream_ = util.noop;
    });

    describe('callback mode', function() {
      describe('autoPaginate', function() {
        it('should call runAsStream_ when autoPaginate:true', function(done) {
          var parsedArguments = {
            autoPaginate: true,
            callback: util.noop
          };

          streamRouterOverrides.runAsStream_ = function(args, originalMethod) {
            assert.strictEqual(args, parsedArguments);
            originalMethod();
            return through();
          };

          streamRouter.router_(parsedArguments, done);
        });

        it('should execute callback on error', function(done) {
          var error = new Error('Error.');

          var parsedArguments = {
            autoPaginate: true,
            callback: function(err) {
              assert.strictEqual(err, error);
              done();
            }
          };

          streamRouterOverrides.runAsStream_ = function() {
            var stream = through();
            setImmediate(function() {
              stream.emit('error', error);
            });
            return stream;
          };

          streamRouter.router_(parsedArguments, util.noop);
        });

        it('should return all results on end', function(done) {
          var results = ['a', 'b', 'c'];

          var parsedArguments = {
            autoPaginate: true,
            callback: function(err, results_) {
              assert.deepEqual(results_.toString().split(''), results);
              done();
            }
          };

          streamRouterOverrides.runAsStream_ = function() {
            var stream = through();

            setImmediate(function() {
              results.forEach(function(result) {
                stream.push(result);
              });

              stream.push(null);
            });

            return stream;
          };

          streamRouter.router_(parsedArguments, util.noop);
        });
      });

      describe('manual pagination', function() {
        it('should recoginze autoPaginate: false', function(done) {
          var parsedArguments = {
            autoPaginate: false,
            query: {
              a: 'b',
              c: 'd'
            },
            callback: done
          };

          streamRouter.router_(parsedArguments, function(query, callback) {
            assert.deepEqual(query, parsedArguments.query);

            callback();
          });
        });
      });
    });

    describe('stream mode', function() {
      it('should call runAsStream_', function(done) {
        var parsedArguments = {
          query: { a: 'b', c: 'd' }
        };

        streamRouterOverrides.runAsStream_ = function(args, originalMethod) {
          assert.deepEqual(args, parsedArguments);
          originalMethod();
        };

        streamRouter.router_(parsedArguments, done);
      });

      it('should return the value of runAsStream_', function() {
        var parsedArguments = {
          query: { a: 'b', c: 'd' }
        };

        var stream = through();

        streamRouterOverrides.runAsStream_ = function() {
          return stream;
        };

        var stream_ = streamRouter.router_(parsedArguments, assert.ifError);
        assert.strictEqual(stream_, stream);
      });
    });
  });

  describe('runAsStream_', function() {
    describe('stream mode', function() {
      var PARSED_ARGUMENTS = {
        query: {
          a: 'b', c: 'd'
        }
      };

      it('should call original method when stream opens', function(done) {
        function originalMethod(query) {
          assert.strictEqual(query, PARSED_ARGUMENTS.query);
          done();
        }

        var rs = streamRouter.runAsStream_(PARSED_ARGUMENTS, originalMethod);
        rs.on('data', util.noop); // Trigger the underlying `_read` event.
      });

      it('should emit an error if one occurs', function(done) {
        var error = new Error('Error.');

        function originalMethod(query, callback) {
          setImmediate(function() {
            callback(error);
          });
        }

        var rs = streamRouter.runAsStream_(PARSED_ARGUMENTS, originalMethod);
        rs.on('data', util.noop); // Trigger the underlying `_read` event.
        rs.on('error', function(err) {
          assert.deepEqual(err, error);
          done();
        });
      });

      it('should push results onto the stream', function(done) {
        var results = ['a', 'b', 'c'];
        var resultsReceived = [];

        function originalMethod(query, callback) {
          setImmediate(function() {
            callback(null, results);
          });
        }

        var rs = streamRouter.runAsStream_(PARSED_ARGUMENTS, originalMethod);
        rs.on('data', function(result) {
          resultsReceived.push(result);
        });
        rs.on('end', function() {
          assert.deepEqual(resultsReceived, ['a', 'b', 'c']);
          done();
        });
      });

      describe('limits', function() {
        var limit = 1;

        function originalMethod(query, callback) {
          setImmediate(function() {
            callback(null, [1, 2, 3]);
          });
        }

        it('should respect maxResults', function(done) {
          var numResultsReceived = 0;

          streamRouter.runAsStream_({ maxResults: limit }, originalMethod)
            .on('data', function() { numResultsReceived++; })
            .on('end', function() {
              assert.strictEqual(numResultsReceived, limit);
              done();
            });
        });
      });

      it('should get more results if nextQuery exists', function(done) {
        var nextQuery = { a: 'b', c: 'd' };
        var nextQuerySent = false;

        function originalMethod(query, callback) {
          if (nextQuerySent) {
            assert.deepEqual(query, nextQuery);
            done();
            return;
          }

          setImmediate(function() {
            nextQuerySent = true;
            callback(null, [], nextQuery);
          });
        }

        var rs = streamRouter.runAsStream_(PARSED_ARGUMENTS, originalMethod);
        rs.on('data', util.noop); // Trigger the underlying `_read` event.
      });

      it('should not push more results if stream ends early', function(done) {
        var results = ['a', 'b', 'c'];

        function originalMethod(query, callback) {
          setImmediate(function() {
            callback(null, results);
          });
        }

        var rs = streamRouter.runAsStream_(PARSED_ARGUMENTS, originalMethod);
        rs.on('data', function(result) {
          if (result === 'b') {
            // Pre-maturely end the stream.
            this.end();
          }

          assert.notEqual(result, 'c');
        });
        rs.on('end', function() {
          done();
        });
      });

      it('should not get more results if stream ends early', function(done) {
        var results = ['a', 'b', 'c'];

        var originalMethodCalledCount = 0;

        function originalMethod(query, callback) {
          originalMethodCalledCount++;

          setImmediate(function() {
            callback(null, results, {});
          });
        }

        var rs = streamRouter.runAsStream_(PARSED_ARGUMENTS, originalMethod);
        rs.on('data', function(result) {
          if (result === 'b') {
            // Pre-maturely end the stream.
            this.end();
          }
        });
        rs.on('end', function() {
          assert.equal(originalMethodCalledCount, 1);
          done();
        });
      });
    });
  });
});
