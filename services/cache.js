  const mongoose = require('mongoose');
  const redis = require('redis');
  const util = require('util');

  const redisUrl = 'redis://127.0.0.1:6379';
  const client = redis.createClient(redisUrl);
  client.hget = util.promisify(client.hget);

  const exec = mongoose.Query.prototype.exec;

  mongoose.Query.prototype.cache = function(options = {}) {
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || '');

    return this;
  };

  mongoose.Query.prototype.exec = async function() {

    if(!this.useCache) {
        return exec.apply(this, arguments);
    }

    const key =  JSON.stringify(Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    }));

  //see if we have a value of key in Redis
  const cacheValue = await client.hget(this.hashKey, key);

  //if yes, return yes
  if(cacheValue) {

    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc)
    ? doc.map(d => new this.model(d))
    : new this.model(doc)
  }


  //otherwise, issue query and store in redis
  const result =  await exec.apply(this, arguments);
  client.hset(this.hashKey, key, JSON.stringify(result, null ,2));
  return result;
} //redis only handles JSON data.

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  }
};
