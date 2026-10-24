// This application lists several capability dependencies on purpose -- it exists so that update
// has more than one @platformatic/* version to bump -- so the detector cannot choose between them.
// v4 asks the application to say which capability it uses, which is what this does.
export default {
  module: '@platformatic/service'
}
