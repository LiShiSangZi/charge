'use strict';

module.exports = agent => {
  agent.messenger.on('egg-ready', (data) => {
    agent.messenger.sendRandom('init-job', data);
  });
};