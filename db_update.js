var sqlite = require('spatialite'),
	request = require('request'),
	fs = require('fs')

var config = require('./config.json')

var datasets = process.env.data ? JSON.parse(process.env.data) : Object.keys(config.data),
	db = new sqlite.Database(config.db_name)

initData(0)

function initData(index) {
	if (index >= datasets.length)
		return

	var set = config.data[datasets[index]]

	if (set.url) {
		request(set.url, function(err, resp, data) {
			if (err) throw err
			initTable(index, set, JSON.parse(data))
		})
	} else {
		fs.readFile(config.data_dir + set.path, set.encoding || 'utf8', function(err, data) {
			if (err) throw err
			initTable(index, set, JSON.parse(data))
		})
	}
}

function initTable(index, set, data) {
	var set_name = datasets[index]
	console.log(set_name)

	// table structure (autodetect if undefined)
	var structure = {}
	if (set.structure) {
		structure = set.structure
	} else {
		Object.keys(data.features[0].properties).forEach(function(key) {
			var type = typeof data.features[0].properties[key]
			if (type == "string")
				structure[key] = "TEXT"
			else if (type == "string")
				structure[key] = "FLOAT"
			else if (type == "string")
				structure[key] = "BOOL"
		})
	}

	var query_createTable = ""
	Object.keys(structure).forEach(function(key) {
		if (query_createTable)
			query_createTable += ", "
		query_createTable += "'" + key + "' " + structure[key]
	})
	query_createTable += ", '_where_geom' TEXT"
	query_createTable = "CREATE TABLE " + set_name + "(" + query_createTable + ")"

	// console.log(query_createTable)

	var columns = ""
	var values = ""
	Object.keys(structure).forEach(function(key) {
		if (columns) {
			columns += ", "
			values += ","
		}

		columns += "'" + key + "'"
		values += "?"
	})
	var query_prep = "INSERT INTO " + set_name + " (" + columns + ", _where_geom) VALUES (" + values + ",?)"

	db.serialize(function(err) {
		db.run("begin transaction")
		if (err) throw err
		db.spatialite(function(err) {
			if (err) throw err
			db.run("SELECT DiscardGeometryColumn('" + set_name + "', '_where_coord')", function(err) { // logs errors if table doesn't exit, still works though...
				if (err) throw err
				db.run("DROP TABLE IF EXISTS " + set_name, function() {
					if (err) throw err
					db.run(query_createTable, function() {
						if (err) throw err
						db.run("SELECT AddGeometryColumn('" + set_name + "', '_where_coord', 4326, 'GEOMETRY', 'XY')", function(err) {
							if (err) throw err
							var prep = db.prepare(query_prep)

							data.features.forEach(function(feature, index) {

								var values = []
								Object.keys(structure).forEach(function(key) {
									values.push(feature.properties[key])
								})
								values.push(geoJsonToWkt(feature.geometry))
								prep.bind(values)
								prep.run(function(err) {
									if(err) throw err
								})
							})
							prep.finalize(function() {
								console.log("DB updated at " + new Date().getTime())
							})
						})
					})
				})
			})
		})
		db.run("commit", function(err) {
			if (err) throw err
			db.spatialite(function(err) {
				if (err) throw err
				db.run("UPDATE " + set_name + " SET '_where_coord' = GeomFromText(" + set_name + "._where_geom, 4326)", function(err) {
					if (err) throw err
					initData(index + 1)
				})
			})

		})
	})
}

function geoJsonToWkt(geojson) {
	if (geojson.type == "Point")
		return "POINT(" + geojson.coordinates[0] + " " + geojson.coordinates[1] + ")"
	return "NULL"
}