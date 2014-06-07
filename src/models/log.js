"use strict";


var mongoose = require('mongoose');

var waigo = require('waigo'),
  schema = waigo.load('support/db/mongoose/schema');


var logSchema = schema.create({
  job: String,
  trigger: { type: mongoose.Schema.Types.ObjectId, ref: 'Trigger' },
  text: String,
  meta: { type: mongoose.Schema.Types.Mixed }
}, {
  // capped: { 
  //   /* 20MB max size, max. 1000 entries */
  //   size: 20971520, max: 1000, autoIndexId: true 
  // },
  addTimestampFields: true
});




module.exports = function(dbConn) {
  return dbConn.model('Log', logSchema);
}



