'use strict';
const cleanerBase = require('./testerResourcesCleaner.js');
/**
 * Clean resources are created by Debors due to out-of-balance account.
 * Step 1: Collect users whose level_binary[1] is 0, include level 0, 1, 4, 5
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
            console.log(`Find all debtors...`);
            const debtorIds = await ctx.app.model.query(`SELECT user_id FROM account where status != 'deleted' and level in (0, 1, 4, 5) and balance < 0`, {
                type: ctx.app.Sequelize.QueryTypes.SELECT
            });
            console.log(`debtor ids: `, debtorIds);
            console.log(`Find Server resources belonging to Debtors...`);
            const reqs = await cleanerBase.findTargetResources(ctx, debtorIds);
            console.log(`Start to clean resources belonging to Debtors...`);
            const res = await Promise.all(reqs);
            console.log(`Clean result about Debtors' resources:`);
            res.forEach(res => {
                if (res.statusCode >= 400) {
                    console.log("%o", res)
                }
            });
            console.log(`Done.`);
        },
    };
};