"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const yargs_1 = __importDefault(require("yargs/yargs"));
const serialport_1 = __importDefault(require("serialport"));
const log = console.log;
function logError(content) {
    log(chalk_1.default `{redBright ${content}}`);
}
function logSuccess(content) {
    log(chalk_1.default `{greenBright ${content}}`);
}
function logWarn(content) {
    log(chalk_1.default `{yellowBright ${content}}`);
}
const CR = 0x0d;
const LF = 0x0a;
const ACK = 0x06;
const ACK_STR = "\x06";
const NAK = 0x21;
const NAK_STR = "\x21";
const CANCEL = 0x18;
const CANCEL_STR = "\x18";
const ESC = 0x1b;
const ESC_STR = "\x1b";
const READ_WRITE_BUF_LEN = 4200;
let readBuffer;
let readBufferIdx;
function readAllIncomingBytes() {
    if (!readBuffer) {
        readBuffer = Buffer.alloc(READ_WRITE_BUF_LEN);
        readBufferIdx = 0;
    }
    const nextChar = vpro.read();
    if (nextChar && nextChar.constructor === Buffer) {
        nextChar.copy(readBuffer, readBufferIdx);
        readBufferIdx++;
        readAllIncomingBytes();
    }
}
/**
 * Wakes up the weather station per the Davis specs
 *
 */
async function wakeUpStation() {
    return new Promise((resolve, reject) => {
        vpro.write('\r', (err) => {
            if (err) {
                if (verbose) {
                    logError(`Could not wake up weather station`);
                }
                reject();
            }
            if (verbose) {
                logSuccess(`Woke up weather station`);
            }
            resolve();
        });
    });
}
/**
 * Turn display backlight on/off
 *
 * @param turnOn desired backlight state
 */
function switchBacklight(turnOn) {
    if (verbose) {
        log(`Turning backlight ${turnOn ? 'on' : 'off'}...`);
    }
    const buf = Buffer.from(`LAMPS ${turnOn ? '1' : '0'}\n`, 'ascii');
    vpro.write(buf, (err) => {
        if (err) {
            logError(`Failed to turn backlight ${turnOn ? 'on' : 'off'}`);
            return;
        }
        vpro.drain();
        if (verbose) {
            logSuccess(`Turned backlight ${turnOn ? 'on' : 'off'}`);
        }
    });
}
function getFirmwareVersion() {
    if (verbose) {
        log(`Getting firmware version...`);
        const buf = Buffer.from(`WRD${0x12}${0x4d}\n`, 'ascii');
        vpro.write(buf, (err) => {
            if (err) {
                logError(`Failed to get firmware version`);
                return;
            }
            vpro.drain();
            vpro.on('readable', () => {
                setTimeout(() => {
                    readAllIncomingBytes();
                    console.log(`Data: ${readBuffer.toString()}`);
                }, 1000);
            });
        });
    }
}
const argv = yargs_1.default(process.argv.slice(2))
    .scriptName('vproweather')
    .usage('$0 <cmd> [args]')
    .option('p', {
    alias: 'port',
    describe: 'Port the Vantage Pro Weather Station is connected to',
    demandOption: 'The port is required',
    type: 'string',
    nargs: 1,
})
    .option('verbose', {
    describe: 'Show verbose output',
    type: 'boolean'
})
    .option('bk', {
    alias: 'set-backlight',
    describe: 'turn backlight on/off',
    type: 'number',
    nargs: 1,
})
    .option('fw', {
    alias: 'firmware-version',
    describe: 'Query for Davis firmware version string',
})
    .describe('version', "Show version number")
    .help().argv;
const { p: port, verbose, fw } = argv;
const vpro = new serialport_1.default(port, {
    baudRate: 19200,
});
vpro.on('open', async () => {
    if (verbose) {
        logSuccess(`Serial port opened`);
    }
    // wake up station
    await wakeUpStation();
    if (fw) {
        getFirmwareVersion();
    }
});
