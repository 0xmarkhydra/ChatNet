'use strict'

function registerNativeGrantCleanup(app, getGrants) {
  const resetNativeGrants = () => {
    const grants = getGrants()
    grants.mediaPermissions?.reset()
    grants.screenCapture?.reset()
    grants.nativeNotifications?.reset()
    grants.screenshots?.reset()
  }
  app.on('before-quit', resetNativeGrants)
  return resetNativeGrants
}

module.exports = { registerNativeGrantCleanup }
