/**
 * Backup a WordPress site
 */
import { getConfig } from './lib/config';
import { $remote, $remoteFileExists } from './lib/utils';

function formatDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

async function verifyTarIntegrity(tarFile: string): Promise<void> {
	try {
		await $`tar -tvf ${tarFile}`;
		console.log(`Verified the integrity of ${tarFile}`);
	} catch (error) {
		throw new Error(`Failed to verify the integrity of ${tarFile}`);
	}
}

export default async function backup() {
	const config = await getConfig(await cwd());
	const { ssh_host, path, backup } = config;
	const { remote: remotePath } = path;
	const backupDestination = backup.destination.trim();

	const dateString = formatDate(new Date());
	const tmpName = `${config.domain.remote}-${dateString}`;
	const tmpDir = `/tmp/${tmpName}`;
	const filesDir = `${tmpDir}/files`;
	const dbFile = `${tmpDir}/db.sql`;
	const tarFile = `${tmpDir}.tar.gz`;

	// 1. Copy the site files to /tmp/site-{YYYY-MM-DD}/files
	if (await $remoteFileExists(ssh_host, filesDir, 'd') !== true) {
		await $remote(ssh_host, `mkdir -p ${filesDir} && cp -R ${remotePath}/ ${filesDir}`);
	} else {
		console.log('Site files already copied. Skipping step 1.');
	}

	// 2. Create a db.sql file in /tmp/site-{YYYY-MM-DD}/
	if (await $remoteFileExists(ssh_host, dbFile, 'f') !== true) {
		await $remote(ssh_host, `wp db export --path=${remotePath} ${dbFile}`);
	} else {
		console.log('Database export already exists. Skipping step 2.');
	}

	// 3. Create a tar.gz file out of the /tmp/site-{YYYY-MM-DD} directory
	if (await $remoteFileExists(ssh_host, tarFile, 'f') !== true) {
		await $remote(ssh_host, `tar -czf ${tarFile} -C ${tmpDir} .`);
	} else {
		console.log('Tar file already exists. Skipping step 3.');
	}

	// 4. Rsync the tar.gz file to the backup directory
	const localFile = `${backupDestination}/${tmpName}.tar.gz`
	if (await Bun.file(localFile).exists() === false) {
		await $`rsync --progress --human-readable ${ssh_host}:${tarFile} ${localFile}`
	} else {
		console.log(`'${localFile}' already exists. Skipping step 4.`);
	}

	// Verify the integrity of the downloaded tar.gz file
	await $spinner(`Verifying the integrity of ${localFile}`, () =>
		verifyTarIntegrity(localFile)
	);

	// 5. Remove the temporary files and directory
	await $remote(ssh_host, `rm -rf ${tmpDir} ${tarFile}`);
	console.log('Backup completed successfully!');
	console.log(`View Backup Directory: ${backupDestination}`);
}

