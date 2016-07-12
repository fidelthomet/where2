# Where2

## Introduction

Where2 turns static GeoJSON files into queryable APIs. Have a look at the [demo application](https://where2demo.herokuapp.com/) to see how it works.

Where2 is a Node.js based application, which creates APIs from GeoJSON files. Where2 supports spatial (Equals, Disjoint, Touches, Within, Overlaps, Crosses, Intersects, Contains, DistWithin) and property-based queries and returns GeoJSON. Where2 also automatically creates API docs which come with a query builder that makes it easy to get started with your queries.

## Getting Started

The [demo application](https://where2demo.herokuapp.com/) allows you to query data from Zurich's Open Data Catalogue. Follow these instructions to set up your own instance of Where2 with datasets of your own choosing.

### Prerequisites
**Where2** requieres Node.js. If you don’t have it yet, go download and install [Node.js](https://nodejs.org/en/download/).

### Installing
Grab a copy of **Where2**, open your Terminal (or other Command Line Interface), `cd` into the directory and install the dependencies using npm:
```
npm install
```
To test the application run this command:
```
node where.js
```
## Configuration
To use your own datasets and to make the documentation work you have to do a few changes in `config.json`

### General Settings
- Open config.json and change `host` to your hostname (eg: `http://localhost:33333` or `https://example.herokuapp.com`).
- Under `docs` change `title` and `description` as you like.

### Datasets
All datasets are listed under `data`. To make a dataset available you need to define a `name` and an `url` (for hosted files) or a `path` (for files in the data directory).

```json
{
	"name": "addresses",
	"url": "https://example.org/addresses.json"
}
``` 
or
```json
{
	"name": "addresses",
	"path": "addresses.json"
}
```

#### Scheduling
Scheduling allows you to automatically update datasets periodically. To define a `schedule` you need to provide a [cron expression](http://merencia.com/node-cron/#cron-syntax). E.g. `0 3 1 * *` to update at 3 am on the first of each month or `15 0 * * 3` to update every wednesday at 0:15 am.

#### Schema Definition
Where2 automatically detects the schema of the GeoJSON feature properties based on the first feature. Defining a custom schema instead is helpful if the properties contain stringified numbers, which could lead to unexpected results when performing queries using the less and greater than operators.

```json
"schema": {
	"city": "TEXT",
	"street": "TEXT",
	"house-number": "INT"
}
```

### Advanced Options

| Property | Description |
| --- | --- |
| `port` | sets server port (may be overwritten by setting environment variable `PORT`) |
| `data_dir` | directory for local GeoJSON-files |
| `db_name`| sets the name of the SQLite database which will be created on startup |

### Example Configuration
```json
{
	"host": "https://example.herokuapp.com",
	"docs": {
		"description": "My very own instance of Where2",
		"title": "My Where2",
	},
	"data": [{
		"name": "addresses",
		"url": "https://example.org/addresses.json",
		"schedule": "15 0 * * 3",
		"schema": {
			"city": "TEXT",
			"street": "TEXT",
			"house-number": "INT"
		}
	}],
	"server_port": "33333",
	"data_dir": "data/",
	"db_name": "db.db"
}
```
## Deploy Where2 on Heroku
1. Fork this repository to your GitHub account
2. Modify `config.json` to fit your needs
3. Sign in to [Heroku](https://www.heroku.com)
4. Create a new App
5. Choose an App Name and Runtime Selection
6. Under **Deployment Method** choose GitHub
7. Connect Heroku with your GitHub Account
8. Select the repository
9. Under **Manual Deploy** choose your Branch and click on **Deploy Branch**
10. Wait
11. Done
