var haven = require("../src/haven.js").haven;
var fs = require("fs");

describe("Haven", function() {

	process.chdir("test");
	var workingDir = process.cwd();
	var havenCachePath = "../../test-target/";

	haven.getConfig().local_cache = havenCachePath;

	beforeEach(function() {
		process.chdir(workingDir);
	});

	describe("#install", function() {
		it("should install the artifact to the local cache", function() {
			process.chdir("test-artifact_1");
		 	haven.cleanCache();
		 	haven.install();
		 	expect(fs.existsSync(havenCachePath + "haven-test-artifact-1/0.1.0/haven.json")).toBe(true);
		 	expect(fs.existsSync(havenCachePath + "haven-test-artifact-1/0.1.0/artifact/test.txt")).toBe(true);
		 	expect(fs.existsSync(havenCachePath + "haven-test-artifact-1/0.1.0/artifact/test2.txt")).toBe(true);
		 	expect(fs.existsSync(havenCachePath + "haven-test-artifact-1/0.1.0/artifact/directory/another.txt")).toBe(true);
		 	expect(fs.readFileSync(havenCachePath + "haven-test-artifact-1/0.1.0/artifact/test.txt", "utf-8")).toBe("This is a test");
		 });
		it("should install multiple artifacts to the local cache", function() {
		 	process.chdir("test-artifact_2");
		 	haven.install();
		 	expect(fs.existsSync(havenCachePath + "haven-test-artifact-2/0.1.0/haven.json")).toBe(true);
		 	expect(fs.existsSync(havenCachePath + "haven-test-artifact-2/0.1.0/artifact/test.txt")).toBe(true);
		 	expect(fs.existsSync(havenCachePath + "haven-test-artifact-2-other/0.1.0/artifact/test2.txt")).toBe(true);
		});
        it("should not allow releases with snapshot dependencies", function() {
		 	process.chdir("test-artifact-with-snapshot-dependencies");
            try{
                haven.install();
                expect(1).toBe(2); // Should never be called - no fail() method
            }catch(e){
                expect(e.code).toBe("SnapshotDependencyException");
            }
		});
	});

	describe("#deploy", function() {
		it("should deploy the artifacts to the haven-repository", function(done) {
			process.chdir("test-artifact_3");
			haven.deploy(function(err) {
				var havenRepositoryPath = "/rsl/haven-repository/";
				expect(fs.existsSync(havenRepositoryPath + "haven-test-artifact-3/0.1.0/haven.json")).toBe(true);
				expect(fs.existsSync(havenRepositoryPath + "haven-test-artifact-3/0.1.0/artifact/test.txt")).toBe(true);
				expect(fs.existsSync(havenRepositoryPath + "haven-test-artifact-3/0.1.0/artifact/test2.txt")).toBe(true);
				expect(fs.existsSync(havenRepositoryPath + "haven-test-artifact-3/0.1.0/artifact/directory/another.txt")).toBe(true);
				expect(fs.readFileSync(havenRepositoryPath + "haven-test-artifact-3/0.1.0/artifact/test.txt", "utf-8")).toBe("This is a test");
				done();
			});
		});
	});

	describe("#update", function() {
		 it("should load test-artifact from local cache", function(done) {
		 	process.chdir("test-artifact-with-dependencies");
		 	haven.clean();
		 	haven.update(function(err) {
		 		expect(fs.existsSync("haven_artifacts/main/haven-test-artifact-1/test.txt")).toBe(true);
		 		expect(fs.existsSync("haven_artifacts/main/haven-test-artifact-1/test2.txt")).toBe(true);
		 		expect(fs.existsSync("haven_artifacts/main/haven-test-artifact-1/directory/another.txt")).toBe(true);
		 		expect(fs.readFileSync("haven_artifacts/main/haven-test-artifact-1/test.txt", "utf-8")).toBe("This is a test");
		 		done();
		 	});
		 });
		 it("should load test dependencies", function(done) {
		 	process.chdir("test-artifact-with-test-dependencies");
		 	haven.clean();
		 	haven.update(function() {
		 		expect(fs.existsSync("haven_artifacts/main/haven-test-artifact-2/test.txt")).toBe(true);
		 		expect(fs.existsSync("haven_artifacts/test/haven-test-artifact-2-other/test2.txt")).toBe(true);
		 		done();
		 	});
		 });
		it("should load transient dependencies", function(done) {
			process.chdir("test-artifact-with-test-dependencies");
			haven.install();
			process.chdir("../test-artifact-with-transient-dependencies");
			haven.clean();
			haven.update(function() {
				expect(fs.existsSync("haven_artifacts/main/haven-test-artifact-with-test-dependencies/test.txt")).toBe(true);
				expect(fs.existsSync("haven_artifacts/main/haven-test-artifact-2/test.txt")).toBe(true);
				expect(fs.existsSync("haven_artifacts/test/haven-test-artifact-2-other/test2.txt")).toBe(false);
				done();
			});
		});
		 it("should fail if dependency isn't found", function() {
		 	process.chdir("test-artifact-with-bad-dependencies");
		 	haven.clean();
			haven.update(function(err) {
		 		expect(err.message).toBe("Dependency not found: zzzyyyxxx v.9.8.7");
		 	});
		 });
		it("should load test-artifact-3 from haven repository", function(done) {
			process.chdir("test-artifact-with-haven-dependencies");
			haven.clean();
			haven.update(function(err) {
				expect(fs.existsSync("haven_artifacts/main/haven-test-artifact-3/test.txt")).toBe(true);
				expect(fs.existsSync("haven_artifacts/main/haven-test-artifact-3/test2.txt")).toBe(true);
				expect(fs.existsSync("haven_artifacts/main/haven-test-artifact-3/directory/another.txt")).toBe(true);
				expect(fs.readFileSync("haven_artifacts/main/haven-test-artifact-3/test.txt", "utf-8")).toBe("This is a test");
				done();
			});
		});
		it("should load jquery from the central maven repository", function(done) {
		 	process.chdir("test-artifact-with-maven-dependencies");
		 	haven.clean();
		 	haven.update(function(err) {
		 		expect(fs.existsSync("haven_artifacts/main/jquery/jquery.js")).toBe(true);
		 		expect(fs.existsSync("haven_artifacts/main/jquery/jquery.min.js")).toBe(false);
		 		done();
		 	});
		 });
		it("should load angular-loading-bar from the central bower repository", function(done) {
			process.chdir("test-artifact-with-bower-dependencies");
			haven.clean();
			haven.update(function(err) {
				expect(fs.existsSync("haven_artifacts/main/angular-loading-bar/loading-bar.js")).toBe(true);
				done();
			});
		});
	});

	describe("#clean", function() {
		it("should remove the haven artifacts directory", function() {
			process.chdir("test-artifact-with-dependencies");
			haven.clean();
			expect(fs.existsSync("haven_artifacts")).toBe(false);
		});
	});

	describe("#cleanCache", function() {
		it("should remove the haven cache directory", function() {
			process.chdir("test-artifact_1");
			haven.cleanCache();
			expect(fs.existsSync(havenCachePath)).toBe(false);
		})
	});

});