'use strict';

const Service = require('egg').Service;
const TopClient = require('../../utils/topClient/api/topClient.js').TopClient;

class TaobaoService extends Service {
    async getInfo() {
        try {
            const { ctx } = this;
            const phones = await ctx.model.Phone.findAll();
            let iid = phones[0].iid;
            for (let i = 1; i < phones.length; i++) {
                if (phones[i].iid)iid = iid + ',' + phones[i].iid;
            }
            const infoClient = new TopClient({
                appkey: '30116055',
                appsecret: '4118a19f959f832b850e211ae15b608c',
                REST_URL: 'https://eco.taobao.com/router/rest',
            });
            const meterialClient = new TopClient({
                appkey: '30116055',
                appsecret: '4118a19f959f832b850e211ae15b608c',
                REST_URL: 'http://gw.api.taobao.com/router/rest',
            });
            const meterialApi = 'taobao.tbk.dg.material.optional';// 物料
            const productApi = 'taobao.tbk.item.info.get';// 商品详情

            infoClient.execute(productApi, {
                // adzone_id: '110371550409',
                page_size: 1,
                page_no: 1,
                num_iids: iid,
            }, async function(error, response) {
                // if (!error) console.log(response.results.n_tbk_item[0], error);
                // return response.results;
                // console.log('ctx==>', ctx.model);
                for (const n of response.results.n_tbk_item) {
                    const p = await ctx.model.Phone.findAll({ where: { iid: n.num_iid } });
                    meterialClient.execute(meterialApi, {
                        adzone_id: '110371550409',
                        has_coupon: true,
                        is_tmall: true,
                        sort: 'total_sales_desc',
                        q: p[0].dataValues.key,
                    }, async function(error, meterial) {
                        if (!error) console.log(meterial.result_list.map_data[0].coupon_share_url);
                        else console.log(error);
                        const desc = meterial.result_list.map_data[0].coupon_share_url;
                        await ctx.model.Phone.update({
                            nowPrice: n.zk_final_price,
                            desc: desc.substring(2),
                            iid: n.num_iid,
                        }, {
                            where: {
                                id: p[0].dataValues.id,
                              },
                        });
                        // console.log('meterial==>', meterial, error);
                    });
                }
            });

        } catch (e) {
            console.log(e);
        }
    }
    async getInfo2() {
        const { ctx } = this;
        const phones = await ctx.model.Phone.findAll();
        const client = new TopClient({
            appkey: '30116055',
            appsecret: '4118a19f959f832b850e211ae15b608c',
            REST_URL: 'http://gw.api.taobao.com/router/rest',
        });
        for (const p of phones) {
            client.execute('taobao.tbk.dg.material.optional', {
                adzone_id: '110371550409',
                has_coupon: true,
                is_tmall: true,
                sort: 'total_sales_desc',
                q: p.key,
            }, async function(error, meterial) {
                const desc = meterial.result_list.map_data[0].coupon_share_url;
                const iid = meterial.result_list.map_data[0].item_id;
                const nowPrice = meterial.result_list.map_data[0].sale_price;
                await ctx.model.Phone.update({
                            nowPrice,
                            desc: desc.substring(2),
                            iid,
                        }, {
                            where: {
                                id: p.id,
                              },
                        });
            });
        }

    }
}

module.exports = TaobaoService;
