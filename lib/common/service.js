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
 * @module common/service
 */

'use strict';

var arrify = require('arrify');

/**
 * @type {module:common/util}
 * @private
 */
var util = require('./util.js');

/**
 * Service is a base class, meant to be inherited from by a "service," like
 * BigQuery or Storage.
 *
 * This handles making authenticated requests by exposing a `makeReq_` function.
 *
 * @param {object} config - Configuration object.
 * @param {string} config.baseUrl - The base URL to make API requests to.
 * @param {string[]} config.scopes - The scopes required for the request.
 * @param {object} options - [Configuration object](#/docs/?method=gcloud).
 */
function Service(config, options) {
  this.makeAuthenticatedRequest = util.makeAuthenticatedRequestFactory({
    scopes: config.scopes,
    credentials: options.credentials,
    keyFile: options.keyFilename,
    email: options.email
  });

  this.authClient = this.makeAuthenticatedRequest.authClient;
  this.baseUrl = config.baseUrl;
  this.getCredentials = this.makeAuthenticatedRequest.getCredentials;
  this.globalInterceptors = arrify(options.interceptors_);
  this.interceptors = [];
  this.projectId = options.projectId;
  this.projectIdRequired = config.projectIdRequired !== false;
}

/**
 * Make an authenticated API request.
 *
 * @private
 *
 * @param {object} reqOpts - Request options that are passed to `request`.
 * @param {string} reqOpts.uri - A URI relative to the baseUrl.
 * @param {function} callback - The callback function passed to `request`.
 */
Service.prototype.request = function(reqOpts, callback) {
  var uriComponents = [
    this.baseUrl
  ];

  if (this.projectIdRequired) {
    uriComponents.push('projects');
    uriComponents.push(this.projectId);
  }

  uriComponents.push(reqOpts.uri);

  reqOpts.uri = uriComponents
    .map(function(uriComponent) {
      var trimSlashesRegex = /^\/*|\/*$/g;
      return uriComponent.replace(trimSlashesRegex, '');
    })
    .join('/')
    // Some URIs have colon separators.
    // Bad: https://.../projects/:list
    // Good: https://.../projects:list
    .replace(/\/:/g, ':');

  // Interceptors should be called in the order they were assigned.
  var combinedInterceptors = [].slice.call(this.globalInterceptors)
    .concat(this.interceptors)
    .concat(arrify(reqOpts.interceptors_));

  var interceptor;

  while ((interceptor = combinedInterceptors.shift()) && interceptor.request) {
    reqOpts = interceptor.request(reqOpts);
  }

  delete reqOpts.interceptors_;

  this.makeAuthenticatedRequest(reqOpts, callback);
};

module.exports = Service;
