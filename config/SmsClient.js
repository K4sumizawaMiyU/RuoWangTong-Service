const Dypnsapi = require('@alicloud/dypnsapi20170525');
const { Config } = require('@alicloud/openapi-client');
const Credential = require('@alicloud/credentials');

require('dotenv').config();

const credentialConfig = new Credential.Config({
    type: 'access_key',
    accessKeyId: process.env.ACCESS_KEY_ID,
    accessKeySecret: process.env.ACCESS_KEY_SECRET,
    regionId: 'cn-hangzhou',
});

const credentialClient = new Credential.default(credentialConfig);

const config = new Config({
    credential: credentialClient,
    endpoint: 'dypnsapi.aliyuncs.com',
    apiVersion: '2017-05-25',
});

const SmsClient = new Dypnsapi.default(config);

module.exports = SmsClient;
