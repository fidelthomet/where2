var sqlite = require('spatialite')
var fs = require("fs")

var config = require('./config.json')

fs.unlink(config.db_name, function(){
	var db = new sqlite.Database(config.db_name)
	
	db.spatialite(function(err) {
		db.run("SELECT InitSpatialMetaData()", function() {

		})
	})
})