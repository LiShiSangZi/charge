const eggLogger = require('egg-logger');
const EggLogger = eggLogger.EggLogger;
const Transport = eggLogger.Transport;

class ErrorTransport extends Transport {
  constructor(props) {
    super(props);
  }
  write(msg) {
    this._logger.write(msg);
  }
}

class ErrorLogger extends EggLogger {
  constructor(props) {
    super(props);
    this.set('errorLogger', new ErrorTransport({
      level: 'ERROR',
    }));
  }
}

module.exports = (options, app) => {
  if (!options || !options.file) {
    throw new Error('没有配置访问错误日志文件。{config.errorHandler.file}');
  }
  const errorLogger = new ErrorLogger({
    file: options.file,
  });
  return async (ctx, next) => {
    try {
      await next();
    } catch (e) {
      const errorTime = new Date();
      const errorId = errorTime.getTime() + '-' + Math.random().toString(16).slice(2);
      let {status, message, requestUrl, responseError} = getErrResObj(e.response);

      if (!status) {
        status = 500;
      }
      if (!message && e.message) {
        message = e.message;
      } else {
        message = 'There is an error occurred.'
      }

      ctx.status = status;
      ctx.body = {
        error_id: errorId,
        error_message: message,
      };

      const formattedError = renderError(ctx, e, errorTime, errorId, status, message, requestUrl, responseError);
      errorLogger.write(formattedError);

      ctx.app.emit('error', e, this);
    }
  };
}

function getErrResObj(errRes) {
  const obj = {
    status: null,
    message: null,
    requestUrl: null,
    error: null,
  };
  if (typeof errRes !== 'object') {
    return obj;
  }

  obj.error = errRes.error;
  const error = errRes.error || {};

  let body = null;
  let text = null;
  const _body = errRes.body;
  if (typeof _body === 'object') {
    body = _body;
    text = errRes.text;
  } else {
    text = _body || errRes.text;
    try {
      body = JSON.parse(text);
    } catch (e) {}
  }

  if (body) {
    obj.message = errRes.body.message || errRes.body.msg;
    obj.errorCode = errRes.body.errorCode || errRes.body.code;
  } else if (text) {
    obj.message = text;
  } else if (error && error.message) {
    obj.message = error.message;
  } else {
    obj.message = null;
  }

  const status = errRes.status || error.status;
  if (typeof status === 'number' && status > 99 && status < 1000) {
    obj.status = status;
  } else {
    obj.status = null;
  }

  if (errRes.request) {
    obj.requestUrl = errRes.request.url;
  }
}

function renderError(ctx, error, errorTime, errorId, status, message, requestUrl, responseError) {
  message = message || 'N/A';
  requestUrl = requestUrl || 'N/A';
  const method = ctx.request.method ? ctx.request.method.toUpperCase() : 'N/A';
  const ip = ctx.request.ip || 'N/A';
  const url = ctx.request.url || 'N/A';
  const errorStack = error.stack || 'N/A';
  const errorMessage = error.message || 'N/A';
  const responseErrorStack = responseError ? responseError.stack || 'N/A' : 'N/A';
  const responseErrorMessage = responseError ? responseError.message || 'N/A' : 'N/A';
  return `
- ${errorTime.toISOString()} -------
  > ERROR-ID      < : ${errorId}
  > ERROR-IP      < : ${ip}
  > ERROR-URL     < : ${url}
  > ERROR-TIME    < : ${errorTime}
  > ERROR-METHOD  < : ${method}
  > ERROR-STATUS  < : ${status}
  > ERROR-REQUEST < : ${requestUrl}
  > ERROR-MESSAGE    < :
        ${errorMessage}
  > ERROR-RESPONSE-MESSAGE  < :
        ${responseErrorMessage}
  > ERROR-STACK          < :
        ${errorStack}
  > ERROR-RESPONSE-STACK < :
        ${responseErrorStack}
`;
}
