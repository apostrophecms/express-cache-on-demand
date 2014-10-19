var assert = require("assert");
var request = require('request');
var app = require('express')();
var expressCacheOnDemand = require('../index.js')();

var workCount = 0;
app.get('/welcome', expressCacheOnDemand, function(req, res) {
  // Simulate time-consuming async work
  setTimeout(function() {
    workCount++;
    return res.send('URL was: ' + req.url + ', work count is: ' + workCount);
  }, 100);
});

app.listen(9765);

describe('expressCacheOnDemand', function() {
  it('replies to simultaneous requests with the same response', function(done) {
    var i;
    var count = 0;
    for (i = 0; (i < 5); i++) {
      attempt(i);
    }
    function attempt(i) {
      request('http://localhost:9765/welcome', function(err, response, body) {
        assert(!err);
        assert(response.statusCode === 200);
        assert(body === 'URL was: /welcome, work count is: 1');
        count++;
        if (count === 5) {
          done();
        }
      });
    }
  });
  it('replies to a subsequent request with a separate response', function(done) {
    request('http://localhost:9765/welcome', function(err, response, body) {
      assert(!err);
      assert(response.statusCode === 200);
      assert(body === 'URL was: /welcome, work count is: 2');
      done();
    });
  });
  it('replies to separate URLs with separate responses', function(done) {
    var i;
    var count = 0;
    for (i = 0; (i < 5); i++) {
      attempt(i);
    }
    function attempt(i) {
      request('http://localhost:9765/welcome?' + i, function(err, response, body) {
        assert(!err);
        assert(response.statusCode === 200);
        count++;
        if (count === 5) {
          assert(workCount === 7);
          done();
        }
      });
    }
  });
});

