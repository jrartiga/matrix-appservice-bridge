/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var Request = require("./request");

/**
 * Construct a factory which can create {@link Request} objects. Useful for
 * adding "default" handlers to requests.
 * @constructor
 */
function RequestFactory() {
    this._resolves = [];
    this._rejects = [];
    this._timeouts = [];
}

/**
 * Generate a new request.
 * @param {Object=} opts The options to pass to the Request constructor, if any.
 * @return {Request} A new request object
 */
RequestFactory.prototype.newRequest = function(opts) {
    var req = new Request(opts);
    req.getPromise().then((res) => {
        this._resolves.forEach((resolveFn) => {
            resolveFn(req, res);
        });
    }).catch((err) => {
        this._rejects.forEach((rejectFn) => {
            rejectFn(req, err);
        });
    });

    this._timeouts.forEach(function(timeoutObj) {
        setTimeout(function() {
            var promise = req.getPromise();
            if (!promise.isPending()) {
                return;
            }
            timeoutObj.fn(req);
        }, timeoutObj.timeout);
    });
    return req;
}

/**
 * Add a function which will be invoked for every request that is resolved.
 * @param {Function} fn The function to invoke. The first argument will be the
 * Request object, the second will be the resolve argument.
 */
RequestFactory.prototype.addDefaultResolveCallback = function(fn) {
    this._resolves.push(fn);
};

/**
 * Add a function which will be invoked for every request that is rejected.
 * @param {Function} fn The function to invoke. The first argument will be the
 * Request object, the second will be the rejection argument.
 */
RequestFactory.prototype.addDefaultRejectCallback = function(fn) {
    this._rejects.push(fn);
};

/**
 * Add a function which will be invoked for every request that has not been
 * resolved or rejected within a certain amount of time.
 * @param {Function} fn The function to invoke. The first argument will be the
 * Request object.
 * @param {number} durationMs The number of milliseconds to wait for a
 * resolution to the request.
 */
RequestFactory.prototype.addDefaultTimeoutCallback = function(fn, durationMs) {
    this._timeouts.push({
        fn: fn,
        timeout: durationMs
    });
};

module.exports = RequestFactory;
