/* global Utilities */
// Apps Script web apps must answer synchronously, but Balaa's shared rules are written
// with async/await. The core bundle is compiled so every await goes through the global
// Promise below, which settles immediately. Nothing in the rules waits on real I/O,
// so each request still runs start to finish before doPost returns.
var SyncPromise = (function () {
  function SyncPromise(executor) {
    this.state = 'pending';
    this.value = undefined;
    this.handlers = [];
    var self = this;
    var done = false;
    function resolve(value) {
      if (done) return;
      done = true;
      adopt(self, value);
    }
    function reject(reason) {
      if (done) return;
      done = true;
      settle(self, 'rejected', reason);
    }
    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }
  function adopt(promise, value) {
    if (value === promise) return settle(promise, 'rejected', new TypeError('Promise cycle'));
    if (value && (typeof value === 'object' || typeof value === 'function')) {
      var then;
      try {
        then = value.then;
      } catch (error) {
        return settle(promise, 'rejected', error);
      }
      if (typeof then === 'function') {
        var called = false;
        try {
          then.call(
            value,
            function (v) {
              if (!called) {
                called = true;
                adopt(promise, v);
              }
            },
            function (r) {
              if (!called) {
                called = true;
                settle(promise, 'rejected', r);
              }
            },
          );
        } catch (error) {
          if (!called) settle(promise, 'rejected', error);
        }
        return;
      }
    }
    settle(promise, 'fulfilled', value);
  }
  function settle(promise, state, value) {
    if (promise.state !== 'pending') return;
    promise.state = state;
    promise.value = value;
    var handlers = promise.handlers;
    promise.handlers = [];
    for (var i = 0; i < handlers.length; i++) handlers[i]();
  }
  SyncPromise.prototype.then = function (onFulfilled, onRejected) {
    var self = this;
    return new SyncPromise(function (resolve, reject) {
      function run() {
        var callback = self.state === 'fulfilled' ? onFulfilled : onRejected;
        if (typeof callback !== 'function')
          return self.state === 'fulfilled' ? resolve(self.value) : reject(self.value);
        try {
          resolve(callback(self.value));
        } catch (error) {
          reject(error);
        }
      }
      if (self.state === 'pending') self.handlers.push(run);
      else run();
    });
  };
  SyncPromise.prototype.catch = function (onRejected) {
    return this.then(undefined, onRejected);
  };
  SyncPromise.prototype.finally = function (callback) {
    return this.then(
      function (value) {
        callback();
        return value;
      },
      function (reason) {
        callback();
        throw reason;
      },
    );
  };
  SyncPromise.resolve = function (value) {
    return value instanceof SyncPromise
      ? value
      : new SyncPromise(function (resolve) {
          resolve(value);
        });
  };
  SyncPromise.reject = function (reason) {
    return new SyncPromise(function (_, reject) {
      reject(reason);
    });
  };
  SyncPromise.all = function (items) {
    return new SyncPromise(function (resolve, reject) {
      var results = [];
      var remaining = items.length;
      if (!remaining) return resolve(results);
      items.forEach(function (item, index) {
        SyncPromise.resolve(item).then(function (value) {
          results[index] = value;
          if (--remaining === 0) resolve(results);
        }, reject);
      });
    });
  };
  /** Returns the value of an already settled promise, or throws its error. */
  SyncPromise.unwrap = function (value) {
    var promise = SyncPromise.resolve(value);
    if (promise.state === 'fulfilled') return promise.value;
    if (promise.state === 'rejected') throw promise.value;
    throw new Error('Balaa: a rule did not finish synchronously');
  };
  return SyncPromise;
})();
Promise = SyncPromise;
var crypto = {
  randomUUID: function () {
    return Utilities.getUuid();
  },
};
var process = { env: {} };
