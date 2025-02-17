/*!
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

/*!
 * @module common/serviceObject
 */

'use strict';

var exec = require('methmeth');
var extend = require('extend');
var is = require('is');

/**
 * @type {module:common/util}
 * @private
 */
var util = require('./util.js');

/**
 * ServiceObject is a base class, meant to be inherited from by a "service
 * object," like a BigQuery dataset or Storage bucket.
 *
 * Most of the time, these objects share common functionality; they can be
 * created or deleted, and you can get or set their metadata.
 *
 * By inheriting from this class, a service object will be extended with these
 * shared behaviors. Note that any method can be overridden when the service
 * object requires specific behavior.
 *
 * @private
 *
 * @param {object} config - Configuration object.
 * @param {string} config.baseUrl - The base URL to make API requests to.
 * @param {string} config.createMethod - The method which creates this object.
 * @param {string} config.id - The identifier of the object. For example, the
 *     name of a Storage bucket or Pub/Sub topic.
 * @param {object=} config.methods - A map of each method name that should be
 *     inherited.
 * @param {object} config.methods[].reqOpts - Default request options for this
 *     particular method. A common use case is when `setMetadata` requires a
 *     `PUT` method to override the default `PATCH`.
 * @param {object} config.parent - The parent service instance. For example, an
 *     instance of Storage if the object is Bucket.
 */
function ServiceObject(config) {
  var self = this;

  this.metadata = {};

  this.baseUrl = config.baseUrl;
  this.parent = config.parent; // Parent class.
  this.id = config.id; // Name or ID (e.g. dataset ID, bucket name, etc.)
  this.createMethod = config.createMethod;
  this.methods = config.methods || {};
  this.interceptors = [];

  if (config.methods) {
    var allMethodNames = Object.keys(ServiceObject.prototype);
    allMethodNames
      .filter(function(methodName) {
        return (
          // All ServiceObjects need `request`.
          methodName !== 'request' &&

          // The ServiceObject didn't redefine the method.
          self[methodName] === ServiceObject.prototype[methodName] &&

          // This method isn't wanted.
          !config.methods[methodName]
        );
      })
      .forEach(function(methodName) {
        self[methodName] = undefined;
      });
  }
}

/**
 * Create the object.
 *
 * @param {object=} options - Configuration object.
 * @param {function} callback - The callback function.
 * @param {?error} callback.err - An error returned while making this request.
 * @param {object} callback.instance - The instance.
 * @param {object} callback.apiResponse - The full API response.
 */
ServiceObject.prototype.create = function(options, callback) {
  var self = this;
  var args = [this.id];

  if (is.fn(options)) {
    callback = options;
  }

  if (is.object(options)) {
    args.push(options);
  }

  // Wrap the callback to return *this* instance of the object, not the newly-
  // created one.
  function onCreate(err, instance) {
    var args = [].slice.call(arguments);

    if (!err) {
      self.metadata = instance.metadata;
      args[1] = self; // replace the created `instance` with this one.
    }

    callback.apply(null, args);
  }

  args.push(onCreate);

  this.createMethod.apply(null, args);
};

/**
 * Delete the object.
 *
 * @param {function=} callback - The callback function.
 * @param {?error} callback.err - An error returned while making this request.
 * @param {object} callback.apiResponse - The full API response.
 */
ServiceObject.prototype.delete = function(callback) {
  var methodConfig = this.methods.delete || {};

  var reqOpts = extend({
    method: 'DELETE',
    uri: ''
  }, methodConfig.reqOpts);

  callback = callback || util.noop;

  // The `request` method may have been overridden to hold any special behavior.
  // Ensure we call the original `request` method.
  ServiceObject.prototype.request.call(this, reqOpts, function(err, resp) {
    callback(err, resp);
  });
};

/**
 * Check if the object exists.
 *
 * @param {function} callback - The callback function.
 * @param {?error} callback.err - An error returned while making this request.
 * @param {boolean} callback.exists - Whether the object exists or not.
 */
