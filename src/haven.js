var fs = require('fs');
var path = require('path');
var request = require('request');
var async = require('async');
var AdmZip = require('adm-zip');
var parser = require('xml2js');
var BowerClient = require('bower-registry-client');
var bower = new BowerClient({});
var gh = require('github-url-to-object')
var ghdownload = require('download-github-repo')

exports.haven = new function() {

	var _havenConfig;

	this.getConfig = function() {
		return loadHavenConfig();
	}

	this.run = function(method, args, callback) {
		if (callback == null) {
			callback = function(err) {
				if (err != null) {
					throw err.message;
				}
			};
		}
		if (method === "install") {
			this.install();
		} else if (method === "deploy") {
			this.install();
			this.deploy(callback);
		} else if (method === "deployOnly") {
			this.deploy(callback);
		} else if (method === "update") {
			this.update(callback);
		} else if (method === "clean") {
			this.clean();
		} else if (method === "clean-cache") {
			this.cleanCache();
		} else if (method === "check-config") {
			this.checkConfig();
		} else if (method === "set-version") {
			this.setVersion(args);
		} else {
			throw "Command not found: " + method;
		}
	};

	this.checkConfig = function() {
		var config = loadPackageConfig();
		if (!/\-SNAPSHOT$/.test(config.version)) {
			for (var i in config.dependencies) {
				var dependency = config.dependencies[i];
				if (/\-SNAPSHOT$/.test(dependency.version)) {
					var e = new Error();
					e.code = "SnapshotDependencyException";
					e.message = "Snapshot dependency found: " + dependency.name + " v." + dependency.version;
					throw e;
				}
			}
		}
	}

	this.setVersion = function(version) {
		var packageConfig = loadPackageConfig();
		packageConfig.version = version;
		savePackageConfig(packageConfig);
	}

	this.install = function() {
		var packageConfig = loadPackageConfig();
		this.checkConfig();
		var packageName = packageConfig.name;
		var packageVersion = packageConfig.version;
		var artifacts = packageConfig.artifacts;
		for (var a in artifacts) {
			var artifact = artifacts[a];
			var artifactId = artifact.id;
			var thisPackageName = packageName;
			if (artifactId != null) {
				thisPackageName = thisPackageName + "-" + artifactId;
			}
			var packageFilePaths = artifact.files;
			var localCache = loadHavenConfig().local_cache;
			var localCachePackageDir = localCache + "/" + thisPackageName;
			var localCacheVersionDir = localCachePackageDir + "/" + packageVersion;
			var localCacheArtifactDir = localCacheVersionDir + "/artifact";
			mkdirsIfNecessary([localCache, localCachePackageDir, localCacheVersionDir, localCacheArtifactDir]);
			console.log("Installing " + thisPackageName + " v." + packageVersion + " to " + localCacheVersionDir);
			for (var i in packageFilePaths) {
				var packageFilePath = packageFilePaths[i];
				var packageFileSrcPath;
				var packageFileTargetPath;
				if (typeof packageFilePath == "string") {
					packageFileSrcPath = packageFilePath;
					packageFileTargetPath = packageFilePath;
				} else {
					packageFileSrcPath = Object.keys(packageFilePath)[0];
					packageFileTargetPath = packageFilePath[packageFileSrcPath];
				}
				installArtifactFile(packageFileSrcPath, localCacheArtifactDir + "/" + packageFileTargetPath);
			}
			console.log("Installing haven.json");
			fs.writeFileSync(localCacheVersionDir + "/haven.json", JSON.stringify(packageConfig));
		}
	}

	this.deploy = function(callback) {
		var packageConfig = loadPackageConfig();
		try {
			this.checkConfig();
		} catch (e) {
			callback(e);
		}
		var packageName = packageConfig.name;
		var packageVersion = packageConfig.version;
		var artifacts = packageConfig.artifacts;
		for (var a in artifacts) {
			var artifact = artifacts[a];
			var artifactId = artifact.id;
			var thisPackageName = packageName;
			if (artifactId != null) {
				thisPackageName = thisPackageName + "-" + artifactId;
			}
			var packageFilePaths = artifact.files;
			var repositoryPath = packageConfig.repositories.distribution[0].url;
			var repositoryPackagePath = repositoryPath + "/" + thisPackageName;
			var repositoryVersionPath = repositoryPackagePath + "/" + packageVersion;
			var repositoryArtifactPath = repositoryVersionPath + "/artifact";
			console.log("Deploying " + thisPackageName + " v." + packageVersion + " to " + repositoryVersionPath);
			async.eachSeries(packageFilePaths, function(packageFilePath, callback) {
				var packageFileSrcPath;
				var packageFileTargetPath;
				if (typeof packageFilePath == "string") {
					packageFileSrcPath = packageFilePath;
					packageFileTargetPath = packageFilePath;
				} else {
					packageFileSrcPath = Object.keys(packageFilePath)[0];
					packageFileTargetPath = packageFilePath[packageFileSrcPath];
				}
				deployArtifactFile(packageFileSrcPath, repositoryArtifactPath + "/" + packageFileTargetPath, callback);
			}, function(err) {
				console.log("Deploying haven.json");
				var r = request.post(repositoryVersionPath + "/haven.json", function optionalCallback(err, httpResponse, body) {
					callback(err);
				});
				var form = r.form();
				form.append('my_file', fs.createReadStream("haven.json"));
			});
		}
	}

	this.update = function(callback) {
		this.clean();
		var packageConfig = loadPackageConfig();
		loadDependencies(packageConfig.dependencies, false, null, callback);
	}

	this.clean = function() {
		console.log("Cleaning haven artifacts");
		deleteRecursiveSync(loadHavenConfig().path);
	}

	this.cleanCache = function() {
		console.log("Cleaning haven artifacts cache");
		deleteRecursiveSync(loadHavenConfig().local_cache);
	}

	function installArtifactFile(srcPath, targetPath) {
		if (fs.statSync(srcPath).isDirectory()) {
			mkdirsIfNecessary([targetPath]);
			var files = fs.readdirSync(srcPath);
			for (var i in files) {
				var file = files[i];
				installArtifactFile(srcPath + "/" + file, targetPath + "/" + file);
			}
		} else {
			var packageFile = fs.readFileSync(srcPath);
			console.log("Installing " + srcPath);
			fs.writeFileSync(targetPath, packageFile);
		}
	}

	function deployArtifactFile(srcPath, targetPath, callback) {
		if (!fs.statSync(srcPath).isDirectory()) {
			console.log("Deploying " + srcPath + " to " + targetPath);
			var r = request.post(targetPath, function optionalCallback(err, httpResponse, body) {
				callback(err);
			});
			var form = r.form();
			form.append('my_file', fs.createReadStream(srcPath));
		} else {
			var files = fs.readdirSync(srcPath);
			async.eachSeries(files, function(file, callback) {
				deployArtifactFile(srcPath + "/" + file, targetPath + "/" + file, callback);
			}, callback);
		}
	}

	function loadDependencies(dependencies, transient, parentScope, callback) {
		if (dependencies != null) {
			async.eachSeries(dependencies, function(dependency, callback) {
				var havenConfig = loadHavenConfig();
				var dependencyName = dependency.name;
				var dependencyVersion = dependency.version;
				var dependencyScope = dependency.scope;
				if (dependencyScope == null) {
					dependencyScope = havenConfig.defaults.scope;
				}
				if (!transient || havenConfig.transient_scopes.indexOf(dependencyScope) > -1) {
					if (parentScope != null) {
						dependencyScope = parentScope;
					}
					loadArtifact(dependencyName, dependencyVersion, dependencyScope, dependency.includes, dependency.excludes, callback);
				} else {
					callback();
				}
			}, callback);
		} else {
			callback();
		}
	}

	function loadArtifact(name, version, scope, includes, excludes, callback) {
		console.log("Loading artifact " + name + " v." + version);
		console.log("Checking local haven cache");
		loadLocalArtifact(loadHavenConfig().local_cache, name, version, scope, includes, excludes, function(err) {
			if (err == null) {
				callback();
			} else if (err.code === "DependencyNotFoundException") {
				var loaded = false;
				var repositories = loadHavenConfig().repositories.dependencies.slice(0);
				var packageConfig = loadPackageConfig();
				if (packageConfig.repositories) {
					if (packageConfig.repositories.dependencies) {
						repositories = repositories.concat(packageConfig.repositories.dependencies.slice(0));
					}
				}
				async.until(function() {
					return loaded || repositories.length === 0;
				}, function(callback) {
					var repository = repositories.shift();
					console.log("Checking repository: " + repository.url);
					var loadedCallback = function(err) {
						if (err == null) {
							loaded = true;
							callback();
						} else if (err.code === "DependencyNotFoundException") {
							callback();
						} else {
							callback(err);
						}
					};
					if (repository.type === "local") {
						loadLocalArtifact(repository.url, name, version, scope, includes, excludes, loadedCallback);
					} else if (repository.type === "maven") {
						loadMavenArtifact(repository.url, name, version, scope, includes, excludes, loadedCallback);
					} else if (repository.type === "haven") {
						loadHavenArtifact(repository.url, name, version, scope, includes, excludes, loadedCallback);
					} else if (repository.type === "bower") {
						loadBowerArtifact(repository.url, name, version, scope, includes, excludes, loadedCallback);
					} else {
						console.log("Unknown repository type: " + repository.type);
						callback();
					}
				}, function(err) {
					if (!loaded) {
						returnDependencyNotFoundError(name, version, callback);
					} else {
						callback();
					}
				});
			} else {
				callback(err);
			}
		});
	}

	function loadLocalArtifact(path, name, version, scope, includes, excludes, callback) {
		var artifactsDir = loadHavenConfig().path;
		var localCacheVersionDir = path + "/" + name + "/" + version;
		try {
			var artifactConfig = loadJSONFromFile(localCacheVersionDir + "/haven.json");
		} catch (e) {
			if (e.code === "ENOENT") {
				returnDependencyNotFoundError(name, version, callback);
			} else {
				callback(e);
			}
			return;
		}
		async.series([

			function(callback) {
				loadDependencies(artifactConfig.dependencies, true, scope, callback);
			},
			function(callback) {
				var localCacheArtifactDir = localCacheVersionDir + "/artifact";
				var scopeDir = artifactsDir + "/" + scope;
				var targetDir = scopeDir + "/" + name;
				mkdirsIfNecessary([artifactsDir, scopeDir, targetDir]);
				loadLocalArtifactFile(localCacheArtifactDir, "", "", targetDir, "", includes, excludes, callback);
			}
		], function(err, results) {
			callback(err);
		});
	}

	function loadLocalArtifactFile(srcDir, srcPath, file, targetDir, targetPath, includes, excludes, callback) {
		if (file !== "") {
			srcPath = srcPath + "/" + file;
		}
		var srcFile = srcDir;
		if (srcPath !== "") {
			srcFile = srcFile + "/" + srcPath;
		}
		if (fs.statSync(srcFile).isDirectory()) {
			var files = fs.readdirSync(srcFile);
			async.eachSeries(files, function(fileName, callback) {
				mkdirsIfNecessary([targetDir + targetPath + "/" + file]);
				loadLocalArtifactFile(srcDir, srcPath, fileName, targetDir, targetPath + "/" + file, includes, excludes, callback);
			}, callback);
		} else {
			srcPath = srcPath.substring(1);
			if ((includes == null || includes.indexOf(srcPath) > -1) && (excludes == null || excludes.indexOf(srcPath) == -1)) {
				console.log("Storing " + srcPath + " to " + targetDir + "/" + targetPath);
				//fs.readFile(srcFile, function(err, data) {
				//    console.log("readFile");
				//    console.log(err);
				//    console.log(data);
				//	fs.writeFile(targetDir + "/" + targetPath + "/" + file, data, callback);
				//});
				fs.writeFileSync(targetDir + "/" + targetPath + "/" + file, fs.readFileSync(srcFile));
				callback();
			} else {
				callback();
			}
		}
	}

	function loadHavenArtifact(url, name, version, scope, includes, excludes, callback) {
		console.log("Loading haven artifact");
		var repoVersionDirUrl = url + "/" + name + "/" + version;
		var configUrl = repoVersionDirUrl + "/haven.json";
		var artifactUrl = repoVersionDirUrl + "/artifact/";
		var localCache = loadHavenConfig().local_cache;
		var localCachePackageDir = localCache + "/" + name;
		var localCacheVersionDir = localCachePackageDir + "/" + version;
		var localCacheArtifactDir = localCacheVersionDir + "/artifact";
		async.waterfall([

			function(callback) {
				var req = request(configUrl);
				req.on("response", function(resp) {
					if (resp.statusCode === 200) {
						console.log("Downloading haven.json");
						mkdirsIfNecessary([localCache, localCachePackageDir, localCacheVersionDir, localCacheArtifactDir]);
						var stream = req.pipe(fs.createWriteStream(localCacheVersionDir + "/haven.json"));
						stream.on("close", function() {
							callback();
						});
					} else {
						returnDependencyNotFoundError(name, version, callback);
					}
				});
			},
			function(callback) {
				downloadHavenArtifactDirectory(artifactUrl, localCacheArtifactDir, function() {
					loadLocalArtifact(loadHavenConfig().local_cache, name, version, scope, includes, excludes, callback);
				});
			}
		], function(err) {
			callback(err);
		});
	}

	function downloadHavenArtifactDirectory(directoryUrl, targetDir, callback) {
		var req = request.get(directoryUrl + "?view=json", function(err, resp, body) {
			if (resp.statusCode === 200) {
				var artifacts = JSON.parse(body);
				async.waterfall([

					function(callback) {
						async.eachSeries(artifacts.resources, function(artifact, callback) {
							console.log("Downloading " + artifact.name);
							var stream = request.get(directoryUrl + artifact.name).pipe(fs.createWriteStream(targetDir + "/" + artifact.name));
							stream.on("close", function() {
								callback();
							});
						}, function(err) {
							callback(err);
						});
					},
					function(callback) {
						async.eachSeries(artifacts.directories, function(directory, callback) {
							mkdirsIfNecessary([targetDir + "/" + directory.name]);
							downloadHavenArtifactDirectory(directoryUrl + directory.name + "/", targetDir + "/" + directory.name, callback);
						}, function(err) {
							callback(err);
						});
					}
				], function(err) {
					callback(err);
				});
			} else {
				returnDependencyNotFoundError(name, version, callback);
			}
		});
	}

	function loadMavenArtifact(url, name, version, scope, includes, excludes, callback) {
		var group = loadHavenConfig().defaults.maven_group;
		var repoVersionDirUrl = url + "/" + group.replace(".", "/") + "/" + name + "/" + version;
		var pomUrl = repoVersionDirUrl + "/" + name + "-" + version + ".pom";
		var jarUrl = repoVersionDirUrl + "/" + name + "-" + version + ".jar";
		var localCache = loadHavenConfig().local_cache;
		var localCachePackageDir = localCache + "/" + name;
		var localCacheVersionDir = localCachePackageDir + "/" + version;
		var localCacheArtifactDir = localCacheVersionDir + "/artifact";
		var localCacheMavenDir = localCacheVersionDir + "/maven";
		async.waterfall([

			function(callback) {
				var req = request(pomUrl);
				req.on("response", function(resp) {
					if (resp.statusCode === 200) {
						mkdirsIfNecessary([localCache, localCachePackageDir, localCacheVersionDir, localCacheArtifactDir, localCacheMavenDir]);
						var stream = req.pipe(fs.createWriteStream(localCacheMavenDir + "/pom.xml"));
						stream.on("close", function() {
							callback();
						});
					} else {
						returnDependencyNotFoundError(name, version, callback);
					}
				});
			},
			function(callback) {
				var req = request(jarUrl);
				req.on("response", function(resp) {
					if (resp.statusCode === 200) {
						var stream = req.pipe(fs.createWriteStream(localCacheMavenDir + "/artifact.jar"));
						stream.on("close", function() {
							callback();
						});
					} else {
						returnDependencyNotFoundError(name, version, callback);
					}
				});
			},
			function(callback) {
				var zip = new AdmZip(localCacheMavenDir + "/artifact.jar");
				var zipEntries = zip.getEntries();
				var normalizedVersion = version;
				if (version.indexOf("-") > -1) {
					normalizedVersion = version.substring(0, version.indexOf("-"));
				}
				zipEntries.forEach(function(zipEntry) {
					if (zipEntry.entryName.search("/.*resources\/webjars\/" + name + "\/" + normalizedVersion + "\/.+") > -1) {
						var path = zipEntry.entryName.replace(new RegExp("^.*resources\/webjars\/" + name + "\/" + normalizedVersion + "\/"), "");
						if (path !== "webjars-requirejs.js") {
							zip.extractEntryTo(zipEntry.entryName, localCacheArtifactDir, false, true);
						}
					}
				});
				callback();
			},
			function(callback) {
				var havenConfig = {
					"name": name,
					"version": version
				}
				fs.readFile(localCacheMavenDir + "/pom.xml", function(err, result) {
					parser.parseString(result, function(err, result) {
						// TODO Put dependencies into haven config
						fs.writeFile(localCacheVersionDir + "/haven.json", JSON.stringify(havenConfig), function(err) {
							loadLocalArtifact(loadHavenConfig().local_cache, name, version, scope, includes, excludes, callback);
						});
					});
				});
			}
		], callback);
	}

	function loadBowerArtifact(url, name, version, scope, includes, excludes, callback) {
		bower.lookup(name, function(err, result) {
			if (result) {
				var ghurl = result.url;
				var ghdata = gh(ghurl);
				var localCache = loadHavenConfig().local_cache;
				var localCachePackageDir = localCache + "/" + name;
				var localCacheVersionDir = localCachePackageDir + "/" + version;
				var localCacheArtifactDir = localCacheVersionDir + "/artifact";
				var handleDownload = function(callback) {
					var havenConfig = {
							"name": name,
							"version": version
						}
						// TODO Extract bower dependencies from bower.json and add to haven.json
					fs.writeFile(localCacheVersionDir + "/haven.json", JSON.stringify(havenConfig), function(err) {
						loadLocalArtifact(loadHavenConfig().local_cache, name, version, scope, includes, excludes, callback);
					});
				};
				ghdownload(ghdata.user + "/" + ghdata.repo + "#" + version, localCacheArtifactDir, function(err) {
					if (err) {
						if (err == 404) {
							ghdownload(ghdata.user + "/" + ghdata.repo + "#v" + version, localCacheArtifactDir, function(err) {
								if (err) {
									if (err == 404) {
										returnDependencyNotFoundError(name, version, callback);
									} else {
										callback(err);
									}
								} else {
									handleDownload(callback);
								}
							});
						} else {
							callback(err);
						}
					} else {
						handleDownload(callback);
					}
				});
			} else {
				returnDependencyNotFoundError(name, version, callback);
			}
		});
	}

	function loadHavenConfig() {
		if (_havenConfig == null) {
			if (fs.existsSync("haven-config.json")) {
				_havenConfig = loadJSONFromFile("haven-config.json");
			} else {
				_havenConfig = loadJSONFromFile(__dirname + "/config.json");
			}
		}
		return _havenConfig;
	}

	function loadPackageConfig() {
		var _packageConfig = loadJSONFromFile("haven.json");
		return _packageConfig;
	}

	function savePackageConfig(config) {
		fs.writeFileSync("haven.json", JSON.stringify(config));
	}

	function loadJSONFromFile(path) {
		var json = fs.readFileSync(path, "utf-8");
		json = JSON.parse(json);
		return json;
	}

	function mkdirsIfNecessary(paths) {
		for (var i in paths) {
			var path = paths[i];
			if (!fs.existsSync(path)) {
				console.log("Creating directory " + path);
				fs.mkdirSync(path);
			}
		}
	}

	function deleteRecursiveSync(itemPath) {
		if (fs.existsSync(itemPath)) {
			if (fs.statSync(itemPath).isDirectory()) {
				var childItems = fs.readdirSync(itemPath);
				for (var i in childItems) {
					var childItemName = childItems[i];
					deleteRecursiveSync(path.join(itemPath, childItemName));
				}
				fs.rmdirSync(itemPath);
			} else {
				fs.unlinkSync(itemPath);
			}
		}
	}

	function returnDependencyNotFoundError(name, version, callback) {
		var e = new Error();
		e.code = "DependencyNotFoundException";
		e.message = "Dependency not found: " + name + " v." + version;
		callback(e);
	}
};