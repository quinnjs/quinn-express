'use strict';

var http = require('http');

var assert = require('assertive');
var express = require('express');
var Bluebird = require('bluebird');
var respond = require('quinn-respond');
var concat = require('concat-stream');
var _ = require('lodash');

var toExpress = require('../');

describe('quinn-express', function() {
  it('is a function', function() {
    assert.hasType(Function, toExpress);
  });

  describe('in an express app', function() {
    var baseUrl, server;

    // e.g. quinn-controller's action function
    function returnsHandler(value) {
      return function() {
        return respond.json(value);
      };
    }
    var wrappedJSON = _.compose(toExpress, returnsHandler);

    function load(urlPath) {
      var url = baseUrl + urlPath;
      return new Bluebird(function(resolve, reject) {
        var req = http.get(url, function(res) {
          res.setEncoding('utf8');
          res.pipe(concat(function(body) {
            res.body = body;
            resolve(res);
          }));
        });
        req.on('error', reject);
      });
    }

    before(function(done) {
      var app = express();

      app.use(toExpress(function(req, params) {
        if (req.query.x) {
          return respond.json({ x: parseInt(req.query.x, 10) });
        }
      }));

      app.get('/param/:id', toExpress(function(req, params) {
        return respond.text(params.id);
      }));

      app.get('/throws', toExpress(function(req, params) {
        return Bluebird.delay(20).then(function() {
          throw new Error('Forced error');
        });
      }));

      app.get('/wrapped', wrappedJSON('ok'));

      app.use(function(err, req, res, next) {
        res.end('Error page: ' + err.message);
      });

      server = http.createServer(app);
      server.listen(0, function() {
        baseUrl = 'http://127.0.0.1:' + this.address().port;
        done();
      });
    });

    after(function(done) {
      if (server && server._handle) { server.close(done); }
      else { done(); }
    });

    it('listens', function(done) {
      load('/').nodeify(done);
    });

    it('is intercepted by the middleware', function(done) {
      load('/?x=25')
        .then(function(res) {
          assert.deepEqual({ x: 25 }, JSON.parse(res.body));
        }).nodeify(done);
    });

    it('defaults to express params', function(done) {
      load('/param/foo')
        .then(function(res) {
          assert.equal('foo', res.body);
        }).nodeify(done);
    });

    it('uses normal express error middleware', function(done) {
      load('/throws')
        .then(function(res) {
          assert.equal('Error page: Forced error', res.body);
        }).nodeify(done);
    });

    it('can be composed with other functions', function(done) {
      load('/wrapped')
        .then(function(res) {
          assert.equal('"ok"', res.body);
        }).nodeify(done);
    });
  });
});
