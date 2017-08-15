'use strict';

/**
 * Heatbeat API for LB health check.
 */
process.on('message', (r) => {
  if (r === 'closing') {
    global.closing = true;
  }
});
exports.check = async(ctx) => {
  if (global.closing === true) {
    ctx.throw(400);
  } else {
    ctx.body = 'OK';
  }
};

exports.ping = async (ctx) => {
  setTimeout(() => ctx.body = process.pid, 1000);
};
