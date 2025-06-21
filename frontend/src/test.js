import axios from "axios";

async function fetchPistonLanguages() {
    try {
        const response = await axios.get('https://emkc.org/api/v2/piston/runtimes');
        const runtimes = response.data;

        runtimes.forEach(runtime => {
            const language = runtime.language;
            const version = runtime.version;
            const aliases = runtime.aliases ? runtime.aliases.join(', ') : 'None';
            const runtimeName = runtime.runtime || 'N/A';

            console.log(`Language: ${language}`);
            console.log(`Version: ${version}`);
            console.log(`Aliases: ${aliases}`);
            console.log(`Runtime: ${runtimeName}`);
            console.log('---------------------------');
        });
    } catch (error) {
        console.error('Error fetching runtimes:', error.message);
    }
}

fetchPistonLanguages();
