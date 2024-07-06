import makeWASocket, 
	{ 
		DisconnectReason, 
		fetchLatestBaileysVersion, 
		makeCacheableSignalKeyStore, 
		useMultiFileAuthState, 
	} from '@whiskeysockets/baileys'
import pino from 'pino'
import { Boom } from '@hapi/boom'

const getLogger = () => {
	return pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` }).child({})
}

const startSocket = async (logger: pino.Logger) => {
	const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
	const { version, isLatest } = await fetchLatestBaileysVersion()

	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

	const socket = makeWASocket({
		version,
		logger,
		printQRInTerminal: true,
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
	})

	socket.ev.on("creds.update", async (update) => {
		await saveCreds()
	})

	socket.ev.on("connection.update", async (update) => {
		const { connection, lastDisconnect } = update;

		if (connection === "close") {
			const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
			if (shouldReconnect) {
				console.warn('Connection closed. Reconnecting...');
				startSocket(logger);
			} else {
				console.error('Logged out, not reconnecting.');
			}
		}

		if (connection === "open") {
			console.log('Connection opened.');     
			const [ result ] = await socket.onWhatsApp("123456789")
			console.log("RESULTADO => ", result)
		}

	})

	return socket
}

startSocket(getLogger())