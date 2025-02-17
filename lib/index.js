/*!
 * Copyright 2014 Google Inc. All Rights Reserved.
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
 * @module gcloud
 */

'use strict';

var extend = require('extend');

/**
 * The APIs exposed to the user.
 *
 * @type {object}
 * @private
 */
var apis = {
  /**
   * Analyze Big Data in the cloud with
   * [Google BigQuery](https://cloud.google.com/bigquery). Run fast, SQL-like
   * queries against multi-terabyte datasets in seconds. Scalable and easy to
   * use, BigQuery gives you real-time insights about your data.
   *
   * @type {module:bigquery}
   *
   * @return {module:bigquery}
   *
   * @example
   * var gcloud = require('gcloud');
   * var bigquery = gcloud.bigquery({
   *   projectId: 'grape-spaceship-123',
   *   keyFilename: '/path/to/keyfile.json'
   * });
   */
  bigquery: require('./bigquery'),

  /**
   * With [Compute Engine](https://cloud.google.com/compute/), you can run
   * large-scale workloads on virtual machines hosted on Google's
   * infrastructure. Choose a VM that fits your needs and gain the performance
   * of Google’s worldwide fiber network.
   *
   * @type {module:compute}
   *
   * @return {module:compute}
   *
   * @example
   * var gcloud = require('gcloud');
   * var gce = gcloud.compute({
   *   projectId: 'grape-spaceship-123',
   *   keyFilename: '/path/to/keyfile.json'
   * });
   */
  compute: require('./compute'),

  /**
   * [Google Cloud Datastore](https://developers.google.com/datastore/) is a
   * fully managed, schemaless database for storing non-relational data. Use
   * this object to create a Dataset to interact with your data, an "Int", and a
   * "Double" representation.
   *
   * @type {module:datastore}
   *
   * @return {module:datastore}
   *
   * @example
   * var gcloud = require('gcloud');
   * var datastore = gcloud.datastore;
   * var dataset = datastore.dataset({
   *   projectId: 'grape-spaceship-123',
   *   keyFilename: '/path/to/keyfile.json'
   * });
   */
  datastore: require('./datastore'),

  /**
   * [Google Cloud DNS](https://cloud.google.com/dns/what-is-cloud-dns) is a
   * high-performance, resilient, global DNS service that provides a cost-
   * effective way to make your applications and services available to your
   * users. This programmable, authoritative DNS service can be used to easily
   * publish and manage DNS records using the same infrastructure relied upon by
   * Google.
   *
   * @type {module:dns}
   *
   * @return {module:dns}
   *
   * @example
   * var gcloud = require('gcloud');
   * var dns = gcloud.dns({
   *   projectId: 'grape-spaceship-123',
   *   keyFilename: '/path/to/keyfile.json'
   * });
   */
  dns: require('./dns'),

  /**
   * [Google Cloud Pub/Sub](https://developers.google.com/pubsub/overview) is a
   * reliable, many-to-many, asynchronous messaging service from Google Cloud
   * Platform.
   *
   * @type {module:pubsub}
   *
   * @return {module:pubsub}
   *
   * @example
   * var gcloud = require('gcloud');
   * var pubsub = gcloud.pubsub({
   *   projectId: 'grape-spaceship-123',
   *   keyFilename: '/path/to/keyfile.json'
   * });
   */
  pubsub: require('./pubsub'),

  /**
   * [The Cloud Resource Manager](https://cloud.google.com/resource-manager/)
   * provides methods that you can use to programmatically manage your projects
   * in the Google Cloud Platform. With this API, you can do the following:
   *
   *   - Get a list of all projects associated with an account.
   *   - Create new projects.
   *   - Update existing projects.
   *   - Delete projects.
   *   - Recover projects.
   *
   * <p class="notice">
   *   **This is a *Beta* release of Cloud Resource Manager.** This feature is
   *   not covered by any SLA or deprecation policy and may be subject to
   *   backward-incompatible changes.
   * </p>
   *
   * @type {module:resource}
   *
   * @return {module:resource}
   *
   * @example
   * var gcloud = require('gcloud');
   * var resource = gcloud.resource({
   *   projectId: 'grape-spaceship-123',
   *   keyFilename: '/path/to/keyfile.json'
   * });
   */
  resource: require('./resource'),

  /**
   * [Google Cloud Search](https://cloud.google.com/search/) allows you to
   * quickly perform full-text and geospatial searches against your data without
   * having to spin up your own instances and without the hassle of managing and
   * maintaining a search service.
   *
   * <p class="notice">
   *   **This is an *Alpha* release of Google Cloud Search.** This feature is
   *   not covered by any SLA or deprecation policy and may be subject to
   *   backward-incompatible changes.
   * </p>
   *
   * @type {module:search}
   *
   * @return {module:search}
   *
   * @example
   * var gcloud = require('gcloud');
   * var search = gcloud.search({
   *   projectId: 'grape-spaceship-123',
   *   keyFilename: '/path/to/keyfile.json'
   * });
   */
  search: require('./search'),

  /**
   * Google Cloud Storage allows you to store data on Google infrastructure.
   * Read [Google Cloud Storage API docs](https://developers.google.com/storage)
   * for more information.
   *
   * @type {module:storage}
   *
   * @return {module:storage}
   *
   * @example
   * var gcloud = require('gcloud');
   * var gcs = gcloud.storage({
   *   projectId: 'grape-spaceship-123',
   *   keyFilename: '/path/to/keyfile.json'
   * });
   */
  storage: require('./storage')
};

