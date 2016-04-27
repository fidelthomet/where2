var query = 'Pflanzjahr >= 2015 & Kategorie=Parkbaum&(Baumname_LAT==Pyr<h<us spec.|(Baumname_LAT =Fagus sylvatica))|(Pflanzjahr <= 1934 & Pflanzjahr > 1930)'


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
						console.log(e)
						ds[ei] = '`' + es[0].trim() + '` ' + es[1] + ' "' + es[2].trim() + '"'
					}
				})
				cs[di] = ds.join(" ) ")
			})
			bs[ci] = cs.join(" ( ")
		})
		as[bi] = bs.join(" OR ")
	})
	console.log(as.join(" AND "))
}