'use strict';

/**
 * Migrate the user data from gringotts.
 */
const config = require('../config/config.default.js');
const Sequelize = require('sequelize');
const Account = require('./model-account');

const targetConfig = config.destBillingDB;
const sourceConfig = config.sourceGringottsDB;

const ariesConfig = config.ariesDB;

const SourceModel = new Sequelize(sourceConfig.database, sourceConfig.database, sourceConfig.password, {
  host: sourceConfig.host,
  dialect: sourceConfig.dialect
});
const DestModel = new Sequelize(targetConfig.database, targetConfig.database, targetConfig.password, {
  host: targetConfig.host,
  dialect: targetConfig.dialect
});

const DestAccount = Account({
  model: DestModel,
  Sequelize: Sequelize,
});

const action = async() => {
  // const source = await SourceAccount.listAccountMap();

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

  await DestModel.query(`INSERT INTO account (user_id, balance, consumption, currency, level, owed, domain_id, inviter, charged, reward_value, sales_id, status, frozen_balance, created_at, updated_at) VALUES ${userData.join(',')}`);


  const projectData = [];
  projects.forEach((project, index) => {
    let userId = project.user_id;
    
    if (!userId || userMap.get(userId) === undefined) {
      userId = null;
    } else {
      userId = `'${userId}'`;
    }
    const consumption = project.consumption || 0;

    projectData[index] = `(${userId}, '${project.project_id}', ${consumption}, '${project.domain_id}', 'active', '${project.created_at}', '${project.updated_at}')`;
  });

  await DestModel.query(`INSERT INTO project (user_id, project_id, consumption, domain_id, status, created_at, updated_at) VALUES ${projectData.join(', ')}`);
}

action().then(() => {
  console.log('Done');
  process.exit(0);
});