
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

export async function rsync(from: string, to: string, additionalFlags: string = '') {
	return $`rsync -avz --delete --progress --human-readable ${from} ${to} ${{ raw: additionalFlags }}`;
}