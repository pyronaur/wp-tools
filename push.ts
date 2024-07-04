/**
 * Push files from a local environment to a remote WordPress instance.
 * @usage push
 * @flag --with-config Include wp-config.php in the upload
 */
import { rsync } from './lib/utils';
import { getConfig } from './lib/config';

function header(text: string) {
	console.log(`===\n=== ${text}\n===`);
}

type PushFiles = {
	remote: string;
	remote_path: string;
	local_path: string;
	excludes: string[];
}

function trailingslashit( path: string) {
	return untrailingslashit(path) + '/';
}

function untrailingslashit( path: string) {
	return path.replace(/\/$/, '');
}

async function pushFiles({ remote, remote_path, local_path, excludes }: PushFiles) {

	excludes.push('wpt.json');
	const additionalFlags: string[] = [
		...excludes.map(exclude => `--exclude=${$.escape(exclude)}`),
		'--no-links'
	]

	await rsync(trailingslashit(local_path), `${remote}:${trailingslashit(remote_path)}`, additionalFlags.join(' '))
}

export default async function () {
	const config = await getConfig(await cwd());
	const PATH_REMOTE = config.path.remote;
	const PATH_LOCAL = config.path.local;
	const REMOTE = config.ssh_host;

	header(`Pushing files to ${config.domain.remote}...`);
	if (ack("Push Files?")) {
		await pushFiles({
			remote: REMOTE,
			remote_path: PATH_REMOTE,
			local_path: PATH_LOCAL,
			excludes: [...config.rsync.excludes, ...config.rsync.on_push?.excludes],
		});
	}
}
