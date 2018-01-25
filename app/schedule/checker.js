'use strict';
const uuidV4 = require('uuid/v4');
const chalk = require('chalk');

/**
 * Get order type according to the product name.
 * @param {*String} productName 
 */
function getOrderTypeByProduct(productName) {
  const arr = productName.split(':');
  if (arr.length > 1) {
    return arr[1];
  }
}

function print(...args) {
  console.log(...args);
}

async function operationOrders(ctx, region, product, t,
  projectMap, accountMap, createTime) {
  print(`Start to work on prduct ${product.name}...`);
  const [module, tag, ...rest] = product.name.split(':');
  print(`Find all ${tag} related orders...`);
  const orders = await ctx.model.Order.findAll({
    where: {
      product_id: product.product_id,
      region: region,
      status: 'running',
    },
    transaction: t,
  });
  print(`Found ${orders.length} orders.`);

  print('Group found orders by resource_id...');

  const orderMap = new Map();
  orders.forEach(order => {
    let sx = order.resource_id;
    if (!order.resource_id) {
      sx = '-';
    }
    const s = orderMap.get(sx)
    if (!s) {
      orderMap.set(sx, [order]);
    } else {
      s.push(order);
    }
  });

  orderMap.forEach((value, key, map) => {
    value.sort((a, b) => {
      return a.created_at - b.created_at;
    });
  });

  print(`Group into ${orderMap.size} order groups.`);


  const service = ctx.service.product.getService(ctx, module, tag);

  print(`Find related ${tag} resources...`);
  let resources = await service.getFullResources(module, tag, region, rest);
  const keyFields = `${tag}s`;
  resources = resources[keyFields];
  if (resources) {
    print(`Found ${resources.length} resources.`);
  } else {
    print('Does not find any resources.');
    return;
  }
  const resourceMap = new Map();
  resources.forEach(r => {
    resourceMap.set(r.id, r);
  });
  const toCloseOrders = [];
  const toCreateOrders = [];
  const toCreateDeducts = [];

  const createNewOrder = async(product, resource) => {

    const priceObj = JSON.parse(product.unit_price);
    const opt = await service.generateOption(resource, module, tag, region);
    const body = opt.request;
    const resp = opt.response;
    const amount = await service.getProductAmount(body, opt);
    const price = ctx.service.price.calculatePrice(priceObj, amount);
    const attr = service.getResourceAttribute(body, resp, opt.tag);
    const deductId = uuidV4();
    const orderId = uuidV4();
    const projectId = await service.getProjectId(resource);
    const projectOpt = projectMap.get(projectId);

    attr.unit_price = price;
    attr.region = region;
    attr.project_id = projectId;
    attr.domain_id = projectOpt.domain_id;
    attr.user_id = projectOpt.user_id;
    attr.type = opt.tag;
    attr.product_id = product.product_id;
    attr.order_id = orderId;
    attr.deduct_id = deductId;
    attr.created_at = createTime;
    attr.updated_at = createTime;
    toCreateOrders.push(attr);


    toCreateDeducts.push({
      deduct_id: deductId,
      resource_id: attr.resource_id,
      type: attr.type,
      price: attr.unit_price,
      order_id: orderId,
      updated_at: createTime,
      created_at: createTime,
    });

    return 'Done';
  };

  for (var [key, value] of orderMap) {
    if (resourceMap.has(key)) {
      const resource = resourceMap.get(key)
      /** We can find the resource for the order. */
      const targetResource = resourceMap.get(key);

      if (value.length > 1) {

        print(chalk.red('There are more than one order. Need to remove the unused order!'));
        let realOrder = null;
        value.forEach(o => {
          if (realOrder === null || o.resource_name) {
            realOrder = o;
          }
        });
        value.forEach(o => {
          if (realOrder !== o) {
            toCloseOrders.push(o.order_id);
          }
        });
      } else if (value.length < 1) {

        const projectId = targetResource.tenant_id;
        if (projectId) {
          const project = projectMap.get(projectId);
          if (project && project.user_id) {
            const account = accountMap.get(project.user_id);
            print(chalk.red('No available order? Create new one.'));
            // Create job here:
            await createNewOrder(product, resource);
          }
        }
      }
    } else {

      print(chalk.red(`This is a dirty order, close all: ${key} with ${value.length} orders: ${value.map(r => r.order_id).join(', ')}`));
      value.forEach(r => {
        toCloseOrders.push(r.order_id);
      });
    }
  }


  /** Are there any resources does not have order? */
  for (let j = 0; j < resources.length; j++) {
    const resource = resources[j];
    if (!orderMap.has(resource.id)) {

      const projectId = await service.getProjectId(resource);
      const project = projectMap.get(projectId);
      if (!project) {
        continue;
      }
      const userId = project.user_id;
      const account = accountMap.get(userId);
      if (account && account.level < 4) {

        print(chalk.red(`The resource ${resource.id} does not have an order! Create one.`));
        /** The resource does not have order. create one. */
        await createNewOrder(product, resource);
      }
    }
  }

  print(`===================`);

  return {
    toCloseOrders,
    toCreateDeducts,
    toCreateOrders,
  };

}


