// Apply a saved override before the app stylesheet and module are loaded.
try {
  const theme = localStorage.getItem('pref-theme')
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme
  }
} catch {
  // CSS follows the system when storage is unavailable.
}
