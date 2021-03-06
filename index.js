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
    log(chalk_1.default `{green ${content}}`);
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
/**
 * Remove trailing 0x00 from a buffer
 *
 * @param buf source buffer
 */
function trimBufferEnd(buf) {
    let idx = 0;
    for (let i = buf.length - 1; i >= 0; i--) {
        if (buf[i] !== 0x00) {
            idx = i;
            break;
        }
    }
    return buf.slice(0, idx + 1);
}
/**
 * Read bytes from serial until buffer is empty, return true while characters are available
 */
function readAllIncomingBytes() {
    if (!readBuffer) {
        readBuffer = Buffer.alloc(READ_WRITE_BUF_LEN);
        readBufferIdx = 0;
    }
    const nextChar = vpro.read();
    if (nextChar && nextChar.constructor === Buffer) {
        nextChar.copy(readBuffer, readBufferIdx);
        readBufferIdx++;
        return true;
    }
    const buf = trimBufferEnd(readBuffer);
    readBuffer = undefined;
    return buf;
}
/**
 * Wakes up the weather station per the Davis specs
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
            vpro.drain();
            setTimeout(() => {
                resolve();
            }, 200);
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
/**
 * Get display firmware version
 */
function getFirmwareVersion() {
    if (verbose) {
        log(`Getting firmware version...`);
        const buf = Buffer.from(`VER\n`, 'ascii');
        vpro.write(buf, (err) => {
            if (err) {
                logError(`Failed to get firmware version`);
                return;
            }
            vpro.drain();
            vpro.on('readable', () => {
                setTimeout(() => {
                    let res = true;
                    while (res === true) {
                        res = readAllIncomingBytes();
                    }
                    if (res.constructor === Buffer) {
                        console.log(`
                        Data: ${res.toString('hex')}
                        Length: ${res.length}
                        `);
                    }
                    process.exit(0);
                }, 1000);
            });
        });
    }
}
/**
 * Get display model
 */
function getModel() {
    if (verbose) {
        log(`Getting model...`);
        const buf = Buffer.from(`WRD\x12\x4d\n`, 'ascii');
        vpro.write(buf, (err) => {
            if (err) {
                logError(`Failed to get firmware version`);
                return;
            }
            vpro.drain();
            vpro.on('readable', () => {
                setTimeout(() => {
                    const readBuf = vpro.read(4);
                    if (readBuf && readBuf.constructor === Buffer) {
                        const modelCode = readBuf.readUInt8(3);
                        let model;
                        switch (modelCode) {
                            case 0:
                                model = 'Wizard III';
                                break;
                            case 1:
                                model = 'Wizard II';
                                break;
                            case 2:
                                model = 'Monitor';
                                break;
                            case 3:
                                model = 'Perception';
                                break;
                            case 4:
                                model = 'GroWeather';
                                break;
                            case 5:
                                model = 'Energy Environmonitor';
                                break;
                            case 6:
                                model = 'Health Environmonitor';
                                break;
                            case 16:
                                model = 'Vantage Pro';
                                break;
                            default:
                                model = 'Unknown model';
                                break;
                        }
                        logSuccess(`Display model: ${model}`);
                    }
                    process.exit(0);
                }, 2000);
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
    .option('b', {
    alias: 'set-backlight',
    describe: 'turn backlight on/off',
    type: 'number',
    nargs: 1,
})
    .option('f', {
    alias: 'firmware-version',
    describe: 'Query for Davis firmware version string',
})
    .option('m', {
    alias: 'model',
    describe: 'Query for weather station model',
})
    .describe('version', "Show version number")
    .help().argv;
const { p: port, verbose, f: firmware, bk: backlight, m: model } = argv;
const vpro = new serialport_1.default(port, {
    baudRate: 19200,
});
vpro.on('open', async () => {
    if (verbose) {
        logSuccess(`Serial port opened`);
    }
    // wake up station
    await wakeUpStation();
    if (firmware) {
        getFirmwareVersion();
    }
    else if (backlight !== undefined) {
        if (backlight === 0) {
            switchBacklight(false);
        }
        else {
            switchBacklight(true);
        }
    }
    else if (model) {
        getModel();
    }
});
