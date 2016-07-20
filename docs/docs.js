var fs = require("fs")

module.exports.docs = function(config, files, url) {
	return docs(config, files, url)
}

module.exports.launch = function() {
	return launch ? launch : ""
}

module.exports.map = function(q, url) {
	return map(q, url)
}

var html = "",
	documentation = "",
	css = "",
	libs = "",
	script = "",
	mapHtml = ""

fs.readFile("./docs/index.html", 'utf8', (err, f) => {
	if (err) throw err
	html = f
})

fs.readFile("./docs/launch.html", 'utf8', (err, f) => {
	if (err) throw err
	launch = f
})

fs.readFile("./docs/documentation.html", 'utf8', (err, f) => {
	if (err) throw err
	documentation = f
})

fs.readFile("./docs/docs.css", 'utf8', (err, f) => {
	if (err) throw err
	css = f
})

fs.readFile("./docs/libs.js", 'utf8', (err, f) => {
	if (err) throw err
	libs = f
})

fs.readFile("./docs/script.js", 'utf8', (err, f) => {
	if (err) throw err
	script = f
})

fs.readFile("./docs/map.html", 'utf8', (err, f) => {
	if (err) throw err
	mapHtml = f
})

function docs(s, snippets, url) {
	var availableDatasets = Object.keys(s).map(d => {
		return d + ' <span class="blue" onclick="$(\'#table-' + d + '\').toggle()">properties</span>' +
			"<table id='table-" + d + "' class='hidden'><tr><th>Property</th><th>Type</th><th>Example</th></tr>" +
			Object.keys(s[d]).map(p => "<tr><td>" + p + "</td><td>" + s[d][p].type + "</td><td>" + s[d][p].example + "</td></tr>").join("") + "</table>"
	}).join("<br>")
	var optDatasets = Object.keys(s).map(d => "<option value='" + d + "'>" + d + "</option>").join("")

	return html
		.replace("{{script}}", "<script type='text/javascript'>var schema = " + JSON.stringify(s) + ", snippets = " + JSON.stringify(snippets) + ", url = '" + url + "'\n" + script + "</script>")
		.replace("{{documentation}}", documentation)
		.replace("{{css}}", css)
		.replace("{{libs}}", libs)
		.replace(/{{url}}/g, url)
}

function map(q, url) {
	return mapHtml.replace("{{variables}}", "var q = "+ JSON.stringify(q)+", url = '"+ url+"'").replace("{{libs}}", libs).replace("{{css}}", css)
}
