# Charge Service for the OpenStack

This is a charge service for the OpenStack. It can do the followings:
* Generate the order if any required resources are created and close the order when the resource is deleted.
* Calculate the price according to the order.
* Charge the user.

# Deployment

There are two parts to deployment. 
1. The WSGI middleware for the OpenStack. It should be installed in every API node in the OpenStack.
2. The charge system implementation. It can be installed everywhere. But better under a Ngix or HA Proxy.

## Enviroment

Please make sure those components are installed in your enviroment. Both in API node and the server you installed the source code.
* Node: 7.6.5 and above.
```
curl --silent --location https://rpm.nodesource.com/setup_7.x | bash -
yum install -y nodejs
```


## Middleware

The middleware is a python code that will capture the OpenStack API's request and response.
To install the middleware. Please follow the step:
1. Copy the middleware code to your API node.
2. Install the middleware code:
```
pip install .
```
3. Configure to add the middleware in the OpenStack module:
```
node script/setup.js
```
Note: You must use the properly user to run this command.
4. 