'use strict';

var respond = require('quinn-respond');
var Bluebird = require('bluebird');

function toExpress(handler) {
  return function(req, res, next) {
    Bluebird.try(handler, [ req, req.params || {} ])
      .then(function(result) {
        if (result === undefined) {
          return next();
        }
        respond(result).pipe(res);
      })
      .catch(function(error) {
        next(error);
      });
  };
}

module.exports = toExpress;