/**
 * Scoped APIs are "boxed in" APIs. The "outer" class (e.g. Datastore) is a
 * container for sub-classes that can be given separate authentication and
 * instantiation options.
 *
 * @type {object}
 * @private
 */
var scopedApis = {
  datastore: true
};

/*! Developer Documentation
 *
 * Previously we used gcloud to expose an object filled with factory patterns,
 * this allowed us to easily cascade global configurations to the individual
 * apis by storing them in a closure.
 *
 * The issue with the factory pattern approach was that we had to extend the
 * factory functions to expose any static members of the api class. Instead we
 * now store global configurations as a "private" member of the returned api
 * object as `config_`.
 *
 * Since our api constructors actually double up as factory patterns already,
 * we can determine when a particular api is being created and extend the
 * global configurations at that time.
 */
/**
 * There are two key ways to use the `gcloud` module.
 *
 * 1. Provide connection & configuration details up-front.
 *
 * 2. Provide them at the time of instantiation of sub-modules, e.g. a Datastore
 * dataset, a Cloud Storage bucket, etc.
 *
 * See our [Authentication Guide](#/authentication) for how to obtain the
 * necessary credentials for connecting to your project.
 *
 * ### Advanced Usage
 *
 * #### Interceptors
 *
 * All of the returned modules hold a special `interceptors` array you can use
 * to have control over the flow of the internal operations of this library. As
 * of now, we support a request interceptor, allowing you to tweak all of the
 * API request options before the HTTP request is sent.
 *
 * See the example below for more.
 *
 * @alias module:gcloud
 * @constructor
 *
 * @param {object} config - Connection configuration options.
 * @param {string} config.projectId - The project ID from the Google Developer's
 *     Console. E.g. 'purple-grape-123'.
 * @param {string=} config.keyFilename - Full path to the a .json, .pem, or .p12
 *     key downloaded from the Google Developers Console. NOTE: .pem and .p12
 *     require you to specify `config.email` as well.
 * @param {string=} config.email - Account email address. Required when using a
 *     .pem or .p12 keyFilename.
 * @param {object=} config.credentials - Credentials object.
 * @param {string} config.credentials.client_email
 * @param {string} config.credentials.private_key
 * @param {boolean=} config.autoRetry - Automatically retry requests if the
 *     response is related to rate limits or certain intermittent server errors.
 *     We will exponentially backoff subsequent requests by default. (default:
 *     true)
 * @param {number=} config.maxRetries - Maximum number of automatic retries
 *     attempted before returning the error. (default: 3)
 *
 * @example
 * var gcloud = require('gcloud')({
 *   projectId: 'grape-spaceship-123',
 *   keyFilename: '/path/to/keyfile.json'
 * });
 *
 * //-
 * // From the same authentication credentials, you may now access your Google
 * // Cloud Storage buckets, for example.
 * //-
 * var gcs = gcloud.storage();
 * var bucket = gcs.bucket('photos');
 *
 * //-
 * // However, if you need to override the global credentials, you may provide
 * // new ones.
 * //-
 * var otherGcs = gcloud.storage({
 *   keyFilename: '/path/to/other/keyfile.json'
 * });
 * var otherBucket = otherGcs.bucket('other-photos');
 *
 * //-
 * // `gcs` and `otherGcs` will use their respective credentials for all future
 * // API requests.
 * //
 * // <h4>Interceptors</h4>
 * //
 * // Use a `request` interceptor to set a custom HTTP header on your requests.
 * //-
 * gcloud.interceptors.push({
 *   request: function(requestOptions) {
 *     requestOptions.headers = requestOptions.headers || {};
 *     requestOptions.headers['X-Cloud-Trace-Context'] = 'I will be overridden';
 *     return requestOptions;
 *   }
 * });
 *
 * //-
 * // You can also set an interceptor on the service level, like a Storage
 * // object.
 * //-
 * gcs.interceptors.push({
 *   request: function(requestOptions) {
 *     requestOptions.headers = requestOptions.headers || {};
 *     requestOptions.headers['X-Cloud-Trace-Context'] = 'I will be overridden';
 *     return requestOptions;
 *   }
 * });
 *
 * //-
 * // Additionally, set one on the service object level, such as a Bucket.
 * //-
 * bucket.interceptors.push({
 *   request: function(requestOptions) {
 *     requestOptions.headers = requestOptions.headers || {};
 *     requestOptions.headers['X-Cloud-Trace-Context'] = 'I win!';
 *     return requestOptions;
 *   }
 * });
 *
 * //-
 * // The following request will combine all of the headers, executed in the
 * // order from when they were assigned, respecting the hierarchy:
 * // global before service before service object.
 * //-
 * bucket.getMetadata(function() {
 *   // This HTTP request was sent with the 'I win!' header specified above.
 * });
 */
function gcloud(config) {
  config = extend(true, { interceptors_: [] }, config);

  var gcloudExposedApi = {
    config_: config,
    interceptors: config.interceptors_
  };

  return Object.keys(apis).reduce(function(gcloudExposedApi, apiName) {
    var Class = apis[apiName];

    if (scopedApis[apiName]) {
      gcloudExposedApi[apiName] = new Class(config);
    } else {
      gcloudExposedApi[apiName] = Class;
    }

    return gcloudExposedApi;
  }, gcloudExposedApi);
}

module.exports = extend(gcloud, apis);
