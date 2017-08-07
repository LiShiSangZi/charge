'use strict';

const assert = require('assert');
const mock = require('egg-mock');
const request = require('supertest');
const uuidV4 = require('uuid/v4');
// const config = require('../../config/config.default.js');
const Sequelize = require('sequelize');



describe('test/service/login.test.js', () => {
  let app;
  before(() => {
    app = mock.app();
    return app.ready();
  });
  afterEach(mock.restore);

  xit('test liveload', async() => {
    await new Promise((resolve, reject) => {
      setInterval(() => {
        for (let i = 0; i < 2; i++) {
          app.curl('http://10.0.101.53:7001', {
            method: 'GET',
            dataType: 'json',
          }).then(res => {
            console.log(res.data.error_message);
          });
        }
      }, 100);
    });
    console.log('gogogo');
  });

  xit('test the deduct schedule', async() => {
    await app.model.sync();
    await app.runSchedule('deduct');
  });

  it('process the update structure of the table', async() => {
    await app.model.sync();

    // Ready the query interface:
    const queryInterface = app.model.getQueryInterface();
    const desc = await queryInterface.describeTable('charge');

    if (!desc.consumption) {
      await queryInterface.addColumn('charge', 'consumption', {
        type: app.Sequelize.DECIMAL(20, 4),
        defaultValue: 0,
      });
    }

    if (!desc.expired_at) {
      await queryInterface.addColumn('charge', 'expired_at', app.Sequelize.BIGINT);
    }

    if (!desc.expired) {
      await queryInterface.addColumn('charge', 'expired', {
        type: app.Sequelize.ENUM('Y', 'N'),
        defaultValue: 'N',
      });
    }
  });

  xit('process the migrate of the order', async() => {
    const config = app.config;
    const sourceConfig = config.sourceGringottsDB;
    const SourceModel = new Sequelize(sourceConfig.database, sourceConfig.database, sourceConfig.password, {
      host: sourceConfig.host,
      dialect: sourceConfig.dialect,
      logging: false,
    });
    const targetConfig = config.destBillingDB;
    const DestModel = new Sequelize(targetConfig.database, targetConfig.database, targetConfig.password, {
      host: targetConfig.host,
      dialect: targetConfig.dialect,
      logging: false,
    });

    console.log('Initilize the table...');
    await app.model.sync();
    await app.model.Account.sync();
    await app.model.Project.sync();

    console.log('Fetch the account and project from gringotts...');
    const users = await SourceModel.query('SELECT * FROM account, keystone.user where keystone.user.id = account.user_id', {
      type: Sequelize.QueryTypes.SELECT
    });

    const projects = await SourceModel.query('select * from project, keystone.project where project.project_id = keystone.project.id', {
      type: Sequelize.QueryTypes.SELECT
    });

    const userMap = new Map();

    const userData = [];
    users.forEach((user, index) => {
      userMap.set(user.user_id, user);
      let status = 'active';
      if (user.deleted !== 0) {
        status = 'deleted';
      }
      const consumption = user.consumption || 0;
      userData[index] = `('${user.user_id}', ${user.balance}, ${consumption}, 'CNY', ${user.level}, ${user.owed}, '${user.domain_id}', '', 0, 0, '', '${status}', ${user.frozen_balance}, '${user.created_at}', '${user.updated_at}')`;
    });

    console.log('Save account...');

    await DestModel.query(`INSERT INTO account (user_id, balance, consumption, currency, level, owed, domain_id, inviter, charged, reward_value, sales_id, status, frozen_balance, created_at, updated_at) VALUES ${userData.join(',')}`);
  });
});
