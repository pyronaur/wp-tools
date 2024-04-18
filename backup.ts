/**
 * Backup a remote WordPress database.
 * @usage backup <domain.com> <username@hostname> <backup_path>
 */

import { $remote, getSiteInfo } from './_utils';
import { getDatabase } from './pull';


export default async function () {
	const { DOMAIN, REMOTE, PATH_REMOTE } = await getSiteInfo();
	if (!args[2]) {
		throw new Error("Missing required arguments. Usage: backup <domain.com> <username@hostname> <backup_path>");
	}

	const BACKUP_PATH = args[2];

	console.log(`===\nBacking up database for ${DOMAIN}...\n===`);
	await getDatabase(REMOTE, PATH_REMOTE, '/tmp');
	const backupDirExists = await isDirectory(BACKUP_PATH);
	if (!backupDirExists) {
		console.log(`Creating backup directory at ${BACKUP_PATH}`);
		await $`mkdir -p ${BACKUP_PATH}`;
	}
	const backupFileName = `${new Date().toISOString().split('T')[0]}-${DOMAIN}.tar.gz`;
	await $`mv /tmp/db.tar.gz ${BACKUP_PATH}/${backupFileName}`;
	console.log(ansis.green(`Database backup complete. Stored at ${BACKUP_PATH}/${backupFileName}`));
}


