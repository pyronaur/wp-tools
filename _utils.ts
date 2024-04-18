
export async function $remote(host: string, command: string) {
	console.log(` > ${ansis.dim(host)}\n ${ansis.cyan(`${ansis.bold(`$`)} ${command}\n`)}`);
	return $spinner(($) => $`ssh ${host} '${{ raw: command }}'`);
}