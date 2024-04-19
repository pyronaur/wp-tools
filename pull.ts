/**
 * Pull a remote WordPress instance to a local environment.
 * @usage pull <domain.com> <username@hostname>
 * @flag --local_domain <domain.com> The local domain
 * @flag --with-config Include wp-config.php in the download
 */

import { $remote, getSiteInfo } from './_utils';


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

async function getFiles(REMOTE: string, PATH_REMOTE: string, PATH_LOCAL: string) {
	const excludeConfig = flags['with-config'] ? '' : '--exclude=wp-config.php';
	await $spinner("Downloading Source Files", ($) => {
		return $`rsync -azP ${REMOTE}:${PATH_REMOTE}/ ${PATH_LOCAL} ${excludeConfig} --exclude=wp-content/cache --exclude=wp-content/object-cache.php --delete`
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

export default async function () {
	const { DOMAIN, REMOTE, LOCAL_DOMAIN, PATH_REMOTE, PATH_LOCAL } = await getSiteInfo();

	header(`Migrating ${DOMAIN}...`);
	if (ack("Download Files?")) {
		await getFiles(REMOTE, PATH_REMOTE, PATH_LOCAL);
	}
	if (ack("Rewrite Config?")) {
		await rewriteConfig(PATH_LOCAL);
	}
	if (ack("Download Database?")) {
		await getDatabase(REMOTE, PATH_REMOTE, PATH_LOCAL);
		await insertDatabase(PATH_LOCAL, DOMAIN, LOCAL_DOMAIN);
	}

	if (ack("Search And Replace?")) {
		await $`wp search-replace ${DOMAIN} ${LOCAL_DOMAIN}`;
	}
	if (ack("Convert https to http?")) {
		await $`wp search-replace https://${LOCAL_DOMAIN} http://${LOCAL_DOMAIN}`;
	}
}
