const WebSocket = require('ws');
const Common = require('./common.js').Common;
const TmcCodec = require('./tmcCodec.js').TmcCodec;
const util = require('../topUtil.js');

const codec = new TmcCodec();
let client;
const TmcClient = function TmcClient(appkey, appsecret, groupName) {
    this._appkey = appkey;
    this._appsecret = appsecret;
    this._groupName = groupName;
    this._uri = 'ws://mc.api.taobao.com/';
    this._ws = null;
    this.isReconing = false;
    this._callback = null;
    this._interval = null;
    client = this;
};


TmcClient.prototype.createSign = function(timestamp) {
    let basestring = this._appsecret;
    basestring += 'app_key' + this._appkey;
    basestring += 'group_name' + this._groupName;
    basestring += 'timestamp' + timestamp;
    basestring += this._appsecret;
    return util.md5(basestring).toUpperCase();
};

TmcClient.prototype.createConnectMessage = function() {
    const msg = {};
    msg.messageType = Common.enum.MessageType.CONNECT;
    const timestamp = Date.now();
    const content = {
        app_key: this._appkey,
        group_name: this._groupName,
        timestamp: timestamp + '',
        sign: this.createSign(timestamp),
        sdk: 'NodeJS-1.2.0',
        intranet_ip: util.getLocalIPAdress(),
    };
    msg.content = content;
    const buffer = codec.writeMessage(msg);
    return buffer;
};

TmcClient.prototype.createPullMessage = function() {
    const msg = {};
    msg.protocolVersion = 2;
    msg.messageType = Common.enum.MessageType.SEND;
    const content = {
        __kind: Common.enum.MessageKind.PullRequest,
    };
    msg.token = client._token;
    msg.content = content;
    const buffer = codec.writeMessage(msg);
    return buffer;
};

TmcClient.prototype.createConfirmMessage = function(id) {
    const msg = {};
    msg.protocolVersion = 2;
    msg.messageType = Common.enum.MessageType.SEND;
    const content = {
        __kind: Common.enum.MessageKind.Confirm,
        id,
    };
    msg.token = client._token;
    msg.content = content;
    const buffer = codec.writeMessage(msg);
    return buffer;
};

TmcClient.prototype.autoPull = function() {
    if (client._ws) {
        client._ws.send(client.createPullMessage(), { binary: true, mask: true });
    }
};

TmcClient.prototype.reconnect = function(duration) {
    if (this.isReconing) { return; }

    this.isReconing = true;
    setTimeout(function timeout() {
        client.connect(client._uri, client._callback);
    }, duration);
};

TmcClient.prototype.connect = function(uri, callback) {
    this._uri = uri;
    this._callback = callback;

    if (client._ws != null) {
        client._ws.close();
    }

    const ws = new WebSocket(this._uri);

    ws.on('open', function open() {
        client._ws = ws;
        this.send(client.createConnectMessage(), { binary: true, mask: true });
        if (!client._interval) {
            client._interval = setInterval(client.autoPull, 5000);
        }
    });

    ws.on('message', function(data, flags) {
        if (flags.binary) {
            const message = codec.readMessage(data);
            if (message != null && message.messageType == Common.enum.MessageType.CONNECTACK) {
                if (message.statusCode) {
                    throw new Error(message.statusPhase);
                } else {
                    client._token = message.token;
                    console.log('top message channel connect success, token = ' + message.token);
                }
            } else if (message != null && message.messageType == Common.enum.MessageType.SEND) {
                const status = { success: true };
                try {
                    client._callback(message, status);
                } catch (err) {
                    status.success = false;
                }
                if (status.success) {
                    ws.send(client.createConfirmMessage(message.id), { binary: true, mask: true });
                }
            } else {
                console.log(message);
            }
        }
    });

    ws.on('ping', function(data, flags) {
        ws.pong(data, { mask: true }, true);
    });

    ws.on('error', function(reason, errorCode) {
        console.log('tmc client error,reason : ' + reason + ' code : ' + errorCode);
        console.log('tmc client channel closed begin reconnect');
        client._ws = null;
        client.reconnect(15000);
    });

    ws.on('close', function close() {
        console.log('tmc client channel closed begin reconnect');
        client._ws = null;
        client.reconnect(3000);
    });
    this.isReconing = false;
};

exports.TmcClient = TmcClient;
