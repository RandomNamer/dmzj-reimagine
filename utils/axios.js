const axios = require('axios');

const DefaultAxiosProxy = axios.create({
    proxy: {
      host: '127.0.0.1',
      port: 7890
    }
  });

module.exports = { DefaultAxiosProxy }