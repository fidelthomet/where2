var fork = require('child_process').fork,
	cron = require('node-cron'),
	restify = require('restify'),
	sqlite = require('spatialite')

var config = require('./config.json')

var db, structure

init()

function init() {
	if (!config.db_restore) {
		fork('db_init.js').on('message', (m) => {
			if(m==="done"){
				fork('db_update.js').on('message', (m) => {
					if(m.status === "success"){
						structure = m.structure
						schedule()
						db = new sqlite.Database(config.db_name, sqlite.OPEN_READONLY, function(){
							server_init()	
						})
						
					}
				})
			}
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


	try {
		req.query = req.query ? " WHERE " + parseQuery(req.query) : ""
	} catch (e) {
		resolve({status: 400, response: {error: "invalid query"}})
		return
	}



	db.spatialite(function(err) {
		console.log("SELECT AsGeoJSON(_where_coord) as geometry, * FROM " + req.dataset + req.query)
		db.all("SELECT AsGeoJSON(_where_coord) as geometry, * FROM " + req.dataset + req.query, function(err, res) {
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

function parseQuery(a) {
	var as = a.split("&")
	as.forEach(function(b, bi) {
		var bs = b.split("|")
		bs.forEach(function(c, ci) {
			var cs = c.split("(")
			cs.forEach(function(d, di) {
				var ds = d.split(")")
				ds.forEach(function(e, ei) {
					if(!e){
						ds[ei]=''
					} else {
						var es = e.split(/(<=|>=|<|>|!=|=)/)
						ds[ei] = '`' + es[0].trim() + '` ' + es[1] + ' "' + es[2].trim() + '"'
					}
				})
				cs[di] = ds.join(" ) ")
			})
			bs[ci] = cs.join(" ( ")
		})
		as[bi] = bs.join(" OR ")
	})
	return as.join(" AND ")
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