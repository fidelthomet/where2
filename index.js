var fork = require('child_process').fork,
	cron = require('node-cron'),
	restify = require('restify'),
	sqlite = require('spatialite'),
	docs = require('./docs/docs.js'),

	config = require('./config.json')

var db, structure = {}, ready

init_server()

function create_db() {
	fork('db/db_init.js').on('message', (m) => {
		if (m === "done") {
			create_table(0)
		}
	})
}

function create_table(i) {
	if (i === config.data.length) {
		schedule()
		init_db()
		return
	}
	var opt = {
			db_name: config.db_name,
			data_dir: config.data_dir,
			dataset: config.data[i]
		}
	fork('db/db_update.js', [JSON.stringify(opt)]).on('message', (m) => {
		structure[m.dataset] = m.schema
		console.log(m.dataset + " created at " + new Date().toISOString())
		create_table(i + 1)
	})
}

function init_db() {
	db = new sqlite.Database(config.db_name, sqlite.OPEN_READONLY, function() {
		ready = true
		console.log("ready")
	})
}

function init_server() {
	var server = restify.createServer()

	server.use(restify.CORS())

	restify.CORS.ALLOW_HEADERS.push("authorization")
	restify.CORS.ALLOW_HEADERS.push("withcredentials")
	restify.CORS.ALLOW_HEADERS.push("x-requested-with")
	restify.CORS.ALLOW_HEADERS.push("x-forwarded-for")
	restify.CORS.ALLOW_HEADERS.push("x-real-ip")
	restify.CORS.ALLOW_HEADERS.push("x-customheader")
	restify.CORS.ALLOW_HEADERS.push("user-agent")
	restify.CORS.ALLOW_HEADERS.push("keep-alive")
	restify.CORS.ALLOW_HEADERS.push("host")
	restify.CORS.ALLOW_HEADERS.push("accept")
	restify.CORS.ALLOW_HEADERS.push("connection")
	restify.CORS.ALLOW_HEADERS.push("upgrade")
	restify.CORS.ALLOW_HEADERS.push("content-type")
	restify.CORS.ALLOW_HEADERS.push("dnt") // Do not track
	restify.CORS.ALLOW_HEADERS.push("if-modified-since")
	restify.CORS.ALLOW_HEADERS.push("cache-control")

	server.on("MethodNotAllowed", function(request, response) {
		if (request.method.toUpperCase() === "OPTIONS") {
			response.header("Access-Control-Allow-Credentials", true)
			response.header("Access-Control-Allow-Headers", restify.CORS.ALLOW_HEADERS.join(", "))
			response.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			response.header("Access-Control-Allow-Origin", request.headers.origin)
			response.header("Access-Control-Max-Age", 0)
			response.header("Content-type", "text/plain charset=UTF-8")
			response.header("Content-length", 0)
			response.send(204)
		} else {
			response.send(new restify.MethodNotAllowedError())
		}
	})

	server.get('/:query', (req, res) => {
		if (!req.params.query) {
			res.contentType = 'text/html'
			res.header('Content-Type', 'text/html')
			res.end(ready ? docs.docs(structure, config.docs, config.host) : docs.launch())
		} else {
			try {
				prepare_query(JSON.parse(req.params.query), res)
			} catch (e) {
				res.send(400, {
					error: 'malformed request'
				})
			}

		}
	})

	server.use(restify.bodyParser())
	server.post('/', (req, res) => {
		if (!Object.keys(req.params).length === 0) {
			res.contentType = 'text/html'
			res.header('Content-Type', 'text/html')
			res.end(ready ? docs.docs(structure, config.docs, config.host) : docs.launch())
		} else {

			try {
				prepare_query(req.params, res)
			} catch (e) {
				res.send(400, {
					error: 'malformed request'
				})
			}

		}
	})

	server.listen((process.env.PORT || config.server_port), function() {
		console.log('where2 listening at port %s', (process.env.PORT || config.server_port))
		create_db()
	})
}

function prepare_query(req, res) {
	if (!req.dataset) {
		res.send(400, {
			error: 'missing parameter \'dataset\'',
			'avaiable datasets': Object.keys(config.data)
		})
		return
	}
	if (Object.keys(structure).indexOf(req.dataset) == -1) {
		res.send(404, {
			error: 'dataset \'' + req.dataset + "\' does not exist",
			'avaiable datasets': Object.keys(structure)
		})
		return
	}

	new Promise(function(resolve) {
		db_query(req, resolve)
	}).then(function(result) {
		res.send(result.status, result.response)
	})
}

function db_query(req, resolve) {
	var query = "SELECT AsGeoJSON(_where_geom) as geometry, "
	try {
		query += parseProperties(req.properties, req.dataset)
		query += req.distance ? parseDistance(req.distance, "where_distance") : ""
		query += (req.spatial && req.spatial.relation.toLowerCase() === "distwithin") ? parseDistance(req.spatial.geometry, "where_distance_temp") : ""
		query += " FROM "
		query += req.dataset
		query += req.query ? " WHERE (" + parseQuery(req.query, req.dataset) + ")" : ""
		query += req.spatial ? (req.query ? " AND " : " WHERE ") + parseSpatial(req.spatial, req.dataset) : ""

		query += req.sort ? " ORDER BY " + parseSort(req.sort, req.dataset) : ""
		query += req.limit ? " LIMIT " + validateNumeric(req.limit, "limit") : ""
		query += req.offset ? " OFFSET " + validateNumeric(req.offset, "offset") : ""


	} catch (e) {
		resolve({
			status: 400,
			response: {
				error: "invalid query",
				msg: e
			}
		})
		return
	}

	db.spatialite(function(err) {
		db.all(query, function(err, res) {
			if (err) {
				resolve({
					status: 500,
					response: err
				})
			} else {
				var geojson = {
					"name": req.dataset,
					"type": "FeatureCollection",
					"features": []
				}
				res.forEach(function(feature) {
					delete feature.where_distance_temp
					geojson.features.push({
						"type": "Feature",
						"geometry": JSON.parse(feature.geometry),
						"properties": feature
					})
					delete geojson.features[geojson.features.length - 1].properties.geometry
				})
				resolve({
					status: 201,
					response: geojson
				})
			}
		})
	})
}

