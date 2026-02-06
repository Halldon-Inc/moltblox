/* global module */
// Server-safe stub for idb-keyval — prevents indexedDB reference errors during SSG
const store = new Map();
function get(key) {
  return Promise.resolve(store.get(key));
}
function set(key, val) {
  store.set(key, val);
  return Promise.resolve();
}
function del(key) {
  store.delete(key);
  return Promise.resolve();
}
function clear() {
  store.clear();
  return Promise.resolve();
}
function keys() {
  return Promise.resolve([...store.keys()]);
}
function values() {
  return Promise.resolve([...store.values()]);
}
function entries() {
  return Promise.resolve([...store.entries()]);
}
function getMany(ks) {
  return Promise.resolve(
    ks.map(function (k) {
      return store.get(k);
    }),
  );
}
function setMany(es) {
  es.forEach(function (e) {
    store.set(e[0], e[1]);
  });
  return Promise.resolve();
}
function update(key, updater) {
  store.set(key, updater(store.get(key)));
  return Promise.resolve();
}
function createStore() {
  return undefined;
}
function promisifyRequest(r) {
  return Promise.resolve(r);
}

module.exports = {
  get: get,
  set: set,
  del: del,
  clear: clear,
  keys: keys,
  values: values,
  entries: entries,
  getMany: getMany,
  setMany: setMany,
  update: update,
  createStore: createStore,
  promisifyRequest: promisifyRequest,
};
module.exports.default = module.exports;
