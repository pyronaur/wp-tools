import { expect, test, describe } from "bun:test";
import { rsyncFileFilters } from "./utils";

describe("rsyncFileFilters", () => {
	test("Include a directory that is a direct sub-directory of an excluded directory", () => {
		const config = {
			excludes: {
				global: [],
				paths: [
					"a/b/c/"
				]
			},
			includes: [
				"a/b/c/d/"
			]
		};

		expect(rsyncFileFilters(config)).toEqual([
			"+ a/b/c/d/***",
			"+ a/b/c/",
			"+ a/b/c/d/",
			"- a/b/c/***",
		]);
	});

	test("Nested directories have to include the full path, each directory individually", () => {
		const config = {
			excludes: {
				global: [],
				paths: [
					"a/b/c/"
				]
			},
			includes: [
				"a/b/c/d/e/f/"
			]
		};
		expect(rsyncFileFilters(config)).toEqual([
			"+ a/b/c/d/e/f/***",
			"+ a/b/c/",
			"+ a/b/c/d/",
			"+ a/b/c/d/e/",
			"+ a/b/c/d/e/f/",
			"- a/b/c/***", 
		]);
	});

	test("Include a file that is directly in an excluded directory", () => {
		const config = {
			excludes: {
				global: [],
				paths: [
					"a/b/c/"
				]
			},
			includes: [
				"a/b/c/d.html"
			]
		};
		expect(rsyncFileFilters(config)).toEqual([
			"+ a/b/c/d.html",
			"+ a/b/c/",
			"- a/b/c/***",
		]);
	});
	

	test("Include a file, which is a sub-directory of an excluded directory", () => {
		const config = {
			excludes: {
				global: [],
				paths: [
					"a/b/c/"
				]
			},
			includes: [
				"a/b/c/d/e/f.html"
			]
		};

		expect(rsyncFileFilters(config)).toEqual([
			"+ a/b/c/d/e/f.html",
			"+ a/b/c/",
			"+ a/b/c/d/",
			"+ a/b/c/d/e/",
			"- a/b/c/***",
		]);
	});

	test("Global excludes take precedence and have a catch-all pattern on both sides", () => {
		const config = {
			excludes: {
				global: ["global_exclude"],
				paths: []
			},
			includes: []
		};
		expect(rsyncFileFilters(config)).toEqual([
			"- **global_exclude**",
		]);
	});
});