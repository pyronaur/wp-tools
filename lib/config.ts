
export type Config = {
	ssh_host: string;
	path: {
		remote: string;
		local: string;
	}
	domain: {
		remote: string;
		local: string;
	}
	rsync: {
		excludes: string[];
		includes: string[];
		filters: string[];
		on_pull?: {
			excludes?: string[];
			includes?: string[];
		},
		on_push?: {
			excludes?: string[];
			includes?: string[];
		},
		replace: {
			remote: string,
			local: string
		}[]
	}
	backup: {
		destination: string;
		excludes: string[];
		filters: string[];
	}

}


export const log = {
	group: (group: string, message: string) => {
		console.log(ansis.dim(group), message);
	}
}

async function configFilePath() {
	return path.resolve(await cwd(), 'wpt.json');
}

async function setupConfig() {
	const config: Config = {
		ssh_host: '',
		path: {
			remote: '',
			local: '',
		},
		domain: {
			remote: '',
			local: '',
		},
		rsync: {
			excludes: [],
			filters: [],
			on_pull: {
				excludes: [],
				includes: [],
			},
			on_push: {
				excludes: [],
				includes: [],
			},
			replace: [],
		},
		backup: {
			destination: '',
			excludes: [],
			filters: [],
		},
	};

	console.log("Please enter the configuration details:");
	config.ssh_host = await ask("SSH Host (username@hostname)", config.ssh_host, 'required');
	config.path.remote = await ask("Remote Path", config.path.remote, 'required');
	config.path.local = await ask("Local Path", config.path.local, 'required');
	config.domain.remote = await ask("Remote Domain", config.domain.remote, 'required');
	config.domain.local = await ask("Local Domain", config.domain.local, 'required');
	config.backup.destination = await ask("Backup Destination", config.backup.destination, 'required');

	while (ack("Add global rsync exclude?")) {
		const input = await ask("Add Exclude");
		config.rsync.excludes.push(input);
	}

	while (ack("Add global rsync filter?")) {
		const input = await ask("Add Filter");
		config.rsync.filters.push(input);
	}

	while (ack("Add rsync exclude for pull?")) {
		const input = await ask("Exclude on Pull");
		config.rsync.on_pull.excludes.push(input);
	}

	while (ack("Add rsync exclude for push?")) {
		const input = await ask("Exclude on Push");
		config.rsync.on_push.excludes.push(input);
	}

	while (ack("Add post-pull database replace?")) {
		const remote = await ask("Replace Remote");
		const local = await ask("Replace Local");
		config.rsync.replace.push({ remote, local });
	}

	while (ack("Add Backup Exclude?")) {
		const input = await ask("Backup Exclude");
		config.backup.excludes.push(input);
	}

	while (ack("Add Backup Filter?")) {
		const input = await ask("Backup Filter");
		config.backup.filters.push(input);
	}

	await Bun.write(await configFilePath(), JSON.stringify(config, null, 4));
}


export async function getConfig(directory: string) {
	cd(directory);
	const configFile = await configFilePath();
	const file = Bun.file(configFile);
	if (! await file.exists()) {
		await setupConfig();
	}
	const config = await Bun.file(configFile).json();

	// Tweak the config
	config.path.local = directory;
	config.rsync.filters.push('.git', '.gitignore', '.gitmodules');

	return config as Config;
}

