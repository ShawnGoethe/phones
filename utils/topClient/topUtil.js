'use strict'
const crypto = require('crypto');
const util = require('util');
const stream = require('stream');

/**
 * hash
 *
 * @param {String} method hash method, e.g.: 'md5', 'sha1'
 * @param {String|Buffer} s
 * @param {String} [format] output string format, could be 'hex' or 'base64'. default is 'hex'.
 * @return {String} md5 hash string
 * @public
 */
exports.hash = function hash(method, s, format) {
    const sum = crypto.createHash(method);
    const isBuffer = Buffer.isBuffer(s);
    if (!isBuffer && typeof s === 'object') {
        s = JSON.stringify(sortObject(s));
    }
    sum.update(s, isBuffer ? 'binary' : 'utf8');
    return sum.digest(format || 'hex');
};

/**
 * md5 hash
 *
 * @param {String|Buffer} s
 * @param {String} [format] output string format, could be 'hex' or 'base64'. default is 'hex'.
 * @return {String} md5 hash string
 * @public
 */
exports.md5 = function md5(s, format) {
    return exports.hash('md5', s, format);
};

exports.YYYYMMDDHHmmss = function(d, options) {
    d = d || new Date();
    if (!(d instanceof Date)) {
        d = new Date(d);
    }

    let dateSep = '-';
    let timeSep = ':';
    if (options) {
        if (options.dateSep) {
            dateSep = options.dateSep;
        }
        if (options.timeSep) {
            timeSep = options.timeSep;
        }
    }
    let date = d.getDate();
    if (date < 10) {
        date = '0' + date;
    }
    let month = d.getMonth() + 1;
    if (month < 10) {
        month = '0' + month;
    }
    let hours = d.getHours();
    if (hours < 10) {
        hours = '0' + hours;
    }
    let mintues = d.getMinutes();
    if (mintues < 10) {
        mintues = '0' + mintues;
    }
    let seconds = d.getSeconds();
    if (seconds < 10) {
        seconds = '0' + seconds;
    }
    return d.getFullYear() + dateSep + month + dateSep + date + ' ' +
        hours + timeSep + mintues + timeSep + seconds;
};

exports.checkRequired = function(params, keys) {
    if (!Array.isArray(keys)) {
        keys = [ keys ];
    }
    for (let i = 0, l = keys.length; i < l; i++) {
        const k = keys[i];
        if (!params.hasOwnProperty(k)) {
            const err = new Error('`' + k + '` required');
            err.name = 'ParameterMissingError';
            return err;
        }
    }
};

exports.getApiResponseName = function(apiName) {
    const reg = /\./g;
    if (apiName.match('^taobao')) { apiName = apiName.substr(7); }
    return apiName.replace(reg, '_') + '_response';
};

exports.getLocalIPAdress = function() {
    const interfaces = require('os').networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
};

/**
 * Simple Utility Methods for checking information about a value.
 *
 * @param  {Mixed}  value  Could be anything.
 * @return {Object}
 */

exports.is = function(value) {
    return {
        a(check) {
            if (check.prototype) check = check.prototype.constructor.name;
            const type = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
            return value != null && type === check.toLowerCase();
        },
    };
};
