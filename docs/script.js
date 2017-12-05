"use strict";

document.onreadystatechange = function () {
	if (document.readyState !== "interactive") return;

	d3.selectAll("header, title").html(snippets.title + " — API Docs");
	d3.select("#description").html(snippets.description);
	d3.select("#datasets").html(Object.keys(schema).map(function (d) {
		return '<h1>' + d + '</h1><br>' + "<table id='table-" + d + "'><tr><th>Property</th><th>Type</th><th>Example</th></tr>" + Object.keys(schema[d]).map(function (p) {
			return "<tr><td>" + p + "</td><td>" + schema[d][p].type + "</td><td>" + schema[d][p].example + "</td></tr>";
		}).join("") + "</table>";
	}).join("<br>") + "<br><br>");
	d3.select("#opt-dataset").html(Object.keys(schema).map(function (d) {
		return "<option value='" + d + "'>" + d + "</option>";
	}).join(""));

	d3.select(".opt-spatial").on("change", function () {
		d3.select("input.in-spatial").style("display", d3.event.target.value === "DistWithin" ? "inline-block" : "none");
	});

	fillProperties();
	d3.select("#opt-dataset").on("change", fillProperties);

	d3.selectAll(".cb").on("change", function () {
		d3.selectAll(".in-" + d3.event.target.id.split("-")[1]).property('disabled', !d3.event.target.checked);
	});

	var map1 = L.map('map1', {
		scrollWheelZoom: false
	}).setView(snippets.map_center, snippets.map_zoom);
	var map2 = L.map('map2', {
		scrollWheelZoom: false
	}).setView(snippets.map_center, snippets.map_zoom);

	map1.sync(map2);
	map2.sync(map1);

	d3.select('#sel-datasets').on("click", toggleView);
	d3.select('#sel-documentation').on("click", toggleView);
	d3.select('#sel-query-builder').on("click", function () {
		toggleView();
		map1.invalidateSize();
		map2.invalidateSize();
	});

	function toggleView() {
		d3.selectAll('.view').style("display", "none");
		d3.select('#' + d3.event.target.id.split("sel-")[1]).style("display", "block");
		d3.select('.selection .selected').classed('selected', false);
		d3.select('#' + d3.event.target.id).classed('selected', true);
	}

	L.control.fullscreen().addTo(map2);

	var drawControl = new L.Control.Draw({
		draw: {
			circle: false
		}
	});

	map1.addControl(drawControl);

	map1.addLayer(L.tileLayer('http://a.tile.stamen.com/toner/${z}/${x}/${y}.png', {
		attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
		subdomains: 'abcd',
		minZoom: 0,
		maxZoom: 18
	}));
	map2.addLayer(L.tileLayer('http://a.tile.stamen.com/toner/${z}/${x}/${y}.png', {
		attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
		subdomains: 'abcd',
		minZoom: 0,
		maxZoom: 18
	}));

	var drawingLayer, geojsonLayer;

	map1.on('draw:created', function (e) {
		var type = e.layerType;
		drawingLayer = e.layer;
		drawingLayer.addTo(map1);
	});

	map1.on('draw:drawstart', function () {
		if (drawingLayer) map1.removeLayer(drawingLayer);
	});

	map2.on('fullscreenchange', function () {
		if (map2.isFullscreen()) {
			map1.unsync(map2);
			map2.unsync(map1);
			map2.scrollWheelZoom.enable();
		} else {
			map2.scrollWheelZoom.disable();
			map2.invalidateSize();
			map1.panTo(map2.getCenter());
			map1.setZoom(map2.getZoom());
			map1.sync(map2);
			map2.sync(map1);
		}
	});

	d3.select("#send").on("click", function () {
		if (geojsonLayer) map2.removeLayer(geojsonLayer);

		var where = {
			dataset: d3.select("#opt-dataset").property("value")
		};
		if (d3.select("#cb-query").node().checked) where.query = {
			prop: d3.select("#container-query .opt-properties").property("value"),
			op: d3.select("#query-operator").property("value"),
			val: isNaN(+d3.select("#query-value").property("value")) ? d3.select("#query-value").property("value") : +d3.select("#query-value").property("value")
		};
		if (d3.select("#cb-spatial").node().checked) {
			where.spatial = {
				relation: d3.select(".opt-spatial").property("value"),
				geometry: drawingLayer ? drawingLayer.toGeoJSON().geometry : ""
			};
			if (where.spatial.relation === "DistWithin") where.spatial.distance = +d3.select("input.in-spatial").property("value");
		}
		if (d3.select("#cb-properties").node().checked) where.properties = d3.selectAll("#container-properties .in-properties").nodes().map(function (el) {
			return el.checked ? el.value : false;
		}).filter(function (el) {
			return el;
		});
		if (d3.select("#cb-sort").node().checked) where.sort = {
			by: d3.select(".opt-properties.in-sort").property("value"),
			desc: d3.select("#cb-desc").node().checked
		};
		if (d3.select("#cb-limit").node().checked) where.limit = d3.select(".in-limit").property("value");
		if (d3.select("#cb-offset").node().checked) where.offset = d3.select(".in-offset").property("value");

		d3.select("#req_URL").attr("href", url + "/q/" + encodeURIComponent(JSON.stringify(where))).text(url + "/q/" + encodeURIComponent(JSON.stringify(where)));
		d3.select("#map_URL").attr("href", url + "/map/" + encodeURIComponent(JSON.stringify(where))).text(url + "/map/" + encodeURIComponent(JSON.stringify(where)));
		d3.select("#req_body").text(JSON.stringify(where, null, "  "));
		d3.select("#request").style("display", "block");

		d3.request(url + "/q").header("X-Requested-With", "XMLHttpRequest").header("Content-Type", "application/json").post(JSON.stringify(where), function (err, data) {
			if (err) throw err;

			d3.select("#res_body").text(JSON.stringify(JSON.parse(data.response), null, "  "));
			geojsonLayer = L.geoJson(JSON.parse(data.response), {
				onEachFeature: function onEachFeature(feature, layer) {
					layer.bindPopup("<table>" + Object.keys(feature.properties).map(function (k) {
						return "<tr><td>" + k + "</td><td>" + feature.properties[k] + "</td></tr>";
					}).join("") + "</table>");
				}
			});
			map2.fitBounds(geojsonLayer.getBounds());
			geojsonLayer.addTo(map2);
		});
	});
};

function fillProperties() {
	d3.selectAll(".opt-properties").html(Object.keys(schema[d3.select("#opt-dataset").property("value")]).map(function (d) {
		return "<option value='" + d + "'>" + d + "</option>";
	}).join(""));
	d3.select("#container-properties").html(Object.keys(schema[d3.select("#opt-dataset").property("value")]).map(function (d) {
		return '<label><input class="in-properties" type="checkbox" checked id="cbox1" value="' + d + '">&nbsp;' + d + '</label>&nbsp;<wbr>';
	}).join(""));
}
