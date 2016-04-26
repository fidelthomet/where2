var exec = require('child_process').exec,
	cron = require('node-cron'),
	restify = require('restify'),
	sqlite = require('spatialite')

var config = require('./config.json')

var db

init()

function init() {
	if (!config.db_restore) {

		var db_init = exec('node db_init.js', function(err, stdout, stderr) {
			if (err) {
				console.log(err.stack)
				console.log('Error code: ' + err.code)
				console.log('Signal received: ' + err.signal)
			}
			if (stderr)
				console.log('STDERR: ' + stderr)

		}).on('exit', function(err) {
			if (err) throw err

			var db_init = exec('node db_update.js', {
				env: {
					data: JSON.stringify(Object.keys(config.data))
				}
			}, function(error, stdout, stderr) {
				console.log('STDERR: ' + stderr)
				console.log('STDOUT: ' + stdout)
			}).on('exit', function(err) {
				console.log("done")
				schedule()
				server_init()
				db = new sqlite.Database(config.db_name)
			})
		})
	} else {
		schedule()
		server_init()
		db = new sqlite.Database(config.db_name)
	}
}

function server_init() {
	var server = restify.createServer()

	server.get('/:query', function(req, res) {
		if (!req.params.query) {
			res.send("documentation")
		} else {
			try {
				server_handle(JSON.parse(req.params.query), res)
			} catch (e) {
				res.send(400, {
					error: 'malformed request'
				})
			}

		}
	})

	server.listen((process.env.PORT || config.server_port), function() {
		console.log('where2 listening at port %s', (process.env.PORT || config.server_port))
	})
}

function server_handle(req, res) {
	if (!req.dataset) {
		res.send(400, {
			error: 'missing parameter \'dataset\'',
			'avaiable datasets': Object.keys(config.data)
		})
		return
	}
	if (Object.keys(config.data).indexOf(req.dataset) == -1) {
		res.send(404, {
			error: 'dataset \'' + req.dataset + "\' does not exist",
			'avaiable datasets': Object.keys(config.data)
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
	var where = ""

	if (req.properties !== undefined) {
		Object.keys(req.properties).forEach(function(key) {
			if (!where)
				where += " WHERE "
			else
				where += ", "
			where += key + " = '" + req.properties[key] + "'"
		})
	}

	db.spatialite(function(err) {
		console.log("SELECT AsGeoJSON(_where_coord) as geometry, * FROM " + req.dataset + where)
		db.all("SELECT AsGeoJSON(_where_coord) as geometry, * FROM " + req.dataset + where, function(err, res) {
			if (err) {
				resolve({
					status: 500,
					response: err
				})
			} else {
				resolve({
					status: 201,
					response: res
				})
			}
		})
	})

}

function schedule() {
	console.log("schedule")
		// cron.schedule('0 * * * *', function() {
		// 	var ls = exec('node index.js', function(error, stdout, stderr) {
		// 		if (error) {
		// 			console.log(error.stack);
		// 			console.log('Error code: ' + error.code);
		// 			console.log('Signal received: ' + error.signal);
		// 		}
		// 		console.log('STDOUT: ' + stdout);
		// 		console.log('STDERR: ' + stderr);
		// 	})

	// 	ls.on('exit', function(code) {
	// 		console.log('Exit at ' + new Date().toISOString());
	// 	})
	// })
}