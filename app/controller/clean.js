'use strict';
exports.clean = async ctx => {
    if (ctx.params.who == 'tester') {
        await ctx.app.runSchedule('testerResourcesCleaner');
    }
    if (ctx.params.who == 'debtor') {
        await ctx.app.runSchedule('debtorResourcesCleaner');
    }
    ctx.body = {
        result: "Clean over",
    };
}