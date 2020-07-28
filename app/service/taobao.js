'use strict';

const Service = require('egg').Service;
const TopClient = require('../../utils/topClient/api/topClient.js').TopClient;

class TaobaoService extends Service {
    async getInfo() {
        try {
            const { ctx } = this;
            const that = this;
            const client = new TopClient({
                appkey: '30116055',
                appsecret: '4118a19f959f832b850e211ae15b608c',
                REST_URL: 'https://eco.taobao.com/router/rest',
            });
            // const api = 'taobao.tbk.dg.material.optional';//物料
            const api = 'taobao.tbk.item.info.get';// 商品详情

            client.execute(api, {
                // adzone_id: '110371550409',
                page_size: 1,
                page_no: 1,
                num_iids: '611584116194',
            }, async function(error, response) {
                // if (!error) console.log(response.results.n_tbk_item[0], error);
                // return response.results;
                // console.log('ctx==>', ctx.model);
                const n = response.results.n_tbk_item[0];
                const r = await ctx.model.Phone.update({
                    nowPrice: n.zk_final_price,
                }, {
                    where: {
                        iid: n.num_iid,
                      },
                });
                console.log('r==>', r);
            });

        } catch (e) {
            console.log(e);
        }
    }
    getInfo2() {
        const client = new TopClient({
            appkey: '30116055',
            appsecret: '4118a19f959f832b850e211ae15b608c',
            REST_URL: 'http://gw.api.taobao.com/router/rest',
        });

        client.execute('taobao.item.seller.get', {
            fields: 'num_iid,title,nick,price,approve_status,sku',
            num_iid: '611224893062',
        }, function(error, response) {
            if (!error) console.log(response);
            else console.log(error);
        });
    }
}

module.exports = TaobaoService;
