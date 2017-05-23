'use strict';

const assert = require('assert');
const mock = require('egg-mock');
const request = require('supertest');
const uuidV4 = require('uuid/v4');
const config = require('../../config/config.default.js');
const Sequelize = require('sequelize');

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

describe('test/controller/middleware.test.js', () => {
  let app;
  before(() => {
    app = mock.app();
    return app.ready();
  });
  afterEach(mock.restore);

  it('process the migrate of the order', async() => {

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

    console.log('Save project...');
    await DestModel.query(`INSERT INTO project (user_id, project_id, consumption, domain_id, status, created_at, updated_at) VALUES ${projectData.join(', ')}`);




    console.log('Read the product');

    const products = await app.model.Product.findAll();
    const ctx = app.mockContext();
    for (let i = 0; i < products.length; i++) {
      const product = products[i];


      const [module, tag, ...rest] = product.name.split(':');

      if (!module || !tag) {
        console.log('The product name should look like ${module}:${type}.');
        continue;
      }
      if (module === 'nova' && tag === 'server' && rest.length < 1) {
        console.log('You need to speicific flavor for nova server\'s product.');
        continue;
      } else if (module === 'cinder') {
        if (rest.length < 1) {
          if (tag === 'volume') {
            console.log('You need to speicific the volume type.');
            continue;
          }
        }
      }

      /**
       * TODO: 扫描所有现有的资源，找到所有相关的资源，并且生成新的order。
       */
      const region = product.region_id || 'RegionOne';
      let service = ctx.service;

      if (service && service[module] && service[module][tag]) {
        service = ctx.service[module][tag];
      } else {
        service = ctx.service.common;
      }

      /**
       * Fetch all the project list so that we can provide the domain_id and project_id for order.
       * We may not be able to provide the user_id as we do not know the user created the resource.
       */
      const query = {
        module: 'keystone',
        region: product.region_id || 'RegionOne',
      };

      const endpointObj = await service.getTokenAndEndpoint(query);
      let resources;
      try {
        resources = await service.getFullResources(module, tag, region, rest);
      } catch (e) {
        continue;
      }

      const keyFields = `${tag}s`;
      if (resources && resources[keyFields]) {
        const priceObj = JSON.parse(product.unit_price);

        const cachedProjects = {};

        const orders = [];
        const deducts = [];
        const now = Date.now();
        for (let resource of resources[keyFields]) {
          const opt = await service.generateOption(resource, module, tag, query.region);
          const projectId = await service.getProjectId(resource);
          let projectOpt = cachedProjects[projectId];
          if (!projectOpt) {
            projectOpt = await ctx.model.Project.findProjectWithAccountById(projectId);
            cachedProjects[projectId] = projectOpt;
          }

          if (!projectOpt || !projectOpt.user_id) {
            // The project does not have billing owner. Skip this.
            continue;
          }

          const body = opt.request;
          const resp = opt.response;
          const amount = await service.getProductAmount(body, opt);
          const price = ctx.service.price.calculatePrice(priceObj, amount);
          const attr = service.getResourceAttribute(body, resp, opt.tag);

          const deductId = uuidV4();
          const orderId = uuidV4();

          attr.unit_price = price;
          attr.region = region;
          attr.project_id = projectId;
          attr.domain_id = projectOpt.domain_id;
          attr.user_id = projectOpt.user_id;
          attr.type = opt.tag;
          attr.product_id = product.product_id;
          attr.order_id = orderId;
          attr.deduct_id = deductId;
          // await ctx.model.Order.createOrder(attr);
          orders.push(attr);

          deducts.push({
            deduct_id: deductId,
            resource_id: attr.resource_id,
            type: attr.type,
            price: attr.unit_price,
            order_id: orderId,
            updated_at: now,
            created_at: now,
          });
        }

        const p1 = ctx.model.Order.bulkCreate(orders);
        const p2 = ctx.model.Deduct.bulkCreate(deducts);

        await Promise.all([p1, p2]);
      }

    }
  });
});



// describe('test/controller/middleware.test.js', () => {
//   let app;
//   before(() => {
//     app = mock.app();
//     return app.ready();
//   });
//   afterEach(mock.restore);

//   it('process the migrate of the order', async() => {

//     await app.model.Test.sync();

//     const testCreate = await app.model.Test.create({
//       user_id: '2ca22a2b-c648-4393-ab62-5c198eaf1efe'
//     });

//     const testObj = await app.model.Test.findAll();
//     testObj.forEach(o => {
//       o.user_id = '2ca22a2b-e648-4393-ab62-5c198eaf1efe';
//       o.save();
//     });

    
//   });
// });