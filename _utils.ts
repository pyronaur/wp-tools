
export async function $remote(host: string, command: string) {
	console.log(` > ${ansis.dim(host)}\n ${ansis.cyan(`${ansis.bold(`$`)} ${command}\n`)}`);
	return $spinner(($) => $`ssh ${host} '${{ raw: command }}'`);
}

export async function getSiteInfo() {

	if (args.length < 2) {
		throw new Error("Missing required arguments. Usage: pull <domain.com> <username@hostname>");
	}
	if (typeof args[0] !== 'string' || args[0].length === 0) {
		throw new Error("Domain must be a non-empty string.");
	}
	if (typeof args[1] !== 'string' || args[1].length === 0) {
		throw new Error("Remote must be a non-empty string in the format username@hostname.");
	}

	const DOMAIN = args[0];
	const REMOTE = args[1];
	const LOCAL_DOMAIN = typeof flags.local_domain === 'string' ? flags.local_domain : DOMAIN.split('.')[0] + '.local';
	const PATH_REMOTE = `/sites/${DOMAIN}/files`;
	const PATH_LOCAL = await cwd();
	return {
		DOMAIN,
		REMOTE,
		LOCAL_DOMAIN,
		PATH_REMOTE,
		PATH_LOCAL
	}
}