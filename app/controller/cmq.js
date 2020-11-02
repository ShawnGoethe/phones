'use strict';
const amqp = require('amqplib');

class RabbitMQ {
    constructor() {
        this.open = amqp.connect(this.hosts[this.index]);
    }
    receiveQueueMsg(queueName, receiveCallBack, errCallBack) {
        const self = this;

        self.open
            .then(function(conn) {
                return conn.createChannel();
            })
            .then(function(channel) {
                return channel.assertQueue(queueName)
                    .then(function(ok) {
                        return channel.consume(queueName, function(msg) {
                            if (msg !== null) {
                                const data = msg.content.toString();
                                channel.ack(msg);
                                receiveCallBack && receiveCallBack(data);
                            }
                        })
                            .finally(function() {
                                setTimeout(() => {
                                    if (channel) {
                                        channel.close();
                                    }
                                }, 500);
                            });
                    });
            })
            .catch(function() {
                const num = self.index++;
                if (num <= self.length - 1) {
                    self.open = amqp.connect(self.hosts[num]);
                } else {
                    self.index = 0;
                    self.open = amqp.connect(self.hosts[0]);
                }
            });
    }
}
module.exports = RabbitMQ;
