module.exports = function(grunt) {
	grunt.initConfig({
		jasmine_node: {
			matchall: false, // load only specs containing specNameMatcher
			specNameMatcher: "haven-spec",
			projectRoot: ".",
			requirejs: false,
			forceExit: true,
			jUnit: {
				report: false,
				savePath: "./build/reports/jasmine/",
				useDotNotation: true,
				consolidate: true
			}
		}
	});

	grunt.loadNpmTasks('grunt-jasmine-node');

	grunt.registerTask('test', 'jasmine_node');
};