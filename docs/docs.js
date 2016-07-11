var fs = require("fs")

module.exports.docs = function(config, files, url) {
	return docs(config, files, url)
}

var html = "",
	documentation = "",
	css = "",
	libs = "",
	script = ""

fs.readFile("./docs/index.html", 'utf8', (err, f) => {
	if (err) throw err
	html = f
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
}