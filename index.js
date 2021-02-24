"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk = __importStar(require("chalk"));
const yargs_1 = __importDefault(require("yargs/yargs"));
const serialport_1 = __importDefault(require("serialport"));
const log = console.log;
const { redBright: logError, greenBright: logSuccess, yellowBright: logWarn } = chalk;
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
 * @param attempt the current attempt at waking up the station
 */
function wakeUpStation(attempt) {
    const maxAttempts = 3;
    if (attempt < maxAttempts) {
        vpro.write('\r', (err) => {
            if (err && attempt < maxAttempts) {
                wakeUpStation(attempt + 1);
                return;
            }
            if (verbose) {
                log(logSuccess(`Woke up weather station in ${attempt} attempt(s)`));
            }
        });
        return;
    }
    log(logError(`Could not wake up weather station`));
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
            log(logError(`Failed to turn backlight ${turnOn ? 'on' : 'off'}`));
            return;
        }
        vpro.drain();
        if (verbose) {
            log(logSuccess(`Turned backlight ${turnOn ? 'on' : 'off'}`));
        }
    });
}
function getFirmwareVersion() {
    if (verbose) {
        log(`Getting firmware version...`);
        const buf = Buffer.from(`WRD${0x12}${0x4d}\n`, 'ascii');
        vpro.write(buf, (err) => {
            if (err) {
                log(logError(`Failed to get firmware version`));
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
const { p: port, verbose } = argv;
const vpro = new serialport_1.default(port, {
    baudRate: 19200,
});
vpro.on('open', () => {
});
