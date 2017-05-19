'use strict';

/**
 * Migrate the user data from gringotts.
 */

const mm = require('egg-mock');


const config = require('../config/config.default.js');
const Sequelize = require('sequelize');
const Account = require('./model-account');

const targetConfig = config.destBillingDB;
const sourceConfig = config.sourceGringottsDB;


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

  await DestModel.query(`CREATE TABLE IF NOT EXISTS \`account\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`user_id\` char(36) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  \`balance\` decimal(20,4) DEFAULT '0.0000',
  \`consumption\` decimal(20,4) DEFAULT '0.0000',
  \`currency\` varchar(64) DEFAULT 'CNY',
  \`level\` int(11) DEFAULT '0',
  \`owed\` tinyint(1) DEFAULT '0',
  \`domain_id\` char(36) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  \`inviter\` varchar(64) DEFAULT NULL,
  \`charged\` decimal(20,4) DEFAULT '0.0000',
  \`reward_value\` decimal(20,4) DEFAULT '0.0000',
  \`sales_id\` char(36) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  \`status\` enum('active','deactive','deleted') DEFAULT 'active',
  \`frozen_balance\` decimal(20,4) DEFAULT '0.0000',
  \`created_at\` datetime NOT NULL,
  \`updated_at\` datetime NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`account_user_id\` (\`user_id\`)
) ENGINE=InnoDB AUTO_INCREMENT=340 DEFAULT CHARSET=utf8;`);

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

  await DestModel.query(`CREATE TABLE IF NOT EXISTS \`project\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`user_id\` char(36) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  \`project_id\` char(36) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL,
  \`consumption\` decimal(20,4) DEFAULT '0.0000',
  \`domain_id\` varchar(255) DEFAULT NULL,
  \`status\` enum('active','deactive','deleted') DEFAULT 'active',
  \`created_at\` datetime NOT NULL,
  \`updated_at\` datetime NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`project_user_id_project_id_domain_id\` (\`user_id\`,\`project_id\`,\`domain_id\`),
  CONSTRAINT \`project_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`account\` (\`user_id\`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1225 DEFAULT CHARSET=utf8;`);

  await DestModel.query(`INSERT INTO project (user_id, project_id, consumption, domain_id, status, created_at, updated_at) VALUES ${projectData.join(', ')}`);

}

action().then(() => {
  console.log('Done');
  process.exit(0);
});