function parseQuery(a) {
	if (a.and) {
		return "(" + a.and.map(parseQuery).join(" AND ") + ")"
	} else if (a.or) {
		return "(" + a.or.map(parseQuery).join(" OR ") + ")"
	} else {

		var prop = '`' + a.prop + '`'
		var val = a.val
		var op = a.op ? a.op : '='
		var c = typeof a.val === 'string' && !a.c ? true : false

		switch (op) {
			case "$":
				op = "LIKE"
				val = "%" + val + "%"
				break
			case "!$":
				op = "NOT LIKE"
				val = "%" + val + "%"
				break
			case "$=":
				op = "LIKE"
				val = "%" + val
				break
			case "!$=":
				op = "NOT LIKE"
				val = "%" + val
				break
			case "=$":
				op = "LIKE"
				val = val + "%"
				break
			case "!=$":
				op = "NOT LIKE"
				val = val + "%"
				break
			case ">":
			case "<":
			case ">=":
			case "<=":
			case "=":
			case "!=":
				break
			default:
				throw "Error: " + op + " is not a valid Operator"
		}

		val = typeof val === 'string' ? '"' + val + '"' : val

		if (c) {
			prop = "LOWER(" + prop + ")"
			val = "LOWER(" + val + ")"
		}

		var q = [prop, op, val].join(' ')

		return q
	}
}

function parseSpatial(s, dataset) {
	if (s.relation.toLowerCase() == 'distwithin') {
		var spatial = ["(`where_distance_temp` < " + s.distance + ") AND ROWID IN (SELECT ROWID FROM SpatialIndex WHERE f_table_name = '" + dataset + "' AND search_frame = BuildMbr(MbrMinX(BUFFER(", ")),MbrMinY(BUFFER(", ")),MbrMaxX(BUFFER(", ")),MbrMaxY(BUFFER(", ")), 4326))"]
		if (typeof s.geometry === "string")
			return spatial.join("GeomFromText('" + s.geometry + "')," + (s.distance * 0.0000090053))
		else
			return spatial.join("GeomFromGeoJSON('" + JSON.stringify(s.geometry) + "')," + (s.distance * 0.0000090053))
	}

	var spatial = [" AND ROWID IN (SELECT ROWID FROM SpatialIndex WHERE f_table_name = '" + dataset + "' AND search_frame = BuildMbr(MbrMinX(", "),MbrMinY(", "),MbrMaxX(", "),MbrMaxY(", "), 4326))"]

	if (['equals', 'disjoint', 'touches', 'within', 'overlaps', 'crosses', 'intersects', 'contains', 'covers', 'coveredby'].indexOf(s.relation.toLowerCase()) === -1)
		throw "Error: " + s.relation + " is not a valid spatial relationship function"

	if (typeof s.geometry === "string")
		return s.relation.toUpperCase() + "(_where_geom, GeomFromText('" + s.geometry + "'))" + spatial.join("GeomFromText('" + s.geometry + "')")
	else
		return s.relation.toUpperCase() + "(_where_geom, GeomFromGeoJSON('" + JSON.stringify(s.geometry) + "'))" + spatial.join("GeomFromGeoJSON('" + JSON.stringify(s.geometry) + "')")
}



function parseDistance(d, as) {
	if (typeof d === "string")
		return ", Distance(_where_geom,GeomFromText('" + d + "'),0) as " + as
	else
		return ", Distance(_where_geom,GeomFromGeoJSON('" + JSON.stringify(d) + "'),0) as " + as
}

function parseSort(sort, dataset) {
	if (!sort.by)
		throw "Error: missing value sort.by"
	if (Object.keys(structure[dataset]).indexOf(sort.by.trim()) == -1 && sort.by.trim() != "where_distance")
		throw "Error: sort by property '" + sort.trim() + "' doesn't exist"

	return "`" + sort.by.trim() + "`" + (sort.desc === true ? " DESC" : "")
}

function parseProperties(properties, dataset) {
	if (properties) {
		var filter = "`" + properties.map((p) => {
			if (Object.keys(structure[dataset]).indexOf(p) == -1)
				throw "Error: property '" + p + "' doesn't exist"
			return p
		}).join("`, `") + "`"
		return filter
	} else {
		return "`" + Object.keys(structure[dataset]).join("`, `") + "`"
	}
}

function validateNumeric(value, property) {
	if (isNaN(value))
		throw "Error: value for '" + property + "' is not a number"
	return value
}

function schedule() {
	config.data.forEach((d) => {
		if(d.schedule){
			cron.schedule(d.schedule, function() {
				var opt = {
					db_name: config.db_name,
					data_dir: config.data_dir,
					dataset: d,
					update: true
				}
				fork('db/db_update.js', [JSON.stringify(opt)]).on('message', (m) => {
					structure[m.dataset] = m.schema
					console.log(m.dataset + " updated at " + new Date().toISOString())
				})
			})
		}
	})
}