ServiceObject.prototype.exists = function(callback) {
  this.get(function(err) {
    if (err) {
      if (err.code === 404) {
        callback(null, false);
      } else {
        callback(err);
      }

      return;
    }

    callback(null, true);
  });
};

/**
 * Get the object if it exists. Optionally have the object created if an options
 * object is provided with `autoCreate: true`.
 *
 * @param {object=} config - The configuration object that will be used to
 *     create the object if necessary.
 * @param {boolean} config.autoCreate - Create the object if it doesn't already
 *     exist.
 * @param {function} callback - The callback function.
 * @param {?error} callback.err - An error returned while making this request.
 * @param {object} callback.instance - The instance.
 * @param {object} callback.apiResponse - The full API response.
 */
ServiceObject.prototype.get = function(config, callback) {
  var self = this;

  if (is.fn(config)) {
    callback = config;
    config = {};
  }

  config = config || {};

  var autoCreate = config.autoCreate && is.fn(this.create);
  delete config.autoCreate;

  this.getMetadata(function(err, metadata) {
    if (err) {
      if (err.code === 404 && autoCreate) {
        var args = [callback];

        if (!is.empty(config)) {
          args.unshift(config);
        }

        self.create.apply(self, args);
        return;
      }

      callback(err, null, metadata);
      return;
    }

    callback(null, self, metadata);
  });
};

/**
 * Get the metadata of this object.
 *
 * @param {function} callback - The callback function.
 * @param {?error} callback.err - An error returned while making this request.
 * @param {object} callback.metadata - The metadata for this object.
 * @param {object} callback.apiResponse - The full API response.
 */
ServiceObject.prototype.getMetadata = function(callback) {
  var self = this;

  var methodConfig = this.methods.getMetadata || {};

  var reqOpts = extend({
    uri: ''
  }, methodConfig.reqOpts);

  // The `request` method may have been overridden to hold any special behavior.
  // Ensure we call the original `request` method.
  ServiceObject.prototype.request.call(this, reqOpts, function(err, resp) {
    if (err) {
      callback(err, null, resp);
      return;
    }

    self.metadata = resp;

    callback(null, self.metadata, resp);
  });
};

/**
 * Set the metadata for this object.
 *
 * @param {object} metadata - The metadata to set on this object.
 * @param {function=} callback - The callback function.
 * @param {?error} callback.err - An error returned while making this request.
 * @param {object} callback.instance - The instance.
 * @param {object} callback.apiResponse - The full API response.
 */
ServiceObject.prototype.setMetadata = function(metadata, callback) {
  var self = this;

  callback = callback || util.noop;

  var methodConfig = this.methods.setMetadata || {};

  var reqOpts = extend(true, {
    method: 'PATCH',
    uri: '',
    json: metadata
  }, methodConfig.reqOpts);

  // The `request` method may have been overridden to hold any special behavior.
  // Ensure we call the original `request` method.
  ServiceObject.prototype.request.call(this, reqOpts, function(err, resp) {
    if (err) {
      callback(err, resp);
      return;
    }

    self.metadata = resp;

    callback(null, resp);
  });
};

/**
 * Make an authenticated API request.
 *
 * @private
 *
 * @param {object} reqOpts - Request options that are passed to `request`.
 * @param {string} reqOpts.uri - A URI relative to the baseUrl.
 * @param {function} callback - The callback function passed to `request`.
 */
ServiceObject.prototype.request = function(reqOpts, callback) {
  var uriComponents = [
    this.baseUrl,
    this.id,
    reqOpts.uri
  ];

  reqOpts.uri = uriComponents
    .filter(exec('trim')) // Limit to non-empty strings.
    .map(function(uriComponent) {
      var trimSlashesRegex = /^\/*|\/*$/g;
      return uriComponent.replace(trimSlashesRegex, '');
    })
    .join('/');

  reqOpts.interceptors_ = [].slice.call(this.interceptors);

  this.parent.request(reqOpts, callback);
};

module.exports = ServiceObject;
