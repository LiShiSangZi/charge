const morgan = require('morgan');
const eggLogger = require('egg-logger');
const EggLogger = eggLogger.EggLogger;
const Transport = eggLogger.Transport;

class AccessTransport extends Transport {
  constructor(props) {
    super(props);
  }
  write(msg) {
    this._logger.write(msg);
  }
}

class AccessLogger extends EggLogger {
  constructor(props) {
    super(props);
    this.set('accessLogger', new AccessTransport({
      level: 'INFO',
    }));
  }
}

module.exports = (options, app) => {
  if (!options || !options.file) {
    throw new Error('没有配置访问日志文件。{config.accessLogger.file}');
  }
  const logFormat = ':remote-addr - :remote-user [:date[clf]]'
  + ' ":method :url HTTP/:http-version"'
  + ' ":status/:res[content-length]/:response-time ms"'
  + ' ":referrer" ":user-agent"';
  const logger = morgan(logFormat, {
    'stream': new AccessLogger({
      file: options.file,
    }),
  });
  return async (ctx, next) => {
    await new Promise((resolve, reject) => {
      logger(ctx.req, ctx.res, e => {
        e ? reject(e) : resolve(ctx);
      });
    });
    await next();
  };

};
