import { $ } from "bun";

export async function $remote(host: string, command: string) {
	console.log(` > ${ansis.dim(host)}\n ${ansis.cyan(`${ansis.bold(`$`)} ${command}\n`)}`);
	return $spinner(($) => $`ssh ${host} '${{ raw: command }}'`);
}

export async function $remoteFileExists(host: string, file: string, type: 'f' | 'd') {
	try {
		await $`ssh ${host} 'test -${type} ${file}'`.quiet();
		return true;
	} catch (error) {
		return false;
	}
}

type RsyncConfig = {
	includes: string[];
	excludes: {
		global: string[];
		paths: string[];
	};
};


/**
 * Generates rsync-compatible filter rules based on include and exclude lists.
 * This function takes arrays of paths of filenames and directories
 * that should be included or excluded.
 * 
 * More specific paths take precedence over less specific ones.
 * Our Rsync Adapter will:
 * 1. Include all files and directories by default
 * 2. Exclude files and directories that are explicitly excluded
 * 3. If there's an include with a more specific pattern than exclude,
 *    the exclude will be ignored
 * 4. If there's an exclude with a more specific pattern than the include,
 *    the include will be ignored
 * 5. Global excludes take precedence over includes and path excludes
 * 
 * The function handles the complexity of rsync's rule ordering to achieve the desired behavior.
 * 
 * Notes:
 * - `dir/` patterns ending with a slash are to be considered directory-wide rules
 * - `dir/file` patterns are to be considered file-specific rules
 */
export function rsyncFileFilters(config: RsyncConfig): string[] {
	const rules: string[] = [];

	// Handle global excludes first
	if (config.excludes.global.length > 0) {
		for (const globalExclude of config.excludes.global) {
			rules.push(`- **${globalExclude}**`);
		}
	}

	// Keep track of excludes that are not included in any include rule
	const excludes = new Map<string, string>();
	for (const exclude of config.excludes.paths) {
		excludes.set(exclude, exclude);
	}

	const includeRules = [];
	if (config.includes.length > 0) {
		for (const include of config.includes) {
			if (pathInExcludes(include, config.excludes.paths)) {

				const pattern = isFile(include) ? include : `${include}***`;
				includeRules.push(`+ ${pattern}`);

				const excludePaths = config.excludes.paths.filter(exclude => include.startsWith(exclude));
				if (excludePaths.length > 0) {
					const excludePath = excludePaths.sort((a, b) => b.length - a.length)[0];
					const includeDirs = pathToTarget(include, trailingslashit(excludePath));

					includeRules.push(`+ ${trailingslashit(excludePath)}`)

					if (includeDirs.length > 0) {
						includeRules.push(...includeDirs.map(dir => `+ ${trailingslashit(dir)}`));
					}

					includeRules.push(`- ${excludePath}***`);
					excludes.delete(excludePath);
				}
			}
		}
	}

	if (config.excludes.paths.length > 0) {
		for (const exclude of excludes.values()) {
			rules.push(`- ${exclude}***`);
		}
	}
	rules.push(...includeRules);

	return rules;
}

function trailingslashit(path: string) {
	return path.endsWith('/') ? path : path + '/';
}


function pathToTarget(target: string, parent: string) {
	const targetParts = target.split('/').filter(Boolean);
	const parentParts = parent.split('/').filter(Boolean);
	const result: string[] = [];

	const diffSize = isFile(target) ? targetParts.length - parentParts.length - 1 : targetParts.length - parentParts.length;
	if (diffSize <= 0) {
		return [];
	}

	// Start from the parent path length and build up to the include path, excluding the target itself
	for (let i = parentParts.length; i < targetParts.length - (isFile(target) ? 1 : 0); i++) {
		const path = targetParts.slice(0, i + 1).join('/');
		result.push(trailingslashit(path));
	}


	return result;
}

function isDirectory(path: string) {
	return path.endsWith('/');
}
function isFile(path: string) {
	return !isDirectory(path);
}
function pathInExcludes(path: string, excludes: string[]) {
	return excludes.some(exclude => path.startsWith(exclude));
}

export async function rsync(from: string, to: string, config: RsyncConfig & { additionalFlags: string }) {
	if ('dry-run' in flags && flags['dry-run']) {
		config.additionalFlags += ' --dry-run';
	}

	const fileFilterFlags = rsyncFileFilters(config)
		.map(rule => `--filter=${$.escape(rule.trim())}`)
		.join(' ');

	return $`rsync -avzi --delete --progress --human-readable ${from} ${to} ${{ raw: `${config.additionalFlags} ${fileFilterFlags}` }}`;
}