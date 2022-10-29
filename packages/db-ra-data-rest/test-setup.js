// require('raf/polyfill'); TODO

/**
 * Mock fetch objects Response, Request and Headers
 */
const { Response, Headers, Request } = require('whatwg-fetch');

global.Response = Response;
global.Headers = Headers;
global.Request = Request;
