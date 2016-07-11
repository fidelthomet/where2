var sqlite = require('spatialite'),
	request = require('request'),
	fs = require('fs')

var opt = JSON.parse(process.argv[2])

var db = new sqlite.Database(opt.db_name)

if (opt.dataset.url) {
	request(opt.dataset.url, (err, resp, data) => {
		if (err) throw err
		initTable(JSON.parse(data))
	})
} else {
	fs.readFile(opt.data_dir + opt.dataset.path, opt.dataset.encoding || 'utf8', (err, data) => {
		if (err) throw err
		initTable(JSON.parse(data))
	})
}

function initTable(data) {
	var schema = {}
	if (opt.dataset.schema) {
		Object.keys(opt.dataset.schema).forEach(key => {
			schema[key] = {type: opt.dataset.schema[key], example: data.features[0].properties[key]}
		})
	} else {
		Object.keys(data.features[0].properties).forEach(key => {
			switch (typeof data.features[0].properties[key]) {
				case "string":
					schema[key] = {type: "TEXT", example: data.features[0].properties[key]}
					break
				case "number":
					schema[key] = {type: "FLOAT", example: data.features[0].properties[key]}
					break
				case "boolean":
					schema[key] = {type: "BOOL", example: data.features[0].properties[key]}
					break
			}
		})
	}

	db.serialize(err => {
		db.run("begin transaction")
		if (err) throw err
		db.spatialite(err => {
			if (err) throw err
			db.run("SELECT " + (opt.update ? "DisableSpatialIndex('" + opt.dataset.name + "', '_where_geom')" : "''"), err => {
				if (err) throw err
				db.run("DROP TABLE IF EXISTS idx_" + opt.dataset.name + "__where_geom", err => {
					if (err) throw err
					db.run("SELECT " + (opt.update ? "DiscardGeometryColumn('" + opt.dataset.name + "', '_where_geom')" : "''"), err => {
						if (err) throw err
						db.run("DROP TABLE IF EXISTS " + opt.dataset.name, err => {
							if (err) throw err
							db.run("CREATE TABLE " + opt.dataset.name + "('ROWID' INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, " + Object.keys(schema).map(k => "'" + k + "' " + schema[k].type).join(", ") + ", '_where_wkt' TEXT)", err => {
								if (err) throw err
								db.run("SELECT AddGeometryColumn('" + opt.dataset.name + "', '_where_geom', 4326, 'GEOMETRY', 'XY')", err => {
									if (err) throw err
									var prep = db.prepare("INSERT INTO " + opt.dataset.name + " ('" + Object.keys(schema).join("', '") + "', _where_wkt) VALUES (" + Object.keys(schema).map(() => "?").join(", ") + ",?)")
									data.features.forEach(feature => {
										var values = Object.keys(schema).map(k => feature.properties[k])
										values.push(geoJsonToWkt(feature.geometry))
										prep.bind(values)
										prep.run(err => {
											if (err) throw err
										})
									})
									prep.finalize((err) => {
										if (err) throw err
									})
								})
							})
						})
					})
				})
			})
		})
		db.run("commit", err => {
			if (err) throw err
			db.spatialite(err => {
				if (err) throw err
				db.run("UPDATE " + opt.dataset.name + " SET '_where_geom' = GeomFromText(" + opt.dataset.name + "._where_wkt, 4326)", err => {
					if (err) throw err
					db.run("SELECT CreateSpatialIndex('" + opt.dataset.name + "', '_where_geom')", err => {
						if (err) throw err
						process.send({
							status: "success",
							dataset: opt.dataset.name,
							schema: schema
						})
					})
				})
			})
		})
	})
}

function geoJsonToWkt(geojson) {
	if (geojson.type == "Point")
		return "POINT(" + geojson.coordinates[0] + " " + geojson.coordinates[1] + ")"
	if (geojson.type == "LineString")
		return "LINESTRING(" + geojson.coordinates.map(d => d[0] + " " + d[1]).join(", ") + ")"
	if (geojson.type == "Polygon")
		return "POLYGON((" + geojson.coordinates.map(d => d.map(e => e[0] + " " + e[1]).join(", ")).join("), (") + "))"
	return "NULL"
}