/**
 * Checker is used to check the user's balance.
 * Step 1: Collect the user which balance < ${EXE_VALUE}. 
 * Step 2: Check if the user have any expense.
 * Step 3: List all users in step 2.
 * Step 4: Call the callback URL to report all users.
 * (Future feature:)
 * Step 5: Call the callback URL to user for the balance issue.
 * Step 6: Kill the resource if user still not response.
 */
module.exports = app => {
  return {
    schedule: {
      cron: `0 * * * *`,
      type: 'worker',
      disable: true,
    },
    async task(ctx) {
      const t = await ctx.app.model.transaction({
        autocommit: false
      });

      try {

        print('Find all products for use...');
        const products = await ctx.model.Product.findAll({
          transaction: t,
        });
        print(`Found ${products.length} products.`);

        print(`Find all regions...`);
        let regions = [];
        const tokenObj = await ctx.service.token.getToken();
        const keystone = tokenObj.endpoint.keystone;
        const keykst = Object.keys(keystone)[0];

        const res = await ctx.curl(`${keystone[keykst]}/regions`, {
          method: 'GET',
          dataType: 'json',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': tokenObj.token,
          },
          timeout: 20000,
        });

        const regionData = res.data;
        if (regionData.regions) {
          regions = regionData.regions.map(r => r.id);
        }
        print(`Found ${regions.length} regions`);

        const projectMap = await ctx.model.Project.listProductMap(t);
        const accountMap = await ctx.model.Account.listAccountMap(t);

        const createTime = Math.round(Date.now() / 1000) * 1000;

        print('Checking missing account in db...');
        const usersRes = await ctx.curl(`${keystone[keykst]}/users`, {
          method: 'GET',
          dataType: 'json',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': tokenObj.token,
          },
          timeout: 20000,
        });
        if (usersRes && usersRes.data && usersRes.data.users) {
          const users = usersRes.data.users;
          const userData = [];
          for (let i = 0; i < users.length; i++) {
            const user = users[i];
            if (!accountMap.has(user.id)) {
              print(chalk.red(`User with id ${user.id} does not exists.`));

              userData.push({
                user_id: user.id,
                domain_id: user.domain_id,
              });
            }
          }
          const result = await ctx.model.Account.bulkCreate(userData, {
            transaction: t,
          });
          if (result.length > 0) {
            print(chalk.red(`Created ${result.length} users.`));
          } else {
            print(chalk.green('All user are created.'));
          }
        }
        print('Checking missing project in db...');
        print('Fetching user role lists...');
        const roleRes = await ctx.curl(`${keystone[keykst]}/roles`, {
          method: 'GET',
          dataType: 'json',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': tokenObj.token,
          },
          timeout: 20000,
        });

        if (roleRes && roleRes.data && roleRes.data.roles) {
          const roles = roleRes.data.roles;
          print(chalk.green(`Found ${roles.length} roles.`));
          print(`The configured role name is: ${ctx.app.config.charge.billing_role}.`);
          let billingOwnerRole;
          roles.some(r => {
            if (r.name === ctx.app.config.charge.billing_role) {
              billingOwnerRole = r.id;
              return true;
            }
          });

          const assignmentRes = await ctx.curl(`${keystone[keykst]}/role_assignments?role.id=${billingOwnerRole}`, {
            method: 'GET',
            dataType: 'json',
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Token': tokenObj.token,
            },
            timeout: 20000,
          });

          if (assignmentRes && assignmentRes.data && assignmentRes.data.role_assignments) {
            const as = assignmentRes.data.role_assignments;
            print(`Found ${as.length} assigments. `);

            const toCreatedProject = [];

            for (let idx = 0; idx < as.length; idx++) {
              const assignment = as[idx];
              if (!assignment.scope || !assignment.scope.project) {
                continue;
              }
              const project = assignment.scope.project;
              const projectModelData = projectMap.get(project.id);
              if (projectModelData) {
                if (!projectModelData.user_id || projectModelData.user_id !== assignment.user.id) {
                  print(chalk.red(`The user ${assignment.user.id} should have assignment in project ${project.id}.`));
                  projectModelData.user_id = assignment.user.id;
                  await projectModelData.save({
                    transaction: t,
                  });
                  continue;
                }
              } else {
                print(chalk.red(`The project ${project.id} should be created.`));

                const p = await ctx.curl(`${keystone[keykst]}/projects/${project.id}`, {
                  method: 'GET',
                  dataType: 'json',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Auth-Token': tokenObj.token,
                  },
                  timeout: 20000,
                });

                if (p.data.error) {
                  continue;
                }

                const projectData = p.data.project;
                toCreatedProject.push({
                  user_id: assignment.user.id,
                  domain_id: projectData.domain_id,
                  project_id: project.id,
                });
                continue;
              }
            }

            const created = await ctx.model.Project.bulkCreate(toCreatedProject, {
              transaction: t,
            });

            print(`Creat ${created.length} project data.`);
          }

        }

        let toDelete = [];
        let newDeduct = [];
        let newOrder = [];

        const productKeys = [];

        for (let i = 0; i < products.length; i++) {
          const product = products[i];
          productKeys[i] = product.product_id;
          for (let idx = 0; idx < regions.length; idx++) {
            const region = regions[idx];
            const o = await operationOrders(ctx, region, product, t,
              projectMap, accountMap, createTime);
            if (!o) {
              continue;
            }
            toDelete = toDelete.concat(o.toCloseOrders);
            newDeduct = newDeduct.concat(o.toCreateDeducts);
            newOrder = newOrder.concat(o.toCreateOrders);
          }
        }

        print('Updating data...');

        await ctx.model.Order.update({
          updated_at: createTime,
          status: 'deleted',
        }, {
          where: {
            product_id: {
              $notIn: productKeys,
            },
          },
          transaction: t,
        });

        if (toDelete.length > 0) {
          await ctx.model.Order.update({
            updated_at: createTime,
            status: 'deleted',
          }, {
            where: {
              order_id: {
                $in: toDelete,
              },
            },
            transaction: t,
          });
          ctx.coreLogger.info(chalk.red(`checker - Delete ${toDelete.length} invalid orders.`));
        } else {
          ctx.coreLogger.info(chalk.green('checker - No deleted orders.'));
        }

        if (newOrder.length > 0) {
          // Create orders:
          await ctx.model.Order.bulkCreate(newOrder, {
            transaction: t,
          });
          ctx.coreLogger.info(chalk.red(`checker - Recreate ${newOrder.length} new orders.`));
        } else {
          ctx.coreLogger.info(chalk.green('checker - No created orders.'));
        }

        if (newDeduct.length > 0) {
          // Create deducts:
          await ctx.model.Deduct.bulkCreate(newDeduct, {
            transaction: t,
          });
        }


        await t.commit();

        print('All Done!');
      } catch (e) {
        await t.rollback();
      }
    }
  };
};