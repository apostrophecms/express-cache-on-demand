var _ = require('lodash');
var cacheOnDemand = require('cache-on-demand');
module.exports = expressCacheOnDemand;

function expressCacheOnDemand(hasher) {
  hasher = hasher || expressHasher;

  function worker(req, res, next, callback) {
    // Patch the response object so that it doesn't respond
    // directly, it builds a description of the response that
    // can be replayed by each pending res object

    var _res = { headers: {} };
    var originals = {};

    // We're the first in, we get to do the real work.
    // Patch our response object to collect data for
    // replay into many response objects

    patch(res, {
      redirect: function(url) {
        _res.redirect = url;
        return finish();
      },
      send: function(data) {
        _res.body = data;
        return finish();
      },
      end: function(raw) {
        _res.raw = raw;
        return finish();
      },
      setHeader: function(key, val) {
        _res.headers[key] = val;
      }
    });

    function finish() {
      // Folks tend to write to this one directly
      _res.statusCode = res.statusCode;
      // Undo the patching so we can replay into this
      // response object, as well as others
      restore(res);
      // Great, we're done
      return callback(_res);
    }

    // All set to continue the middleware chain
    return next();

    function patch(obj, overrides) {
      _.extend(originals, _.pick(obj, _.keys(overrides)));
      _.extend(obj, overrides);
    }

    function restore(obj) {
      _.extend(obj, originals);
    }

  }

  var codForMiddleware = cacheOnDemand(worker, hasher);

  return function(req, res, next) {
    return codForMiddleware(req, res, next, function(_res) {
      // Replay the captured response
      if (_res.statusCode) {
        res.statusCode = _res.statusCode;
      }
      _.each(_res.headers || {}, function(val, key) {
        res.setHeader(key, val);
      });
      if (_res.redirect) {
        return res.redirect(_res.redirect);
      }
      if (_res.body) {
        return res.send(_res.body);
      }
      if (_res.raw) {
        return res.end(_res.raw);
      }
      // We know about ending a request with one of
      // the above three methods. Anything else doesn't
      // make sense with this middleware

      console.log('Attempted Request URL: ' + req.url);
      throw 'cacheOnDemand.middleware does not know how to deliver this response, use the middleware only with routes that end with res.redirect, res.send or res.end';
    });
  };
}

function expressHasher(req) {
  if ((req.method !== 'GET') && (req.method !== 'HEAD')) {
    return false;
  }
  if (req.user) {
    return false;
  }
  // Examine the session
  var safe = true;
  _.each(req.session || {}, function(val, key) {
    if (key === 'cookie') {
      // The mere existence of a session cookie
      // doesn't mean we can't cache. There has
      // to actually be something in the session
      return;
    }
    if ((key === 'flash') || (key === 'passport')) {
      // These two are often empty objects, which
      // are safe to cache
      if (!_.isEmpty(val)) {
        safe = false;
        return false;
      }
    } else {
      // Other session properties must be assumed to
      // be specific to this user, with a possible
      // impact on the response, and thus mean
      // this request must not be cached
      safe = false;
      return false;
    }
  });
  return req.url;
}
