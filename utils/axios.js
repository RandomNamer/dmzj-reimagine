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

/**
 * 
 * @param {string} ua 
 * @returns Axios
 */
function createAxioProxyWithUA(ua) {
  return axios.create({
    proxy: {
      host: '127.0.0.1',
      port: 7890
    },
    headers: {
      'User-Agent': ua,
    }
  });
}

async function getWithRetry(axiosProxy, url, maxRetries) {
  let attempt = 0;
    while (attempt < maxRetries) {
        try {
            const response = await axiosProxy.get(url);
            return response;
        } catch (error) {
            // console.error(`Attempt ${attempt + 1} failed:`, error);
            attempt++;
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (attempt >= maxRetries) {
                throw error;
            }
        }
        
    }
}

async function axiosProxyGetWithRetry(url, maxRetries) {
  return getWithRetry(DefaultAxiosProxy, url, maxRetries);
}

module.exports = { DefaultAxiosProxy, axiosProxyGetWithRetry, createAxioProxyWithUA, getWithRetry };