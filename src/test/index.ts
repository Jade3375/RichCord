import {IPC} from '../index'

const client = new IPC("420907324945989632") 

client.login()

let body = {
    cmd:"SET_ACTIVITY",
    args: {
        pid: process.pid,
        activity: {
        details: "RichCord",
        state:"Made with love",
        type: 0,
        assets: {
            large_image: "43373",
            large_text: "top text",
            small_image: "43373",
            small_text: "bottom text"
        },
        buttons: [{label: 'discord', url: "https://discord.gg/uyEQkTT"}, {label: 'github', url: 'https://github.com/Jade3375/RichCord'}]
    },
    },
    nonce: "a76a42c0-802d-4c01-23c5-018d61f3499f"
}

client.on("ready", () => {
    client.setStatus(body)
})
