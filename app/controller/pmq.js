'use strict';
const amqp = require('amqplib');

class RabbitMQ {
    constructor() {
        this.hosts = [ 'amqp://tbjd.xyz' ];
        this.index = 0;
        this.length = this.hosts.length;
        this.open = amqp.connect({
            protocol: 'amqp',
            hostname: 'tbjd.xyz',
            port: '5672',
            username: 'admin',
            password: 'lpclpyzzh2012',
            vhost: '/',
        });
    }
    sendQueueMsg(queueName, msg, errCallBack) {
        const self = this;

        self.open
            .then(function(conn) {
                return conn.createChannel();
            })
            .then(function(channel) {
                return channel.assertQueue(queueName).then(function() {
                    return channel.sendToQueue(queueName, new Buffer(msg), {
                        persistent: true,
                    });
                })
                    .then(function(data) {
                        if (data) {
                            errCallBack && errCallBack('success');
                            channel.close();
                        }
                    })
                    .catch(function() {
                        setTimeout(() => {
                            if (channel) {
                                channel.close();
                            }
                        }, 500);
                    });
            })
            .catch(function() {
                const num = self.index++;

                if (num <= self.length - 1) {
                    self.open = amqp.connect(self.hosts[num]);
                } else {
                    self.index === 0;
                }
            });
    }
}
module.exports = RabbitMQ;
