/** A window may only be hidden when there is a tray to reopen it from. */
function closeWindow({ quitting, hasTray, quit, preventClose, hide }) {
  if (quitting) return 'quitting';
  if (!hasTray) {
    quit();
    return 'quit';
  }
  preventClose();
  hide();
  return 'hidden';
}
module.exports = { closeWindow };
