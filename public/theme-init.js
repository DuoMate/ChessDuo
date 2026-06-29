(function () {
  try {
    var settings = JSON.parse(localStorage.getItem('chessduo_settings') || '{}')
    var t = settings.theme
    var isDark = t === undefined ? true : t === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
  } catch (e) {
    document.documentElement.classList.add('dark')
  }
})()
