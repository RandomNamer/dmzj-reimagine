const axios = require('axios');
const { COMIC_DEFAULT_UA } = require('./constants.js');


const DefaultAxiosProxy = axios.create({
    proxy: {
      host: '127.0.0.1',
      port: 7890
    },
    headers: {
      'User-Agent': COMIC_DEFAULT_UA,
    }
  });

module.exports = { DefaultAxiosProxy }