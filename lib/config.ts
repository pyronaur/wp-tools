
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
		excludes: {
			global: string[];
			paths: string[];
		};
		includes: string[];
		on_pull?: {
			excludes?: {
				global: string[];
				paths: string[];
			};
			includes?: string[];
		},
		on_push?: {
			excludes?: {
				global: string[];
				paths: string[];
			};
			includes?: string[];
		},
		replace: {
			remote: string,
		local: string
		}[]
	}
	backup: {
		destination: string;
		excludes: {
			global: string[];
			paths: string[];
		};
		includes: string[];
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
			includes: [],
			excludes: {
				global: [],
				paths: [],
			},
			on_pull: {
				excludes: {
					global: [],
					paths: [],
				},
				includes: [],
			},
			on_push: {
				excludes: {
					global: [],
					paths: [],
				},
				includes: [],
			},
			replace: [],
		},
		backup: {
			destination: '',
			excludes: {
				global: [],
				paths: [],
			},
			includes: [],
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
		const input = await ask("Add Global Exclude");
		config.rsync.excludes.global.push(input);
	}

	while (ack("Add path-specific rsync exclude?")) {
		const input = await ask("Add Path Exclude");
		config.rsync.excludes.paths.push(input);
	}

	console.log(ansis.dim`Includes override excludes`);
	while (ack("Add global rsync include?")) {
		const input = await ask("Add Include");
		config.rsync.includes.push(input);
	}

	while (ack("Add global rsync exclude for pull?")) {
		const input = await ask("Global Exclude on Pull");
		config.rsync.on_pull.excludes.global.push(input);
	}

	while (ack("Add path-specific rsync exclude for pull?")) {
		const input = await ask("Path Exclude on Pull");
		config.rsync.on_pull.excludes.paths.push(input);
	}

	console.log(ansis.dim`Includes override excludes on pull`);
	while (ack("Add rsync include for pull?")) {
		const input = await ask("Include on Pull");
		config.rsync.on_pull.includes.push(input);
	}

	while (ack("Add global rsync exclude for push?")) {
		const input = await ask("Global Exclude on Push");
		config.rsync.on_push.excludes.global.push(input);
	}

	while (ack("Add path-specific rsync exclude for push?")) {
		const input = await ask("Path Exclude on Push");
		config.rsync.on_push.excludes.paths.push(input);
	}

	console.log(ansis.dim`Includes override excludes on push`);
	while (ack("Add rsync include for push?")) {
		const input = await ask("Include on Push");
		config.rsync.on_push.includes.push(input);
	}

	while (ack("Add post-pull database replace?")) {
		const remote = await ask("Replace Remote");
		const local = await ask("Replace Local");
		config.rsync.replace.push({ remote, local });
	}

	while (ack("Add global backup exclude?")) {
		const input = await ask("Global Backup Exclude");
		config.backup.excludes.global.push(input);
	}

	while (ack("Add path-specific backup exclude?")) {
		const input = await ask("Path Backup Exclude");
		config.backup.excludes.paths.push(input);
	}

	while (ack("Add Backup Include?")) {
		const input = await ask("Backup Include");
		config.backup.includes.push(input);
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
	config.rsync.excludes.global.push('.git', '.gitignore', '.gitmodules');

	return config as Config;
}

