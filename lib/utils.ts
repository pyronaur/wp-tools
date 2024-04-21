
export async function $remote(host: string, command: string) {
	console.log(` > ${ansis.dim(host)}\n ${ansis.cyan(`${ansis.bold(`$`)} ${command}\n`)}`);
	return $spinner(($) => $`ssh ${host} '${{ raw: command }}'`);
}

export async function rsync(from: string, to: string, additionalFlags: string = '') {
	return $`rsync -az --delete --progress --human-readable ${from} ${to} ${{ raw: additionalFlags }}`;
}