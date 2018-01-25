'use strict';
/**
 * +----------------+
 * | type           |
 * +----------------+
 * | server         |
 * | image          |
 * | floatingip     |
 * | volume         |
 * | snapshot       |
 * | router-archive |
 * | router         |
 * | listener       |
 * | volumesboot    |
 * | caas_service   |
 * | backup         |
 * | caas_volume    |
 * | backup  X      |
 * | backup  X      |
 * +----------------+
 */
const findTargetResources = async function(ctx, ids) {
    const targetResources = await ctx.app.model.query(`SELECT resource_id, type, region FROM \`order\` where status != 'deleted' and user_id in (${ids.map(r => "'" + r["user_id"] + "'").join(',')})`, {
        type: ctx.app.Sequelize.QueryTypes.SELECT
    });
    const resourceModule = {
        "server": "nova",
        "floatingip": "neutron",
        "volume": 'cinder',
    };
    const tokenObj = await ctx.service.token.getToken();
    const reqs = targetResources.map(resource => {
        const endpoint = tokenObj.endpoint[resourceModule[resource.type]][resource.region || 'RegionOne'];
        return ctx.curl(`${endpoint}/${resource.type}s/${resource.resource_id}`, {
            method: 'DELETE',
            dataType: 'json',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': tokenObj.token,
            },
            timeout: 5000,
        });
    });
    return reqs
}
/**
 * Cleaner resources are created by Tester at regular intervals.
 * Step 1: Collect users whose level_binary[2] is 1, include level 1, 3, 5, 7
 * Step 2: Delete each kinds of resources in turn.
 */
module.exports = app => {
    return {
        schedule: {
            cron: `0 0 0 7 * *`,
            type: 'worker',
            disable: true,
        },
        async task(ctx) {
            console.log(`Find all testers...`);
            const testerIds = await ctx.app.model.query(`SELECT user_id FROM account where status != 'deleted' and level in (1, 3, 5, 7)`, {
                type: ctx.app.Sequelize.QueryTypes.SELECT
            });
            console.log(`tester ids: `, testerIds);
            console.log(`Find Server resources belonging to Testers...`);
            const reqs = await findTargetResources(ctx, testerIds);
            console.log(`Start to clean resources belonging to Testers...`);
            const res = await Promise.all(reqs);
            console.log("Clean result about Testers' resources:");
            res.forEach(res => {
                if (res.statusCode >= 400) {
                    console.log("%o", res)
                }
            });
            console.log(`Done.`);
        },
    };
};
module.exports.findTargetResources = findTargetResources;