/**
 * Pull a remote WordPress instance to a local environment.
 * @usage pull
 * @flag --with-config Include wp-config.php in the download
 */
import { $remote, rsync } from './lib/utils';
import { getConfig } from './lib/config';

function header(text: string) {
	console.log(`===\n=== ${text}\n===`);
}

export async function getDatabase(REMOTE: string, PATH_REMOTE: string, PATH_LOCAL: string) {
	console.log(ansis.bold(`Downloading the database`));
	await $remote(REMOTE, `cd /tmp && wp db export --path=${PATH_REMOTE} /tmp/db.sql`);
	await $remote(REMOTE, `cd /tmp && tar -czf db.tar.gz db.sql`);
	try {
		await $spinner(`rsync ${REMOTE}:/tmp/db.tar.gz ${PATH_LOCAL}`, ($) => {
			return $`rsync ${REMOTE}:/tmp/db.tar.gz ${PATH_LOCAL}`
		})
	} finally {
		await $remote(REMOTE, `rm -f /tmp/db.sql /tmp/db.tar.gz`);
	}
}

type GetFiles = {
	remote: string;
	remote_path: string;
	local_path: string;
	excludes: string[];
}
async function getFiles({ remote, remote_path, local_path, excludes }: GetFiles) {

	excludes.push('wpt.json');
	const additionalFlags: string[] = [
		...excludes.map(exclude => `--exclude=${$.escape(exclude)}`),
		'--no-links'
	]

	await rsync(`${remote}:${remote_path}/`, local_path, additionalFlags.join(' '))
}

type DbConfig = {
	DB_USER: string;
	DB_PASSWORD: string;
	DB_NAME: string;
	DB_HOST: string;
}

function matchConstant(constant: string, content: string) {
	const regex = new RegExp(`define\\(\\s*['"]${constant}['"]\\s*,\\s*['"]([^'"]+)['"]\\s*\\);`, "gim");
	const match = regex.exec(content);
	return match ? match[1] : null;
}

async function rewriteConfig(PATH_LOCAL: string) {
	let config = await Bun.file(`${PATH_LOCAL}/wp-config.php`).text();

	const existingConfig: DbConfig = {
		DB_USER: matchConstant("DB_USER", config) ?? "root",
		DB_PASSWORD: matchConstant("DB_PASSWORD", config) ?? "",
		DB_NAME: matchConstant("DB_NAME", config) ?? "",
		DB_HOST: matchConstant("DB_HOST", config) ?? "localhost"
	} as const;

	for (const key of Object.keys(existingConfig)) {
		const existingValue = existingConfig[key as keyof DbConfig];
		const value = prompt(`${key}: `, existingValue);
		config = config.replace(existingValue, value.trim());
	}
	await Bun.write(`${PATH_LOCAL}/wp-config.php`, config);
}

async function insertDatabase(PATH_LOCAL: string, DOMAIN: string, LOCAL_DOMAIN: string) {
	const config = await Bun.file(`${PATH_LOCAL}/wp-config.php`).text();
	const DB_NAME = matchConstant("DB_NAME", config);
	await $`tar -xzf db.tar.gz -C . && mysql -u root ${DB_NAME} < db.sql`;
	await $`wp search-replace ${DOMAIN} ${LOCAL_DOMAIN}`;
	if (ack('Delete db.tar.gz?')) {
		await $`rm db.tar.gz db.sql`;
	}
}

async function searchAndReplace(pairs: { local: string, remote: string }[]) {
	for (const { local, remote } of pairs) {
		await $`wp search-replace ${remote} ${local}`;
	}
}

export default async function () {
	const config = await getConfig(await cwd());
	const DOMAIN = config.domain.remote;
	const LOCAL_DOMAIN = config.domain.local;
	const PATH_REMOTE = config.path.remote;
	const PATH_LOCAL = config.path.local;
	const REMOTE = config.ssh_host;



	header(`Migrating ${DOMAIN}...`);
	if (ack("Download Files?")) {
		const wpConfigPath = `${PATH_LOCAL}/wp-config.php`;
		const configExists = await Bun.file(wpConfigPath).exists();
		const wpConfig = configExists ? await Bun.file(wpConfigPath).text() : null;

		await getFiles({
			remote: REMOTE,
			remote_path: PATH_REMOTE,
			local_path: PATH_LOCAL,
			excludes: [...config.rsync.excludes, ...config.rsync.on_pull?.excludes],
		});

		if (wpConfig && await Bun.file(wpConfigPath).exists()) {
			const newWpConfig = await Bun.file(wpConfigPath).text();
			if (newWpConfig !== wpConfig && ack("Rewrite wp-config.php?")) {
				await rewriteConfig(PATH_LOCAL);
			}
		}
	}


	if (ack("Download Database?")) {
		await getDatabase(REMOTE, PATH_REMOTE, PATH_LOCAL);
		await insertDatabase(PATH_LOCAL, DOMAIN, LOCAL_DOMAIN);
		if (ack("Search And Replace?")) {
			await searchAndReplace(config.rsync.replace);
		}
	}


}

