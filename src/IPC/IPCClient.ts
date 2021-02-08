import net from "net"
import { EventEmitter } from "ws"
import util from "util"

export class IPC extends EventEmitter{
    id: string
    socket: any
    logging: boolean
    ready: boolean

    //just to help with decoding ws data
    private working = {
        full: '',
        op: undefined
    }

    //diffrent OP codes
    OPCodes = {
        HANDSHAKE: 0,
        FRAME: 1,
        CLOSE: 2,
        PING: 3,
        PONG: 4,
      };

    /**
     * 
     * @param clientID applications client id
     * @param logging {boolean} Optional: log incomming data from IPC connnection
     */
    public constructor(clientID: string, logging: boolean = false) {
        super()
        if(!clientID) {
            throw new TypeError(`invalid application ID`)
        }
        this.id = clientID
        this.socket = null
        this.logging = logging
        this.ready = false
    }

    /**
     * 
     * @param op {number} OPCode to send
     * @param data {JSON} json encoded string
     * @returns {Buffer} Buffer
     */
    public encode(op: number, data: any) {
        data = JSON.stringify(data);
        const len = Buffer.byteLength(data);
        const packet = Buffer.alloc(8 + len);
        packet.writeInt32LE(op, 0);
        packet.writeInt32LE(len, 4);
        packet.write(data, 8, len);
        return packet;
    }

    /**
     * 
     * @param id {number} id to find the ipc pipe
     */
    private getIPCPath(id: number) {
        if (process.platform === 'win32') {
            return `\\\\?\\pipe\\discord-ipc-${id}`;
        }
        const { env: { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } } = process;
        const prefix = XDG_RUNTIME_DIR || TMPDIR || TMP || TEMP || '/tmp';
        return `${prefix.replace(/\/$/, '')}/discord-ipc-${id}`;
    }

    /**
     * 
     * @param id {number} shouldnt need to call this
     */
    private getIPC(id = 0) {
        return new Promise<net.Socket>((resolve: any ,reject) => {
            let path = this.getIPCPath(id);
            let onerror = () => {
                if(id < 10) {
                    resolve(this.getIPC(id + 1))
                } else {
                    reject(new Error('Could not connect'))
                }
            }
            const sock = net.createConnection(path, () => {
                sock.removeListener('error', onerror);
                resolve(sock)
            })
            sock.once('error', onerror)
        })
    }

    /**
     * 
     * @param socket {net.Socket} socket connection for client
     * @param callback {JSON} callback function
     */
    private decode(socket: any, callback: any) {
        let packet = socket.read()
        if(!packet) {
            return
        }
        let {op} = this.working
        let raw
        if(this.working.full === '') {
            op = this.working.op = packet.readInt32LE(0);
            const len = packet.readInt32LE(4)
            raw = packet.slice(8, len + 8)
        } else {
            raw = packet.toString()
        }
  
        try {
            const data = JSON.parse(this.working.full + raw)
            callback({op, data});
            this.working.full = ''
            this.working.op = undefined
        } catch (err) {
            this.working.full += raw
        }
        this.decode(socket, callback)
    }

    /**
     * 
     * @param body json encoded body for status
     */
    public setStatus(body: any) {
        this.socket.write(this.encode(this.OPCodes.FRAME, body))
    }

    //connects to the discord IPC server
    public async login() {
        this.socket = await this.getIPC()
        
        //handshake with IPC socket
        this.socket.write(this.encode(this.OPCodes.HANDSHAKE, {
            v:1,
            client_id: this.id
        }))
    
        this.socket.pause()
        
        //incomming socket data
        this.socket.on('readable', () => {
            this.decode(this.socket, ({op, data}: any) => {
                if(this.ready == false) {
                    this.emit("ready")
                    this.ready = true
                }
                //optional logging
                if(this.logging) {
                    console.log(`OPCode: ${op}, \nData: ${util.inspect(data)}`)
                }
                //doubt i need this but just incase discord wants to ping us
                switch (op) {
                    case this.OPCodes.PING:
                            this.socket.write(this.encode(this.OPCodes.PING, data))
                        break;
                
                    default:
                        break;
                }
            })
        })
    }

}