'use strict';

const Service = require('egg').Service;
const TopClient = require('../../utils/topClient/api/topClient.js').TopClient;

class TaobaoService extends Service {
    async getInfo() {
        try {
            const { ctx } = this;
            const client = new TopClient({
                appkey: '30116055',
                appsecret: '4118a19f959f832b850e211ae15b608c',
                REST_URL: 'https://eco.taobao.com/router/rest',
            });
            // const api = 'taobao.tbk.dg.material.optional';
            const api = 'taobao.tbk.item.info.get';

            const { error, response } = await client.execute(api, {
                // adzone_id: '110371550409',
                page_size: 1,
                page_no: 1,
                num_iids: '598159055576',

            });
            if (!error) {

                for (const n of response.results.n_tbk_item) {
                    await ctx.model.Phone.updateOne({ where: { iid: n.num_iid } }, { nowPrice: n.zk_final_price });
                }
            }
            console.log(error);
        } catch (e) {
            console.log(e);
        }
    }
}

module.exports = TaobaoService;
