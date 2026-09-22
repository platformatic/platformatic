/*
  The base for the tests that allocate their ports at run time: they load this file and layer the
  metrics and healthProbes blocks on top of it. Only the parts that cannot vary live here.
*/
export default {
  watch: false,
  autoload: {
    path: '../services'
  }
}
