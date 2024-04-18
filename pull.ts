/**
 * Sync a remote WordPress instance with Local.
 * @usage pull <domain> <username@hostname>
 * @flag --remote The remote host
 */

import { $remote } from './_utils';

if (typeof args[0] !== 'string' || args[0].length === 0) {
	throw new Error("Domain must be a non-empty string.");
}
if (typeof args[1] !== 'string' || args[1].length === 0) {
	throw new Error("Remote must be a non-empty string.");
}
const DOMAIN = args[0];
const REMOTE = args[1];
const LOCAL_DOMAIN = typeof flags.local_domain === 'string' ? flags.local_domain : DOMAIN.split('.')[0] + '.local';
const PATH_REMOTE = `/sites/${DOMAIN}/files`;
const PATH_LOCAL = await cwd();

if (!REMOTE) {
	throw new Error("Use --remote to specify the remote host");
}

function header(text: string) {
	console.log(`===\n=== ${text}\n===`);
}

async function getDatabase() {
	console.log(ansis.bold(`Downloading the database`));
	await $remote(REMOTE, `cd /tmp && wp db export --path=${PATH_REMOTE} /tmp/db.sql`);
	await $spinner(`rsync ${REMOTE}:/tmp/db.sql ${PATH_LOCAL}`, ($) => {
		return $`rsync ${REMOTE}:/tmp/db.sql ${PATH_LOCAL}`
	})
	await $remote(REMOTE, `rm -f /tmp/db.sql`);
}

async function getFiles() {
	await $spinner("Downloading Source Files", ($) => {
		return $`rsync -azP ${REMOTE}:${PATH_REMOTE}/ ${PATH_LOCAL} --exclude=wp-content/cache --exclude=wp-config.php --delete`
	});
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

async function rewriteConfig() {
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
		config = config.replace(existingValue, value);
	}
	await Bun.write(`${PATH_LOCAL}/wp-config.php`, config);
}

async function insertDatabase() {
	const config = await Bun.file(`${PATH_LOCAL}/wp-config.php`).text();
	const DB_NAME = matchConstant("DB_NAME", config);
	await $`mysql -u root -e "USE ${DB_NAME}; SOURCE db.sql;"`;
	await $`wp search-replace ${DOMAIN} ${LOCAL_DOMAIN}`;
	if (ack('Delete db.sql?')) {
		await $`rm db.sql`;
	}
}

export default async function () {
	header(`Migrating ${DOMAIN}...`);
	if (ack("Download Files?")) {
		await getFiles();
	}
	if (ack("Rewrite Config?")) {
		await rewriteConfig();
	}
	if (ack("Download Database?")) {
		await getDatabase();
		await insertDatabase();
	}
}

